# Guía de Instalación SecFind en Windows 11
## Para Principiantes - Paso a Paso Completo

> **¿Prefieres Docker?** Si ya tienes Docker instalado, consulta la guía [DOCKER.md](./DOCKER.md) para una instalación más rápida.

---

## PARTE 1: DESCARGAR E INSTALAR PROGRAMAS NECESARIOS

Antes de instalar SecFind, necesitas instalar 3 programas en tu computadora. Sigue cada paso exactamente como se indica.

---

### PASO 1: Instalar Python

Python es el lenguaje de programación que usa el servidor de la aplicación.

1. **Abrir el navegador** (Chrome, Edge, Firefox)

2. **Ir a la página de Python:**
   ```
   https://www.python.org/downloads/
   ```

3. **Descargar Python:**
   - Verás un botón amarillo grande que dice **"Download Python 3.x.x"**
   - Haz clic en ese botón (descarga la versión que aparezca, cualquiera 3.9+ funciona)
   - Se descargará un archivo como `python-3.xx.x-amd64.exe`

4. **Instalar Python:**
   - Ve a tu carpeta de **Descargas**
   - Haz **doble clic** en el archivo `python-3.xx.x-amd64.exe`
   - **MUY IMPORTANTE:** En la primera pantalla, marca la casilla que dice:
     ```
     ☑ Add python.exe to PATH
     ```
   - Luego haz clic en **"Install Now"**
   - Espera a que termine (puede tardar 2-3 minutos)
   - Cuando diga "Setup was successful", haz clic en **"Close"**

5. **Verificar que Python se instaló correctamente:**
   - Presiona las teclas `Windows + R` (la tecla Windows es la que tiene el logo de Windows)
   - Escribe `cmd` y presiona Enter
   - Se abrirá una ventana negra (Símbolo del sistema)
   - Escribe esto y presiona Enter:
     ```
     python --version
     ```
   - Deberías ver algo como: `Python 3.12.0` o `Python 3.13.0` (cualquier número 3.9 o mayor está bien)
   - Si ves un error, reinicia la computadora e intenta de nuevo

---

### PASO 2: Instalar Node.js

Node.js es necesario para ejecutar la interfaz web de la aplicación.

1. **Ir a la página de Node.js:**
   ```
   https://nodejs.org/
   ```

2. **Descargar Node.js:**
   - Verás dos botones verdes
   - Haz clic en el botón de la **izquierda** que dice **"LTS"** (versión recomendada)
   - Se descargará un archivo como `node-v20.x.x-x64.msi`

3. **Instalar Node.js:**
   - Ve a tu carpeta de **Descargas**
   - Haz **doble clic** en el archivo `node-v20.x.x-x64.msi`
   - Haz clic en **"Next"** en cada pantalla
   - Acepta los términos de licencia
   - Sigue haciendo clic en **"Next"** hasta llegar a **"Install"**
   - Haz clic en **"Install"**
   - Si aparece una ventana preguntando si permites cambios, haz clic en **"Sí"**
   - Espera a que termine y haz clic en **"Finish"**

4. **Verificar que Node.js se instaló correctamente:**
   - Presiona `Windows + R`
   - Escribe `cmd` y presiona Enter
   - Escribe esto y presiona Enter:
     ```
     node --version
     ```
   - Deberías ver algo como: `v20.10.0`

5. **Instalar Yarn** (herramienta adicional necesaria):
   - En la misma ventana negra, escribe:
     ```
     npm install -g yarn
     ```
   - Presiona Enter y espera a que termine

---

### PASO 3: Instalar MongoDB

MongoDB es la base de datos donde se guardarán las vulnerabilidades.

1. **Ir a la página de MongoDB:**
   ```
   https://www.mongodb.com/try/download/community
   ```

2. **Descargar MongoDB:**
   - En "Version", deja la que está seleccionada (la más reciente)
   - En "Platform", selecciona **"Windows"**
   - En "Package", selecciona **"msi"**
   - Haz clic en el botón verde **"Download"**
   - Se descargará un archivo como `mongodb-windows-x86_64-7.0.x-signed.msi`

3. **Instalar MongoDB:**
   - Ve a tu carpeta de **Descargas**
   - Haz **doble clic** en el archivo `.msi` de MongoDB
   - Haz clic en **"Next"**
   - Acepta los términos de licencia y haz clic en **"Next"**
   - Selecciona **"Complete"** y haz clic en **"Next"**
   - **IMPORTANTE:** Asegúrate de que esté marcada la opción:
     ```
     ☑ Install MongoDB as a Service
     ```
   - Deja marcado **"Run service as Network Service user"**
   - Haz clic en **"Next"**
   - **Desmarca** la opción "Install MongoDB Compass" (no es necesario)
   - Haz clic en **"Next"** y luego en **"Install"**
   - Si aparece una ventana preguntando si permites cambios, haz clic en **"Sí"**
   - Espera a que termine y haz clic en **"Finish"**

