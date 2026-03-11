# Guía de Instalación SecFind en Windows 11
## Para Principiantes - Paso a Paso Completo

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
   - Haz **doble clic** en el archivo `python-3.12.x-amd64.exe`
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

6. **Verificar que el archivo se creó:**
   - Escribe:
     ```
     type .env
     ```
   - Deberías ver:
     ```
     MONGO_URL="mongodb://localhost:27017"
     DB_NAME="secfind_db"
     CORS_ORIGINS="http://localhost:3000"
     ```

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

3. **Instalar las dependencias:**
   - Escribe:
     ```
     yarn install
     ```
   - Presiona Enter
   - Espera a que termine (puede tardar 3-5 minutos)
   - Verás muchas líneas de texto descargando paquetes

4. **Crear el archivo de configuración:**
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

1. **En la aplicación web**, haz clic en **"Vulnerabilidades"** en el menú de la izquierda

2. **Haz clic en el botón "Excel"** (con el icono de subir archivo)

3. **Selecciona tu archivo Excel** con las vulnerabilidades

4. **Espera** a que se importen los datos

5. **¡Listo!** Ahora puedes ver todas tus vulnerabilidades en el Dashboard

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

## RESUMEN DE URLS

| Servicio | URL |
|----------|-----|
| Aplicación Web | http://localhost:3000 |
| API Backend | http://localhost:8001 |
| Documentación API | http://localhost:8001/docs |

---

**¡Felicidades!** Has instalado SecFind correctamente en tu computadora con Windows 11.
