"""
Backup Service for SecFind
Handles database backups to local storage and Google Drive
"""
import os
import subprocess
import shutil
from datetime import datetime, timezone
from typing import Optional, Dict, List
import asyncio
from pathlib import Path
import json

# Google Drive imports
try:
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    GOOGLE_DRIVE_AVAILABLE = True
except ImportError:
    GOOGLE_DRIVE_AVAILABLE = False


class BackupService:
    def __init__(self, db, mongo_url: str, db_name: str):
        self.db = db
        self.mongo_url = mongo_url
        self.db_name = db_name
        self.default_backup_path = os.environ.get("BACKUP_PATH", "/app/backups")
        
    async def get_config(self) -> Dict:
        """Get backup configuration from database"""
        config = await self.db.configuracion.find_one({"id": "config_backup"}, {"_id": 0})
        if not config:
            return {
                "id": "config_backup",
                "habilitado": False,
                "ruta_local": self.default_backup_path,
                "google_drive_habilitado": False,
                "google_drive_folder_id": "",
                "google_drive_credentials": None,
                "frecuencia": "diario",  # diario, semanal, mensual
                "hora_ejecucion": "02:00",
                "dia_semana": 0,  # 0=Lunes, 6=Domingo (para semanal)
                "dia_mes": 1,  # 1-28 (para mensual)
                "notificar_error": True,
                "email_notificacion": "",
            }
        return config
    
    async def save_config(self, config: Dict) -> bool:
        """Save backup configuration"""
        config["id"] = "config_backup"
        config["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.configuracion.update_one(
            {"id": "config_backup"},
            {"$set": config},
            upsert=True
        )
        return True
    
    async def ejecutar_backup(self, destino: str = "local", ruta_personalizada: Optional[str] = None) -> Dict:
        """
        Execute a database backup
        destino: "local" or "google_drive" or "ambos"
        """
        config = await self.get_config()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"secfind_backup_{timestamp}"
        
        # Determine local path
        ruta_local = ruta_personalizada or config.get("ruta_local", self.default_backup_path)
        
        # Ensure backup directory exists
        Path(ruta_local).mkdir(parents=True, exist_ok=True)
        
        backup_path = os.path.join(ruta_local, backup_filename)
        archivo_comprimido = f"{backup_path}.gz"
        
        resultado = {
            "id": f"backup_{timestamp}",
            "fecha": datetime.now(timezone.utc).isoformat(),
            "estado": "en_progreso",
            "destino": destino,
            "ruta_local": None,
            "google_drive_file_id": None,
            "tamaño": None,
            "error": None,
            "duracion_segundos": None
        }
        
        inicio = datetime.now()
        
        try:
            # Execute mongodump
            cmd = [
                "mongodump",
                f"--uri={self.mongo_url}",
                f"--db={self.db_name}",
                f"--archive={archivo_comprimido}",
                "--gzip"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"mongodump failed: {stderr.decode()}")
            
            # Get file size
            if os.path.exists(archivo_comprimido):
                tamaño = os.path.getsize(archivo_comprimido)
                resultado["tamaño"] = tamaño
                resultado["tamaño_humano"] = self._formato_tamaño(tamaño)
                resultado["ruta_local"] = archivo_comprimido
            
            # Upload to Google Drive if requested
            if destino in ["google_drive", "ambos"] and config.get("google_drive_habilitado"):
                try:
                    file_id = await self._upload_to_google_drive(
                        archivo_comprimido, 
                        f"{backup_filename}.gz",
                        config
                    )
                    resultado["google_drive_file_id"] = file_id
                except Exception as e:
                    resultado["error_google_drive"] = str(e)
                    if destino == "google_drive":
                        raise
            
            # If only google drive, remove local file
            if destino == "google_drive" and resultado.get("google_drive_file_id"):
                os.remove(archivo_comprimido)
                resultado["ruta_local"] = None
            
            resultado["estado"] = "exitoso"
            
        except Exception as e:
            resultado["estado"] = "fallido"
            resultado["error"] = str(e)
            
            # Send notification if configured
            if config.get("notificar_error") and config.get("email_notificacion"):
                await self._enviar_notificacion_error(config, resultado)
        
        finally:
            fin = datetime.now()
            resultado["duracion_segundos"] = (fin - inicio).total_seconds()
            
            # Save to backup log
            await self._guardar_log(resultado)
        
        return resultado
    
    async def _upload_to_google_drive(self, archivo_local: str, nombre_archivo: str, config: Dict) -> str:
        """Upload backup file to Google Drive"""
        if not GOOGLE_DRIVE_AVAILABLE:
            raise Exception("Google Drive libraries not installed. Run: pip install google-auth google-auth-oauthlib google-api-python-client")
        
        credentials_json = config.get("google_drive_credentials")
        if not credentials_json:
            raise Exception("Google Drive credentials not configured")
        
        folder_id = config.get("google_drive_folder_id")
        
        # Create credentials from service account
        if isinstance(credentials_json, str):
            credentials_json = json.loads(credentials_json)
        
        credentials = service_account.Credentials.from_service_account_info(
            credentials_json,
            scopes=['https://www.googleapis.com/auth/drive.file']
        )
        
        service = build('drive', 'v3', credentials=credentials)
        
        file_metadata = {
            'name': nombre_archivo,
            'mimeType': 'application/gzip'
        }
        
        if folder_id:
            file_metadata['parents'] = [folder_id]
        
        media = MediaFileUpload(archivo_local, mimetype='application/gzip', resumable=True)
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        return file.get('id')
    
    async def _guardar_log(self, resultado: Dict):
        """Save backup result to log collection"""
        # Make a copy to avoid modifying the original result with _id
        log_entry = resultado.copy()
        await self.db.backup_logs.insert_one(log_entry)
    
    async def obtener_historial(self, limite: int = 50) -> List[Dict]:
        """Get backup history"""
        cursor = self.db.backup_logs.find(
            {}, 
            {"_id": 0}
        ).sort("fecha", -1).limit(limite)
        
        return await cursor.to_list(length=limite)
    
    async def eliminar_backup(self, backup_id: str) -> bool:
        """Delete a backup (local file and log entry)"""
        log = await self.db.backup_logs.find_one({"id": backup_id}, {"_id": 0})
        
        if not log:
            return False
        
        # Delete local file if exists
        if log.get("ruta_local") and os.path.exists(log["ruta_local"]):
            os.remove(log["ruta_local"])
        
        # Delete log entry
        await self.db.backup_logs.delete_one({"id": backup_id})
        
        return True
    
    async def descargar_backup(self, backup_id: str) -> Optional[str]:
        """Get backup file path for download"""
        log = await self.db.backup_logs.find_one({"id": backup_id}, {"_id": 0})
        
        if not log or not log.get("ruta_local"):
            return None
        
        if os.path.exists(log["ruta_local"]):
            return log["ruta_local"]
        
        return None
    
    async def _enviar_notificacion_error(self, config: Dict, resultado: Dict):
        """Send email notification on backup failure"""
        try:
            # Get SMTP config from notifications
            smtp_config = await self.db.configuracion.find_one({"id": "config_notificaciones"}, {"_id": 0})
            
            if not smtp_config or not smtp_config.get("habilitado"):
                return
            
            from email_service import EmailService
            
            email_service = EmailService(
                smtp_server=smtp_config.get("smtp_servidor"),
                smtp_port=smtp_config.get("smtp_puerto"),
                smtp_email=smtp_config.get("smtp_email"),
                smtp_password=smtp_config.get("smtp_password"),
                use_tls=smtp_config.get("smtp_usar_tls", True)
            )
            
            subject = "⚠️ SecFind - Error en Backup de Base de Datos"
            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #ef4444;">Error en Backup Automático</h2>
                <p>Se ha producido un error al realizar el backup de la base de datos.</p>
                <table style="border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Fecha:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{resultado.get('fecha')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Destino:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{resultado.get('destino')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Error:</strong></td>
                        <td style="padding: 8px; border: 1px solid #ddd; color: #ef4444;">{resultado.get('error')}</td>
                    </tr>
                </table>
                <p>Por favor, revise la configuración del sistema de backups.</p>
            </body>
            </html>
            """
            
            await email_service.send_email(
                to_email=config.get("email_notificacion"),
                subject=subject,
                html_content=body
            )
            
        except Exception as e:
            print(f"Error sending backup notification: {e}")
    
    def _formato_tamaño(self, bytes_size: int) -> str:
        """Convert bytes to human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_size < 1024:
                return f"{bytes_size:.2f} {unit}"
            bytes_size /= 1024
        return f"{bytes_size:.2f} TB"