4. **Verificar que MongoDB está corriendo:**
   - Presiona `Windows + R`
   - Escribe `services.msc` y presiona Enter
   - Se abrirá una ventana con una lista de servicios
   - Busca **"MongoDB Server"** en la lista
   - En la columna "Estado" debería decir **"En ejecución"**
   - Si no dice "En ejecución", haz clic derecho sobre él y selecciona **"Iniciar"**

---

## PARTE 2: DESCARGAR EL CÓDIGO DE SECFIND

### PASO 4: Descargar el código

1. **Opción A - Desde la plataforma Emergent:**
   - Si tienes acceso al proyecto en Emergent, haz clic en **"Download Code"**
   - Se descargará un archivo `.zip`
   - Ve a tu carpeta de **Descargas**
   - Haz clic derecho en el archivo `.zip`
   - Selecciona **"Extraer todo..."**
   - Elige una ubicación fácil de recordar, por ejemplo:
     ```
     C:\SecFind
     ```
   - Haz clic en **"Extraer"**

2. **Opción B - Crear la carpeta manualmente:**
   - Abre el **Explorador de archivos** (icono de carpeta en la barra de tareas)
   - Ve a **Este equipo** > **Disco local (C:)**
   - Haz clic derecho en un espacio vacío
   - Selecciona **Nuevo** > **Carpeta**
   - Nombra la carpeta `SecFind`

---

## PARTE 3: CONFIGURAR EL BACKEND (SERVIDOR)

### PASO 5: Abrir la terminal en la carpeta del proyecto

1. **Abrir el Explorador de archivos**
2. **Navegar a la carpeta del proyecto:**
   ```
   C:\SecFind
   ```
3. **Abrir terminal aquí:**
   - Haz clic en la barra de direcciones (donde dice `C:\SecFind`)
   - Borra todo lo que dice
   - Escribe `cmd` y presiona **Enter**
   - Se abrirá una ventana negra (terminal) en esa carpeta

### PASO 6: Configurar el Backend

1. **Entrar a la carpeta backend:**
   - En la terminal negra, escribe:
     ```
     cd backend
     ```
   - Presiona Enter

2. **Crear un entorno virtual:**
   - Escribe:
     ```
     python -m venv venv
     ```
   - Presiona Enter y espera unos segundos

3. **Activar el entorno virtual:**
   - Escribe:
     ```
     venv\Scripts\activate
     ```
   - Presiona Enter
   - Verás que ahora aparece `(venv)` al inicio de la línea

4. **Instalar las dependencias:**
   - Escribe:
     ```
     pip install -r requirements.txt
     ```
   - Presiona Enter
   - Espera a que se descarguen e instalen todos los paquetes (puede tardar 2-5 minutos)
   - Verás muchas líneas de texto, es normal

5. **Crear el archivo de configuración:**
   - Escribe estos comandos uno por uno:
     ```
     echo MONGO_URL="mongodb://localhost:27017" > .env
     echo DB_NAME="secfind_db" >> .env
     echo CORS_ORIGINS="http://localhost:3000" >> .env
     ```
   - Presiona Enter después de cada línea

6. **(OPCIONAL) Configurar importación de PDF con IA:**
   - Si quieres usar la funcionalidad de importar vulnerabilidades desde PDF, necesitas una API key
   - Escribe:
     ```
     echo EMERGENT_LLM_KEY="tu-api-key-aqui" >> .env
     ```
   - Reemplaza `tu-api-key-aqui` con tu API key real
   - **Sin esta key**, la importación de PDF no funcionará, pero todas las demás funciones sí

7. **Verificar que el archivo se creó:**
   - Escribe:
     ```
     type .env
     ```
   - Deberías ver las variables configuradas

---

## PARTE 4: CONFIGURAR EL FRONTEND (INTERFAZ WEB)

### PASO 7: Configurar el Frontend

1. **Abrir una NUEVA terminal:**
   - NO cierres la terminal anterior
   - Presiona `Windows + R`
   - Escribe `cmd` y presiona Enter

2. **Ir a la carpeta del frontend:**
   - Escribe:
     ```
     cd C:\SecFind\frontend
     ```
   - Presiona Enter

3. **⚠️ IMPORTANTE: Reemplazar index.html para instalación local:**
   - Copia el archivo `plantillas/instalacion_local/index.html`
   - Pégalo en `frontend/public/` reemplazando el existente
   - Esto elimina scripts de analytics externos que causan errores en instalaciones locales

