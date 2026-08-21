# Configurar Backup Automático con Tarea Programada de Windows

## Paso 1: Copiar los scripts

1. Copia la carpeta `scripts` completa a tu instalación de SecFind:
   ```
   C:\SecFind\scripts\
   ├── backup_programado.py
   ├── ejecutar_backup.bat
   └── INSTRUCCIONES_TAREA_PROGRAMADA.md
   ```

## Paso 2: Configurar credenciales

1. Abre `backup_programado.py` con el Bloc de notas
2. Modifica estas líneas según tu configuración:
   ```python
   API_URL = "http://localhost:8001/api"  # URL de tu backend
   ADMIN_USERNAME = "admin"               # Tu usuario admin
   ADMIN_PASSWORD = "admin123"            # Tu contraseña
   DESTINO_DEFAULT = "local"              # local, google_drive, o ambos
   ```
3. Guarda el archivo

## Paso 3: Probar manualmente

1. Asegúrate de que el servidor backend esté corriendo
2. Abre una terminal (cmd) en la carpeta scripts
3. Ejecuta:
   ```cmd
   python backup_programado.py
   ```
4. Deberías ver:
   ```
   Iniciando backup programado - Destino: local
   Autenticación exitosa
   Ejecutando backup...
   BACKUP COMPLETADO EXITOSAMENTE
   ```

## Paso 4: Crear la Tarea Programada

### Abrir el Programador de tareas:
1. Presiona `Windows + R`
2. Escribe `taskschd.msc` y presiona Enter

### Crear nueva tarea:
1. En el panel derecho, haz clic en **"Crear tarea básica..."**

2. **Nombre y descripción:**
   - Nombre: `SecFind Backup Diario`
   - Descripción: `Backup automático de la base de datos SecFind`
   - Clic en **Siguiente**

3. **Desencadenador (cuándo ejecutar):**
   - Selecciona **"Diariamente"**
   - Clic en **Siguiente**
   - Configura la hora (ej: 02:00 AM)
   - Clic en **Siguiente**

4. **Acción:**
   - Selecciona **"Iniciar un programa"**
   - Clic en **Siguiente**

5. **Programa o script:**
   - Clic en **"Examinar..."**
   - Navega a: `C:\SecFind\scripts\ejecutar_backup.bat`
   - Selecciónalo y clic en **Abrir**
   - En "Iniciar en (opcional)" escribe: `C:\SecFind\scripts`
   - Clic en **Siguiente**

6. **Finalizar:**
   - Marca **"Abrir el diálogo Propiedades..."**
   - Clic en **Finalizar**

### Configuración avanzada (en el diálogo de Propiedades):

1. **Pestaña "General":**
   - Marca **"Ejecutar tanto si el usuario inició sesión como si no"**
   - Marca **"Ejecutar con los privilegios más altos"**

2. **Pestaña "Condiciones":**
   - Desmarca **"Iniciar la tarea solo si el equipo está en CA"** (para laptops)

3. **Pestaña "Configuración":**
   - Marca **"Ejecutar tarea a petición"**
   - Marca **"Si no se puede ejecutar tarea programada, ejecutar a cuanto sea posible"**

4. Clic en **Aceptar**
5. Ingresa tu contraseña de Windows cuando lo solicite

## Paso 5: Probar la tarea

1. En el Programador de tareas, busca **"SecFind Backup Diario"**
2. Clic derecho → **"Ejecutar"**
3. Verifica que se complete correctamente
4. Revisa los logs en: `C:\SecFind\scripts\logs\`

## Verificar logs

Los logs se guardan en:
```
C:\SecFind\scripts\logs\backup_YYYYMM.log
```

Ejemplo de log exitoso:
```
2026-08-20 02:00:01 - INFO - Iniciando backup programado - Destino: local
2026-08-20 02:00:01 - INFO - Autenticación exitosa
2026-08-20 02:00:02 - INFO - BACKUP COMPLETADO EXITOSAMENTE
2026-08-20 02:00:02 - INFO -   Tamaño: 156.56 KB
2026-08-20 02:00:02 - INFO -   Archivo: C:\SecFind\Backups\secfind_backup_20260820_020001.gz
```

## Solución de problemas

### Error: "No se pudo obtener token de autenticación"
- Verifica que el servidor backend esté corriendo
- Verifica las credenciales en `backup_programado.py`

### Error: "mongodump no encontrado"
- Configura la ruta de mongodump en Configuración > Backups de la aplicación web

### La tarea no se ejecuta
- Verifica que el usuario de Windows tenga permisos
- Revisa el historial de la tarea en el Programador de tareas

## Notas importantes

- **El servidor backend NO necesita estar corriendo 24/7** si usas este método
- Solo necesitas iniciar el servidor antes de la hora programada del backup
- Si el servidor no está disponible, el backup fallará y se registrará en los logs
- Para backups a Google Drive, configura las credenciales en la aplicación web primero
