"""
Script de Backup Programado para SecFind
Ejecutar via Tarea Programada de Windows

Uso: python backup_programado.py [--destino local|google_drive|ambos]
"""
import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path

# Configurar logging
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / f"backup_{datetime.now().strftime('%Y%m')}.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============ CONFIGURACIÓN ============
# Modifica estos valores según tu instalación

API_URL = "http://localhost:8001/api"  # URL del backend
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
DESTINO_DEFAULT = "local"  # local, google_drive, ambos

# ========================================

def hacer_login():
    """Obtener token JWT"""
    import urllib.request
    import urllib.error
    
    url = f"{API_URL}/auth/login"
    data = json.dumps({
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    }).encode('utf-8')
    
    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('token')
    except urllib.error.HTTPError as e:
        logger.error(f"Error de autenticación: {e.code} - {e.read().decode()}")
        return None
    except Exception as e:
        logger.error(f"Error conectando al servidor: {e}")
        return None

def ejecutar_backup(token: str, destino: str = "local"):
    """Ejecutar backup via API"""
    import urllib.request
    import urllib.error
    
    url = f"{API_URL}/backup/ejecutar"
    data = json.dumps({
        "destino": destino
    }).encode('utf-8')
    
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=300) as response:  # 5 min timeout
            result = json.loads(response.read().decode('utf-8'))
            return result
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode()
        logger.error(f"Error ejecutando backup: {e.code} - {error_msg}")
        return {"estado": "fallido", "error": error_msg}
    except Exception as e:
        logger.error(f"Error de conexión: {e}")
        return {"estado": "fallido", "error": str(e)}

def main():
    """Función principal"""
    # Parsear argumentos
    destino = DESTINO_DEFAULT
    if len(sys.argv) > 1:
        if sys.argv[1] == "--destino" and len(sys.argv) > 2:
            destino = sys.argv[2]
        elif sys.argv[1] in ["local", "google_drive", "ambos"]:
            destino = sys.argv[1]
    
    logger.info("=" * 50)
    logger.info(f"Iniciando backup programado - Destino: {destino}")
    logger.info("=" * 50)
    
    # Paso 1: Autenticación
    logger.info("Autenticando con el servidor...")
    token = hacer_login()
    
    if not token:
        logger.error("No se pudo obtener token de autenticación")
        logger.error("Verifica que el servidor esté corriendo y las credenciales sean correctas")
        sys.exit(1)
    
    logger.info("Autenticación exitosa")
    
    # Paso 2: Ejecutar backup
    logger.info("Ejecutando backup...")
    resultado = ejecutar_backup(token, destino)
    
    # Paso 3: Reportar resultado
    if resultado.get("estado") == "exitoso":
        logger.info("=" * 50)
        logger.info("BACKUP COMPLETADO EXITOSAMENTE")
        logger.info(f"  ID: {resultado.get('id')}")
        logger.info(f"  Tamaño: {resultado.get('tamaño_humano', 'N/A')}")
        logger.info(f"  Duración: {resultado.get('duracion_segundos', 0):.2f} segundos")
        if resultado.get('ruta_local'):
            logger.info(f"  Archivo: {resultado.get('ruta_local')}")
        if resultado.get('google_drive_file_id'):
            logger.info(f"  Google Drive ID: {resultado.get('google_drive_file_id')}")
        logger.info("=" * 50)
        sys.exit(0)
    else:
        logger.error("=" * 50)
        logger.error("BACKUP FALLIDO")
        logger.error(f"  Error: {resultado.get('error', 'Error desconocido')}")
        logger.error("=" * 50)
        sys.exit(1)

if __name__ == "__main__":
    main()