4. **Instalar las dependencias:**
   - Escribe:
     ```
     yarn install
     ```
   - Presiona Enter
   - Espera a que termine (puede tardar 3-5 minutos)
   - Verás muchas líneas de texto descargando paquetes

5. **Crear el archivo de configuración:**
   - Escribe:
     ```
     echo REACT_APP_BACKEND_URL=http://localhost:8001 > .env
     ```
   - Presiona Enter

---

## PARTE 5: EJECUTAR LA APLICACIÓN

### PASO 8: Iniciar el Backend

1. **Volver a la terminal del backend** (la primera que abriste)
   - Si la cerraste, abre una nueva:
     - Presiona `Windows + R`, escribe `cmd`, presiona Enter
     - Escribe:
       ```
       cd C:\SecFind\backend
       venv\Scripts\activate
       ```

2. **Iniciar el servidor:**
   - Escribe:
     ```
     uvicorn server:app --host 0.0.0.0 --port 8001 --reload
     ```
   - Presiona Enter
   - Verás algo como:
     ```
     INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
     INFO:     Started reloader process
     INFO:     Started server process
     INFO:     Waiting for application startup.
     INFO:     Application startup complete.
     ```
   - **¡NO CIERRES ESTA VENTANA!** Debe quedarse abierta mientras uses la aplicación

### PASO 9: Iniciar el Frontend

1. **Ir a la terminal del frontend** (la segunda que abriste)
   - Si la cerraste, abre una nueva:
     - Presiona `Windows + R`, escribe `cmd`, presiona Enter
     - Escribe:
       ```
       cd C:\SecFind\frontend
       ```

2. **Iniciar la interfaz web:**
   - Escribe:
     ```
     yarn start
     ```
   - Presiona Enter
   - Espera unos segundos (30 segundos a 1 minuto)
   - Se abrirá automáticamente tu navegador con la aplicación
   - Si no se abre, abre manualmente el navegador y ve a:
     ```
     http://localhost:3000
     ```

---

## PARTE 6: USAR LA APLICACIÓN

### PASO 10: Importar tus datos de Excel

1. **Descarga la plantilla de Excel** desde la carpeta `plantillas/plantilla_vulnerabilidades.xlsx`
   - O usa tu propio archivo Excel con una hoja llamada "Consolidado"

2. **En la aplicación web**, haz clic en **"Vulnerabilidades"** en el menú de la izquierda

3. **Haz clic en el botón "Excel"** (con el icono de subir archivo)

4. **Selecciona tu archivo Excel** con las vulnerabilidades

5. **Espera** a que se importen los datos

6. **¡Listo!** Ahora puedes ver todas tus vulnerabilidades en el Dashboard

> **Nota:** Si una institución, aplicación, proveedor o informe no existe en los catálogos, el sistema los creará automáticamente.

---

## PARTE 7: CÓMO INICIAR LA APLICACIÓN CADA DÍA

Cada vez que quieras usar SecFind, necesitas iniciar los servidores:

### Método Rápido (Crear acceso directo):

1. **Crear archivo para iniciar Backend:**
   - Abre el **Bloc de notas**
   - Copia y pega este texto:
     ```batch
     @echo off
     cd C:\SecFind\backend
     call venv\Scripts\activate
     uvicorn server:app --host 0.0.0.0 --port 8001
     ```
   - Guarda el archivo como `IniciarBackend.bat` en el escritorio
   - **Importante:** En "Tipo", selecciona "Todos los archivos"

2. **Crear archivo para iniciar Frontend:**
   - Abre el **Bloc de notas**
   - Copia y pega este texto:
     ```batch
     @echo off
     cd C:\SecFind\frontend
     yarn start
     ```
   - Guarda el archivo como `IniciarFrontend.bat` en el escritorio

3. **Para iniciar la aplicación cada día:**
   - Haz doble clic en `IniciarBackend.bat` (se abrirá una ventana negra)
   - Espera 5 segundos
   - Haz doble clic en `IniciarFrontend.bat` (se abrirá otra ventana negra)
   - Abre el navegador y ve a `http://localhost:3000`

---

## SOLUCIÓN DE PROBLEMAS COMUNES

### Problema: "python no se reconoce como comando"
**Solución:**
1. Desinstala Python
2. Vuelve a instalarlo asegurándote de marcar "Add python.exe to PATH"
3. Reinicia la computadora

### Problema: "yarn no se reconoce como comando"
**Solución:**
1. Abre cmd como administrador (clic derecho > "Ejecutar como administrador")
2. Escribe: `npm install -g yarn`
3. Cierra y vuelve a abrir cmd

### Problema: "Error de conexión a MongoDB"
**Solución:**
1. Presiona `Windows + R`
2. Escribe `services.msc` y presiona Enter
3. Busca "MongoDB Server"
4. Si no está en ejecución, haz clic derecho > "Iniciar"