# Scheduler for automated backups
class BackupScheduler:
    def __init__(self, backup_service: BackupService):
        self.backup_service = backup_service
        self.scheduler = None
        self._running = False
    
    async def start(self):
        """Start the backup scheduler"""
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        
        if self._running:
            return
        
        self.scheduler = AsyncIOScheduler()
        
        # Load config and schedule
        await self._actualizar_programacion()
        
        self.scheduler.start()
        self._running = True
    
    async def stop(self):
        """Stop the backup scheduler"""
        if self.scheduler and self._running:
            self.scheduler.shutdown()
            self._running = False
    
    async def _actualizar_programacion(self):
        """Update backup schedule based on config"""
        config = await self.backup_service.get_config()
        
        if not config.get("habilitado"):
            # Remove existing job if any
            if self.scheduler:
                try:
                    self.scheduler.remove_job("backup_programado")
                except Exception:
                    pass
            return
        
        hora, minuto = config.get("hora_ejecucion", "02:00").split(":")
        frecuencia = config.get("frecuencia", "diario")
        
        trigger_kwargs = {
            "hour": int(hora),
            "minute": int(minuto)
        }
        
        if frecuencia == "semanal":
            trigger_kwargs["day_of_week"] = config.get("dia_semana", 0)
        elif frecuencia == "mensual":
            trigger_kwargs["day"] = config.get("dia_mes", 1)
        
        from apscheduler.triggers.cron import CronTrigger
        trigger = CronTrigger(**trigger_kwargs)
        
        # Remove existing job and add new one
        try:
            self.scheduler.remove_job("backup_programado")
        except Exception:
            pass
        
        self.scheduler.add_job(
            self._ejecutar_backup_programado,
            trigger=trigger,
            id="backup_programado",
            name="Backup Programado de Base de Datos"
        )
    
    async def _ejecutar_backup_programado(self):
        """Execute scheduled backup"""
        config = await self.backup_service.get_config()
        
        destino = "local"
        if config.get("google_drive_habilitado"):
            destino = "ambos"
        
        await self.backup_service.ejecutar_backup(destino=destino)
    
    async def actualizar_config(self, config: Dict):
        """Update config and reschedule"""
        await self.backup_service.save_config(config)
        await self._actualizar_programacion()
