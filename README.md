# SecFind - Sistema de Gestión de Vulnerabilidades

Sistema web para la gestión de vulnerabilidades de ciberseguridad, diseñado para reemplazar flujos de trabajo basados en Excel. Incluye dashboard ejecutivo con KPIs, gráficos interactivos y módulo CRUD completo.

![Dashboard](https://img.shields.io/badge/Dashboard-KPIs%20%2B%20Gráficos-blue)
![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20MongoDB-green)
![Idioma](https://img.shields.io/badge/Idioma-Español-red)

## Características

### Dashboard Ejecutivo
- **KPIs interactivos**: Total, Críticas Abiertas, Corregidas, Pendientes
- **Click en KPIs** para ver el detalle de vulnerabilidades
- **Gráfico de evolución temporal** (mensual/trimestral)
- **Gráfico de pastel** por Severidad
- **Gráfico de barras** por Estatus e Institución
- **5 filtros dinámicos**: Año, Institución, Informe Pentest, Severidad, Proveedor

### Gestión de Vulnerabilidades
- Tabla CRUD con búsqueda y filtros
- Crear, editar y eliminar vulnerabilidades
- Campos dropdown predefinidos
- Paginación

### Módulo de Configuración
- Gestión dinámica de instituciones
- Activar/Desactivar instituciones

### Importar/Exportar
- Exportar a CSV y Excel
- Importar desde CSV y Excel

---

## Requisitos Previos

### Software necesario:
- **Python 3.9+**
- **Node.js 18+** y **Yarn**
- **MongoDB 6.0+**

### Verificar instalaciones:
```bash
python3 --version    # Python 3.9+
node --version       # v18+
yarn --version       # 1.22+
mongod --version     # 6.0+
```

---

## Instalación Local

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd secfind
```

### 2. Configurar MongoDB

#### Opción A: MongoDB Local
```bash
# Iniciar MongoDB (Linux/Mac)
sudo systemctl start mongod

# o en Mac con Homebrew
brew services start mongodb-community

# Verificar que está corriendo
mongosh --eval "db.runCommand({ ping: 1 })"
```

#### Opción B: MongoDB Atlas (Cloud)
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear un cluster gratuito
3. Obtener la URL de conexión

### 3. Configurar el Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# Linux/Mac:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

#### Configurar variables de entorno:
```bash
# Crear archivo .env
cat > .env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="secfind_db"
CORS_ORIGINS="http://localhost:3000"
EOF
```

> **Nota**: Si usas MongoDB Atlas, reemplaza `MONGO_URL` con tu URL de conexión.

### 4. Configurar el Frontend

```bash
cd ../frontend

# Instalar dependencias
yarn install
```

#### Configurar variables de entorno:
```bash
# Crear archivo .env
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

---

## Ejecutar la Aplicación

### Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate  # Windows

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

El backend estará disponible en: `http://localhost:8001`

### Terminal 2 - Frontend:
```bash
cd frontend
yarn start
```

El frontend estará disponible en: `http://localhost:3000`

---

## Importar Datos Iniciales

### Opción 1: Desde la interfaz web
1. Ir a **Vulnerabilidades** > **Importar Excel**
2. Seleccionar tu archivo `.xlsx` o `.csv`

### Opción 2: Script de importación
```bash
cd backend
source venv/bin/activate

python3 << 'EOF'
import pandas as pd
from pymongo import MongoClient
import uuid
from datetime import datetime, timezone

client = MongoClient("mongodb://localhost:27017")
db = client["secfind_db"]

# Leer Excel
df = pd.read_excel("tu_archivo.xlsx", sheet_name="Consolidado")

# Mapear columnas
column_mapping = {
    'Fecha Hallazgo': 'fecha_hallazgo',
    'Institucion': 'institucion',
    'Aplicacion': 'aplicacion',
    'Vulnerabilidad': 'vulnerabilidad',
    'Recomendaciones': 'recomendaciones',
    'Severidad': 'severidad',
    'Riesgo Asociado': 'riesgo_asociado',
    'Descripcion del riesgo': 'descripcion_riesgo',
    'Responsable': 'responsable',
    'Fecha de Compromiso': 'fecha_compromiso',
    'Estatus': 'estatus',
    'Resultado Re Test': 'resultado_re_test',
    'Nombre informe de pentest': 'nombre_informe_pentest',
    'Proveedor': 'proveedor'
}
df = df.rename(columns=column_mapping)

# Insertar registros
for _, row in df.iterrows():
    record = {k: (None if pd.isna(v) else str(v)) for k, v in row.items()}
    record['id'] = str(uuid.uuid4())
    record['created_at'] = datetime.now(timezone.utc).isoformat()
    record['updated_at'] = datetime.now(timezone.utc).isoformat()
    db.vulnerabilidades.insert_one(record)

print(f"Importados {len(df)} registros")
EOF
```

---

## Estructura del Proyecto

```
secfind/
├── backend/
│   ├── server.py          # API FastAPI
│   ├── requirements.txt   # Dependencias Python
│   └── .env              # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Vulnerabilidades.jsx
│   │   │   └── Configuracion.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── ui/        # Componentes Shadcn
│   │   ├── App.js
│   │   └── index.css
│   ├── package.json
│   └── .env
└── README.md
```

---

## API Endpoints

### Vulnerabilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vulnerabilidades` | Listar vulnerabilidades |
| POST | `/api/vulnerabilidades` | Crear vulnerabilidad |
| PUT | `/api/vulnerabilidades/{id}` | Actualizar vulnerabilidad |
| DELETE | `/api/vulnerabilidades/{id}` | Eliminar vulnerabilidad |

### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Estadísticas con filtros |
| GET | `/api/dashboard/tendencias` | Evolución temporal |
| GET | `/api/dashboard/kpi-detail` | Detalle de KPIs |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/config/instituciones` | Listar instituciones |
| POST | `/api/config/instituciones` | Crear institución |
| PUT | `/api/config/instituciones/{id}` | Actualizar institución |
| DELETE | `/api/config/instituciones/{id}` | Eliminar institución |

### Importar/Exportar
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/export/csv` | Exportar a CSV |
| GET | `/api/export/excel` | Exportar a Excel |
| POST | `/api/import/csv` | Importar CSV |
| POST | `/api/import/excel` | Importar Excel |

---

## Campos del Modelo de Vulnerabilidad

| Campo | Tipo | Descripción |
|-------|------|-------------|
| fecha_hallazgo | Date | Fecha de descubrimiento |
| institucion | Select | Empresa afectada |
| aplicacion | String | Sistema/aplicación |
| vulnerabilidad | Text | Descripción de la vulnerabilidad |
| recomendaciones | Text | Acciones recomendadas |
| severidad | Select | Critica, Alta, Media, Baja |
| riesgo_asociado | String | Riesgo de negocio |
| descripcion_riesgo | Text | Detalle del riesgo |
| responsable | String | Persona asignada |
| fecha_compromiso | Date | Fecha límite de corrección |
| estatus | Select | Estado actual |
| resultado_re_test | Select | Resultado de verificación |
| nombre_informe_pentest | String | Informe de origen |
| proveedor | String | Empresa de pentest |

### Valores de Dropdowns

**Severidad:** Critica, Alta, Media, Baja

**Estatus:** En Proceso, Cerrado, Pendiente, Para Re Test, Corregido, Desestimado

**Resultado Re Test:** Corregido, Pendiente, Impedimento, Vulnerable, Desestimado

---

## Despliegue en Producción

### Usando Docker (Recomendado)

```dockerfile
# Dockerfile para backend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mongodb:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=secfind_db
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001

volumes:
  mongo_data:
```

```bash
docker-compose up -d
```

### Usando Nginx como Reverse Proxy

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location /api {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Solución de Problemas

### MongoDB no conecta
```bash
# Verificar que MongoDB está corriendo
sudo systemctl status mongod

# Reiniciar MongoDB
sudo systemctl restart mongod
```

### Error de CORS
Verificar que `CORS_ORIGINS` en `backend/.env` incluya la URL del frontend.

### Dependencias de Python
```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### Dependencias de Node
```bash
rm -rf node_modules yarn.lock
yarn install
```

---

## Licencia

Este proyecto es de uso interno para gestión de vulnerabilidades de ciberseguridad.

---

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.