### Problema: "El navegador muestra error"
**Solución:**
1. Verifica que ambas ventanas negras estén abiertas (backend y frontend)
2. Espera 30 segundos y recarga la página (F5)

### Problema: "Error al importar Excel"
**Solución:**
1. Asegúrate de que el Excel tenga una hoja llamada "Consolidado"
2. O usa un archivo CSV simple

---

## CONTACTO DE SOPORTE

Si tienes problemas que no puedes resolver:
1. Toma una captura de pantalla del error
2. Anota qué paso estabas realizando
3. Contacta al equipo de soporte

---

## CREDENCIALES DE ACCESO

La aplicación crea automáticamente un usuario administrador al iniciar:

| Campo | Valor |
|-------|-------|
| **Usuario** | `admin` |
| **Contraseña** | `admin123` |

> **IMPORTANTE:** Cambia la contraseña del administrador después del primer inicio de sesión desde Configuración > Usuarios.

---

## RESUMEN DE URLS

| Servicio | URL |
|----------|-----|
| Aplicación Web | http://localhost:3000 |
| API Backend | http://localhost:8001 |
| Documentación API | http://localhost:8001/docs |

---

## FUNCIONALIDADES PRINCIPALES

### Dashboard
- **6 KPIs**: Total, Críticas Abiertas, Corregidas, Pendientes, En Proceso, Para Re Test
- Gráficos de pastel y barras
- Filtros por año, institución, severidad, proveedor, aplicación
- **Botón "Generar Reporte PDF"** para exportar reportes

### Reportes PDF
- **Reporte Ejecutivo**: KPIs + gráficos de pastel (severidad, estatus) + barras (instituciones)
- **Reporte por Institución**: Resumen + tabla de vulnerabilidades coloreada
- **Reporte por Informe Pentest**: Detalle de vulnerabilidades de un pentest
- **Reporte Vista Comité**: Tabla ejecutiva con selección de informes y severidades

### Vista Comité (Para Presentaciones)
- **Resumen ejecutivo por informe de pentest** (Alcance)
- **Ratios Pendiente/Total** por severidad
- **Tiempo Activo (meses)** desde el hallazgo más antiguo
- **Colores dinámicos** por porcentaje pendiente y antigüedad
- **Exportar a CSV** para análisis
- **Exportar a Imagen PNG** con fondo blanco para PowerPoint

### Auditoría del Sistema
- **Historial completo** de cambios en vulnerabilidades
- **Registro automático** de creación, actualización y eliminación
- **Detalle de cambios**: campo modificado, valor anterior, valor nuevo
- **Solo administradores** pueden acceder

### Gestión de Vulnerabilidades
- Búsqueda y filtros múltiples
- Importar desde Excel, CSV y **PDF con IA**
- Exportar a Excel y CSV
- **Acciones Masivas**:
  - Selección múltiple con checkboxes
  - Cambiar estatus de varias vulnerabilidades
  - Asignar responsable en lote
  - Actualizar fecha de compromiso en grupo

### Seguimiento de Riesgos
- Vulnerabilidades con fecha de compromiso
- Alertas de vencimiento
- Filtros por severidad, institución e **informe pentest**

### Configuración
- Instituciones, Aplicaciones, Proveedores, Informes Pentest
- **Responsables**: Catálogo con nombre y email para notificaciones
- Gestión de usuarios con permisos
- **Notificaciones por email**: Alertas de vencimiento configurables
- **Actualización en cascada**: Al renombrar elementos, las vulnerabilidades se actualizan automáticamente

---

## PLANTILLA DE EXCEL

Puedes descargar la plantilla de Excel para importar vulnerabilidades desde:
```
plantillas/plantilla_vulnerabilidades.xlsx
```

La plantilla incluye:
- Todos los campos necesarios con validaciones
- Ejemplos de datos
- Hoja de instrucciones detalladas

---

## IMPORTACIÓN DE PDF CON IA

Esta funcionalidad permite **extraer automáticamente** las vulnerabilidades de un informe de pentest en PDF.

### Cómo funciona:
1. Sube un PDF de informe de pentest
2. La IA extrae: nombre del informe, fecha, institución, proveedor
3. Extrae todas las vulnerabilidades con severidad, descripción, recomendaciones
4. Puedes revisar y editar cada vulnerabilidad antes de guardarla

### Requisito:
- Necesitas una API key configurada en `backend/.env`:
  ```
  EMERGENT_LLM_KEY="tu-api-key"
  ```

### Sin API key:
- La importación de PDF mostrará un error
- Todas las demás funcionalidades funcionan normalmente

---

**¡Felicidades!** Has instalado SecFind correctamente en tu computadora con Windows 11.
