"""
Backup Service for SecFind
Handles database backups to local storage and Google Drive
Cross-platform compatible (Windows/Linux/macOS)
"""
import os
import sys
import shutil
import asyncio
import json
import platform
from datetime import datetime, timezone
from typing import Optional, Dict, List
from pathlib import Path

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
    """Service class for database backup operations"""
    
    # Common mongodump installation paths on Windows
    WINDOWS_MONGODUMP_PATHS = [
        r"C:\mongodb-database-tools-windows-x86_64-100.18.0\bin\mongodump.exe",
        r"C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe",
        r"C:\Program Files\MongoDB\Server\7.0\bin\mongodump.exe",
        r"C:\Program Files\MongoDB\Server\6.0\bin\mongodump.exe",
        r"C:\Program Files\MongoDB\Server\5.0\bin\mongodump.exe",
        r"C:\Program Files\MongoDB\Server\4.4\bin\mongodump.exe",
        r"C:\MongoDB\bin\mongodump.exe",
        r"C:\mongodb\bin\mongodump.exe",
    ]
    
    def __init__(self, db, mongo_url: str, db_name: str):
        self.db = db
        self.mongo_url = mongo_url
        self.db_name = db_name
        self._is_windows = platform.system() == "Windows"
        
        # Set platform-appropriate default backup path
        if self._is_windows:
            # Use user's Documents folder on Windows
            default_path = os.environ.get("BACKUP_PATH", str(Path.home() / "Documents" / "SecFind" / "Backups"))
        else:
            default_path = os.environ.get("BACKUP_PATH", "/app/backups")
        
        self.default_backup_path = default_path
        
    def _buscar_mongodump(self, ruta_configurada: Optional[str] = None) -> Optional[str]:
        """
        Search for mongodump executable.
        
        Priority:
        1. User-configured path (if valid)
        2. System PATH (shutil.which)
        3. Common Windows installation paths
        
        Returns the full path to mongodump or None if not found.
        """
        # 1. Check user-configured path first
        if ruta_configurada:
            configured_path = Path(ruta_configurada)
            if configured_path.is_file():
                return str(configured_path)
        
        # 2. Check system PATH
        mongodump_in_path = shutil.which("mongodump")
        if mongodump_in_path:
            return mongodump_in_path
        
        # 3. On Windows, search common installation paths
        if self._is_windows:
            for path in self.WINDOWS_MONGODUMP_PATHS:
                if Path(path).is_file():
                    return path
            
            # Also check if user has a custom path in common locations
            # Check all drives for mongodb-database-tools
            import string
            for drive in string.ascii_uppercase:
                drive_path = f"{drive}:\\"
                if Path(drive_path).exists():
                    # Check for mongodb-database-tools folder pattern
                    for folder in Path(drive_path).glob("mongodb-database-tools*"):
                        if folder.is_dir():
                            mongodump_path = folder / "bin" / "mongodump.exe"
                            if mongodump_path.is_file():
                                return str(mongodump_path)
        
        return None
    
    def _get_mongodump_error_message(self, ruta_configurada: Optional[str] = None) -> str:
        """Generate a helpful error message when mongodump is not found"""
        if self._is_windows:
            return (
                "No se encontró mongodump.exe. Por favor:\n"
                "1. Descarga MongoDB Database Tools desde: https://www.mongodb.com/try/download/database-tools\n"
                "2. Extrae el archivo en C:\\ (ej: C:\\mongodb-database-tools-windows-x86_64-100.18.0)\n"
                "3. Configura la ruta completa a mongodump.exe en la configuración de backups\n"
                f"   Ejemplo: C:\\mongodb-database-tools-windows-x86_64-100.18.0\\bin\\mongodump.exe\n"
                f"Rutas buscadas: PATH del sistema + rutas comunes de Windows"
            )
        else:
            return (
                "No se encontró mongodump. Instálalo con:\n"
                "  Ubuntu/Debian: sudo apt install mongodb-database-tools\n"
                "  macOS: brew install mongodb-database-tools\n"
                "  O descárgalo desde: https://www.mongodb.com/try/download/database-tools"
            )
    
    async def get_config(self) -> Dict:
        """Get backup configuration from database"""
        config = await self.db.configuracion.find_one({"id": "config_backup"}, {"_id": 0})
        if not config:
            return {
                "id": "config_backup",
                "habilitado": False,
                "ruta_local": self.default_backup_path,
                "ruta_mongodump": "",  # Empty = auto-detect
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
        
        # Ensure new fields exist for backwards compatibility
        if "ruta_mongodump" not in config:
            config["ruta_mongodump"] = ""
            
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
    
    async def validar_mongodump(self, ruta_personalizada: Optional[str] = None) -> Dict:
        """
        Validate that mongodump is accessible and return info about it.
        """
        mongodump_path = self._buscar_mongodump(ruta_personalizada)
        
        if not mongodump_path:
            return {
                "encontrado": False,
                "ruta": None,
                "version": None,
                "error": self._get_mongodump_error_message(ruta_personalizada)
            }
        
        # Try to get version
        try:
            if self._is_windows:
                # On Windows, use shell=True to handle paths with spaces
                process = await asyncio.create_subprocess_shell(
                    f'"{mongodump_path}" --version',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            else:
                process = await asyncio.create_subprocess_exec(
                    mongodump_path, "--version",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            
            stdout, stderr = await process.communicate()
            version_output = stdout.decode().strip() or stderr.decode().strip()
            
            # Extract version number
            version = "desconocida"
            for line in version_output.split('\n'):
                if 'version' in line.lower():
                    version = line.strip()
                    break
            
            return {
                "encontrado": True,
                "ruta": mongodump_path,
                "version": version,
                "error": None
            }
            
        except Exception as e:
            return {
                "encontrado": True,
                "ruta": mongodump_path,
                "version": f"Error obteniendo versión: {str(e)}",
                "error": None
            }
    
    async def ejecutar_backup(self, destino: str = "local", ruta_personalizada: Optional[str] = None) -> Dict:
        """
        Execute a database backup
        destino: "local" or "google_drive" or "ambos"
        """
        config = await self.get_config()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"secfind_backup_{timestamp}"
        
        # Determine local path using pathlib for cross-platform compatibility
        ruta_local_str = ruta_personalizada or config.get("ruta_local", self.default_backup_path)
        ruta_local = Path(ruta_local_str)
        
        resultado = {
            "id": f"backup_{timestamp}",
            "fecha": datetime.now(timezone.utc).isoformat(),
            "estado": "en_progreso",
            "destino": destino,
            "ruta_local": None,
            "google_drive_file_id": None,
            "tamaño": None,
            "tamaño_humano": None,
            "error": None,
            "duracion_segundos": None
        }
        
        inicio = datetime.now()
        
        try:
            # Find mongodump executable
            ruta_mongodump_config = config.get("ruta_mongodump", "")
            mongodump_path = self._buscar_mongodump(ruta_mongodump_config)
            
            if not mongodump_path:
                raise FileNotFoundError(self._get_mongodump_error_message(ruta_mongodump_config))
            
            # Ensure backup directory exists
            try:
                ruta_local.mkdir(parents=True, exist_ok=True)
            except PermissionError:
                raise PermissionError(f"Sin permisos para crear/acceder a la carpeta: {ruta_local}")
            except OSError as e:
                raise OSError(f"Error al crear carpeta de backup: {e}")
            
            # Build output file path
            archivo_comprimido = ruta_local / f"{backup_filename}.gz"
            
            # Execute mongodump
            if self._is_windows:
                # On Windows, use shell=True and quote paths properly
                cmd = (
                    f'"{mongodump_path}" '
                    f'--uri="{self.mongo_url}" '
                    f'--db="{self.db_name}" '
                    f'--archive="{archivo_comprimido}" '
                    f'--gzip'
                )
                
                process = await asyncio.create_subprocess_shell(
                    cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            else:
                # On Linux/macOS, use exec directly
                cmd = [
                    mongodump_path,
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
                error_msg = stderr.decode().strip() or stdout.decode().strip()
                raise Exception(f"mongodump falló (código {process.returncode}): {error_msg}")
            
            # Get file size
            if archivo_comprimido.exists():
                tamaño = archivo_comprimido.stat().st_size
                resultado["tamaño"] = tamaño
                resultado["tamaño_humano"] = self._formato_tamaño(tamaño)
                resultado["ruta_local"] = str(archivo_comprimido)
            
            # Upload to Google Drive if requested
            if destino in ["google_drive", "ambos"] and config.get("google_drive_habilitado"):
                try:
                    file_id = await self._upload_to_google_drive(
                        str(archivo_comprimido), 
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
                archivo_comprimido.unlink()
                resultado["ruta_local"] = None
            
            resultado["estado"] = "exitoso"
            
        except FileNotFoundError as e:
            resultado["estado"] = "fallido"
            resultado["error"] = str(e)
            
            # Send notification if configured
            if config.get("notificar_error") and config.get("email_notificacion"):
                await self._enviar_notificacion_error(config, resultado)
                
        except PermissionError as e:
            resultado["estado"] = "fallido"
            resultado["error"] = str(e)
            
            if config.get("notificar_error") and config.get("email_notificacion"):
                await self._enviar_notificacion_error(config, resultado)
                
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
        if log.get("ruta_local"):
            ruta = Path(log["ruta_local"])
            if ruta.exists():
                ruta.unlink()
        
        # Delete log entry
        await self.db.backup_logs.delete_one({"id": backup_id})
        
        return True
    
    async def descargar_backup(self, backup_id: str) -> Optional[str]:
        """Get backup file path for download"""
        log = await self.db.backup_logs.find_one({"id": backup_id}, {"_id": 0})
        
        if not log or not log.get("ruta_local"):
            return None
        
        ruta = Path(log["ruta_local"])
        if ruta.exists():
            return str(ruta)
        
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
    """Scheduler class for automated backups using APScheduler"""
    
    def __init__(self, backup_service: BackupService):
        self.backup_service = backup_service
        self.scheduler = None
        self._running = False
    
    async def start(self):
        """Start the backup scheduler"""
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from apscheduler.triggers.cron import CronTrigger
        except ImportError:
            print("APScheduler not installed. Scheduled backups disabled.")
            return
        
        if self._running:
            return
        
        try:
            self.scheduler = AsyncIOScheduler(timezone="America/Santo_Domingo")
            
            # Load config and schedule
            await self._actualizar_programacion()
            
            self.scheduler.start()
            self._running = True
            print("Backup scheduler started successfully")
            
            # Check if we missed today's backup and should run it now
            await self._verificar_backup_perdido()
            
        except Exception as e:
            print(f"Error starting backup scheduler: {e}")
            self._running = False
    
    async def _verificar_backup_perdido(self):
        """Check if today's scheduled backup was missed and run it if needed"""
        try:
            from datetime import datetime
            from zoneinfo import ZoneInfo
            
            config = await self.backup_service.get_config()
            if not config.get("habilitado"):
                return
            
            # Get current time in Santo Domingo timezone
            tz = ZoneInfo("America/Santo_Domingo")
            ahora = datetime.now(tz)
            
            # Parse scheduled time
            hora_str = config.get("hora_ejecucion", "02:00")
            hora, minuto = map(int, hora_str.split(":"))
            
            # Check if we're past the scheduled time today
            hora_programada = ahora.replace(hour=hora, minute=minuto, second=0, microsecond=0)
            
            if ahora > hora_programada:
                # We're past the scheduled time - check if backup ran today
                desde_hoy = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
                
                # Get today's backup logs
                logs_hoy = await self.backup_service.db.backup_logs.count_documents({
                    "fecha": {"$gte": desde_hoy.isoformat()},
                    "estado": "exitoso"
                })
                
                if logs_hoy == 0:
                    # No successful backup today - run one now
                    print(f"Backup perdido detectado (programado: {hora_str}, ahora: {ahora.strftime('%H:%M')}). Ejecutando ahora...")
                    await self._ejecutar_backup_programado()
                else:
                    print(f"Backup del día ya existe ({logs_hoy} exitosos hoy)")
                    
        except Exception as e:
            print(f"Error verificando backup perdido: {e}")
    
    async def stop(self):
        """Stop the backup scheduler"""
        if self.scheduler and self._running:
            try:
                self.scheduler.shutdown(wait=False)
            except Exception as e:
                print(f"Error stopping backup scheduler: {e}")
            finally:
                self._running = False
    
    async def _actualizar_programacion(self):
        """Update backup schedule based on config"""
        if not self.scheduler:
            return
            
        config = await self.backup_service.get_config()
        
        if not config.get("habilitado"):
            # Remove existing job if any
            try:
                self.scheduler.remove_job("backup_programado")
            except Exception:
                pass
            return
        
        try:
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
                name="Backup Programado de Base de Datos",
                replace_existing=True,
                misfire_grace_time=3600  # Si el backup se perdió por menos de 1 hora, ejecutarlo igual
            )
            print(f"Backup scheduled: {frecuencia} at {hora}:{minuto}")
            
        except Exception as e:
            print(f"Error updating backup schedule: {e}")
    
    async def _ejecutar_backup_programado(self):
        """Execute scheduled backup"""
        try:
            config = await self.backup_service.get_config()
            
            destino = "local"
            if config.get("google_drive_habilitado"):
                destino = "ambos"
            
            result = await self.backup_service.ejecutar_backup(destino=destino)
            print(f"Scheduled backup completed: {result.get('estado')}")
        except Exception as e:
            print(f"Error in scheduled backup: {e}")
    
    async def actualizar_config(self, config: Dict):
        """Update config and reschedule"""
        await self.backup_service.save_config(config)
        
        # Initialize scheduler if needed and config is enabled
        if config.get("habilitado") and not self._running:
            await self.start()
        elif self._running:
            await self._actualizar_programacion()
        elif not config.get("habilitado") and self._running:
            await self.stop()
