# SecFind - Instalación Local

## Requisitos Previos
- Python 3.11+
- Node.js 18+
- MongoDB 6.0+

## Instalación del Backend

### 1. Crear entorno virtual
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 2. Instalar dependencias
**IMPORTANTE**: Use el archivo `requirements-local.txt` para instalación local:

```bash
pip install -r requirements-local.txt
```

> **Nota**: El archivo `requirements.txt` incluye `emergentintegrations` que solo está disponible en la plataforma Emergent. Use `requirements-local.txt` para instalaciones locales.

### 3. Configurar variables de entorno
Cree un archivo `.env` en la carpeta `backend`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=secfind_db
CORS_ORIGINS=http://localhost:3000

# Para usar la importación de PDF con IA (OPCIONAL)
# Obtenga su API key en: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-key-here
```

### 4. Iniciar el servidor
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

## Instalación del Frontend

### 1. Instalar dependencias
```bash
cd frontend
npm install
# o
yarn install
```

### 2. Configurar variables de entorno
Cree un archivo `.env` en la carpeta `frontend`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 3. Iniciar el servidor de desarrollo
```bash
npm start
# o
yarn start
```

## Funcionalidades disponibles

### Sin OPENAI_API_KEY:
- ✅ Dashboard con KPIs
- ✅ CRUD de vulnerabilidades
- ✅ Importación desde Excel/CSV
- ✅ Exportación a Excel/CSV/PDF
- ✅ Gestión de usuarios y permisos
- ✅ Catálogos (Aplicaciones, Instituciones, etc.)
- ✅ Vista Comité
- ✅ Seguimiento de Riesgos
- ✅ Historial de Auditoría
- ✅ Notificaciones por email

### Con OPENAI_API_KEY:
- ✅ Todo lo anterior
- ✅ **Importación de PDF con IA**: Extrae vulnerabilidades automáticamente de informes de pentest en PDF

## Notas importantes

1. **Base de datos**: Asegúrese de que MongoDB esté corriendo antes de iniciar el backend.

2. **Usuario inicial**: Al iniciar por primera vez, se crea automáticamente un usuario administrador:
   - Usuario: `admin`
   - Contraseña: `admin123`
   - **Importante**: Cambie la contraseña inmediatamente después del primer inicio de sesión.

3. **Importación de PDF**: Esta funcionalidad requiere una API key de OpenAI (modelo GPT-4o-mini). Sin esta key, aún puede importar vulnerabilidades mediante archivos Excel/CSV.

## Solución de problemas

### Error: "No matching distribution found for emergentintegrations"
Use `requirements-local.txt` en lugar de `requirements.txt`:
```bash
pip install -r requirements-local.txt
```

### Error: "OPENAI_API_KEY not configured"
Este error aparece solo si intenta usar la importación de PDF con IA. Configure la variable `OPENAI_API_KEY` en su archivo `.env` o use la importación por Excel/CSV.

### Error de conexión a MongoDB
Verifique que MongoDB esté corriendo:
```bash
# Windows (si instalado como servicio)
net start MongoDB

# Linux
sudo systemctl start mongod
```
