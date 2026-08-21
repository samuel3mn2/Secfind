@echo off
REM ============================================
REM Script de Backup Programado para SecFind
REM Configurar en Tarea Programada de Windows
REM ============================================

REM Cambiar al directorio del script
cd /d "%~dp0"

REM Ejecutar el script Python
REM Modifica la ruta de Python si es diferente en tu sistema
python backup_programado.py local

REM Si prefieres backup a Google Drive también, usa:
REM python backup_programado.py ambos

REM Pausar solo si se ejecuta manualmente (no desde Tarea Programada)
if "%1"=="" pause
