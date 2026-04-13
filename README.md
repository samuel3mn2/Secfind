# SecFind - Sistema de Gestión de Vulnerabilidades

Sistema web completo para la gestión de vulnerabilidades de ciberseguridad, diseñado para reemplazar flujos de trabajo basados en Excel. Incluye dashboard ejecutivo con KPIs, gráficos interactivos, módulo CRUD completo, seguimiento de riesgos, **Vista Comité para presentaciones ejecutivas** e importación inteligente desde PDF con IA.

![Dashboard](https://img.shields.io/badge/Dashboard-6%20KPIs%20%2B%20Gráficos-blue)
![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20MongoDB-green)
![Idioma](https://img.shields.io/badge/Idioma-Español-red)
![AI](https://img.shields.io/badge/AI-GPT--4.1--mini-purple)

---

## Características Principales

### Dashboard Ejecutivo
- **6 KPIs interactivos**: Total, Críticas Abiertas, Corregidas, Pendientes, En Proceso, Para Re Test
- **Click en KPIs** para ver el detalle de vulnerabilidades
- **Gráfico de evolución temporal** (mensual/trimestral)
- **Gráficos de pastel y barras** por Severidad, Estatus e Institución
- **6 filtros dinámicos**: Año, Institución, Informe Pentest, Severidad, Proveedor, Aplicación

### 🆕 Vista Comité (Para Presentaciones Ejecutivas)
- **Resumen por informe de pentest** (Alcance)
- **Ratios Pendiente/Total** por severidad (Crítico, Alto, Medio, Bajo)
- **Tiempo Activo (meses)** desde el hallazgo más antiguo
- **Colores dinámicos** por porcentaje y antigüedad
- **Filtros multi-select** por Alcance/Informe y Severidad
- **Exportar a CSV** para análisis
- **Exportar a Imagen PNG (fondo blanco)** para presentaciones PowerPoint

### Gestión de Vulnerabilidades
- Tabla CRUD con búsqueda y múltiples filtros
- Campos dropdown predefinidos desde catálogos
- Multi-select para aplicaciones
- Paginación

### Seguimiento de Riesgos
- Página dedicada para vulnerabilidades con fecha de compromiso
- KPIs: Vencidas, Próximos 7 días, Próximos 30 días
- Cálculo automático de días restantes
- Alertas visuales por estado
- Filtros por severidad, institución e **informe pentest**

### Módulo de Configuración
- **Instituciones**: Gestión de empresas/clientes
- **Aplicaciones**: Catálogo de sistemas evaluados
- **Proveedores**: Empresas de pentest
- **Informes Pentest**: Nombres de informes
- **Usuarios**: Gestión con permisos por módulo
- **🆕 Actualización en cascada**: Al renombrar instituciones, aplicaciones, proveedores o informes, las vulnerabilidades se actualizan automáticamente

### Importar/Exportar
- Exportar a CSV y Excel
- Importar desde CSV y Excel
- **🆕 Importar desde PDF con IA** (extrae vulnerabilidades automáticamente)

---

## Requisitos Previos

### Software necesario:
| Software | Versión Mínima | Verificar |
|----------|----------------|-----------|
| Python | 3.9+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| Yarn | 1.22+ | `yarn --version` |
| MongoDB | 6.0+ | `mongod --version` |

### API Key para Importación de PDF (Opcional)
La funcionalidad de **importar vulnerabilidades desde PDF** utiliza IA (GPT-4.1-mini). Para usarla necesitas:
- Una API key de OpenAI, o
- Una API key de Emergent (si usas emergentintegrations)

> **Nota**: Si no configuras la API key, todas las demás funcionalidades funcionarán normalmente. Solo la importación de PDF estará deshabilitada.

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
# Linux
sudo systemctl start mongod

# Mac con Homebrew
brew services start mongodb-community

# Verificar conexión
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
source venv/bin/activate     # Linux/Mac
# .\venv\Scripts\activate    # Windows

# Instalar dependencias
pip install -r requirements.txt
```

#### Variables de entorno del Backend:
Crear archivo `backend/.env`:
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="secfind_db"
CORS_ORIGINS="http://localhost:3000"

# OPCIONAL: Para importación de PDF con IA
# Opción 1: API Key de OpenAI directa
# OPENAI_API_KEY="sk-..."

# Opción 2: API Key de Emergent (si usas emergentintegrations)
# EMERGENT_LLM_KEY="sk-emergent-..."
```

### 4. Configurar el Frontend

```bash
cd ../frontend

# Instalar dependencias
yarn install
```

#### Variables de entorno del Frontend:
Crear archivo `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## Ejecutar la Aplicación

### Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate  # Linux/Mac
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Backend disponible en: `http://localhost:8001`

### Terminal 2 - Frontend:
```bash
cd frontend
yarn start
```
Frontend disponible en: `http://localhost:3000`

### Credenciales por Defecto
- **Usuario**: `admin`
- **Contraseña**: `admin123`

---

## Estructura del Proyecto

```
secfind/
├── backend/
│   ├── server.py              # API FastAPI (todos los endpoints)
│   ├── requirements.txt       # Dependencias Python
│   └── .env                   # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx          # Dashboard con KPIs
│   │   │   ├── Vulnerabilidades.jsx   # CRUD de vulnerabilidades
│   │   │   ├── SeguimientoRiesgos.jsx # Seguimiento de fechas
│   │   │   ├── VistaComite.jsx        # Vista ejecutiva para comités
│   │   │   ├── Configuracion.jsx      # Módulo de configuración
│   │   │   ├── ImportarPDF.jsx        # Importación con IA
│   │   │   ├── Instituciones.jsx
│   │   │   ├── Aplicaciones.jsx
│   │   │   ├── Proveedores.jsx
│   │   │   ├── InformesPentest.jsx
│   │   │   ├── Usuarios.jsx
│   │   │   └── Login.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   └── ui/                    # Componentes Shadcn
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Autenticación
│   │   └── App.js
│   ├── package.json
│   └── .env
├── README.md
└── INSTALACION_WINDOWS.md
```

---

## API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |

### Vulnerabilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vulnerabilidades` | Listar con filtros |
| POST | `/api/vulnerabilidades` | Crear vulnerabilidad |
| PUT | `/api/vulnerabilidades/{id}` | Actualizar |
| DELETE | `/api/vulnerabilidades/{id}` | Eliminar |

### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | KPIs con filtros |
| GET | `/api/dashboard/tendencias` | Evolución temporal |
| GET | `/api/dashboard/kpi-detail` | Detalle de KPIs |

### Seguimiento de Riesgos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/seguimiento-riesgos` | Vulnerabilidades con fecha compromiso |
| GET | `/api/seguimiento-riesgos/resumen` | KPIs de seguimiento |

### Vista Comité
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vista-comite` | Agregación por informe (Alcance) |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST/PUT/DELETE | `/api/config/instituciones` | CRUD Instituciones |
| GET/POST/PUT/DELETE | `/api/config/aplicaciones` | CRUD Aplicaciones |
| GET/POST/PUT/DELETE | `/api/config/proveedores` | CRUD Proveedores |
| GET/POST/PUT/DELETE | `/api/config/informes-pentest` | CRUD Informes |
| GET/POST/PUT/DELETE | `/api/users` | CRUD Usuarios |

### Importar/Exportar
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/export/csv` | Exportar a CSV |
| GET | `/api/export/excel` | Exportar a Excel |
| POST | `/api/import/csv` | Importar CSV |
| POST | `/api/import/excel` | Importar Excel |
| POST | `/api/import/pdf/extract` | **Extraer de PDF con IA** |
| POST | `/api/import/pdf/add-vulnerability` | Agregar vulnerabilidad de PDF |

---

## Importación desde PDF con IA

### Cómo funciona
1. Sube un informe de pentest en PDF
2. El sistema extrae automáticamente:
   - Nombre del informe, fecha, institución, proveedor
   - Aplicación evaluada
   - Todas las vulnerabilidades con severidad, descripción y recomendaciones
3. Revisa y edita cada vulnerabilidad antes de agregarla
4. El sistema detecta elementos nuevos (aplicaciones, proveedores, etc.) y te permite agregarlos al catálogo

### Requisitos
- API Key configurada en `backend/.env`
- El PDF debe ser un informe de pentest estructurado

### Sin API Key
Si no configuras la API key:
- El botón "PDF" aparecerá pero mostrará un error al intentar procesar
- Todas las demás funcionalidades (importar Excel/CSV, CRUD, etc.) funcionan normalmente

---

## Despliegue en Producción

### Con Docker Compose

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
      - CORS_ORIGINS=http://tu-dominio.com
      # Opcional para PDF:
      # - EMERGENT_LLM_KEY=sk-emergent-...
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://tu-dominio.com:8001

volumes:
  mongo_data:
```

```bash
docker-compose up -d
```

### Con Nginx como Reverse Proxy

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
sudo systemctl status mongod
sudo systemctl restart mongod
```

### Error de CORS
Verificar que `CORS_ORIGINS` en `backend/.env` incluya la URL del frontend.

### Error en importación de PDF
- Verificar que `EMERGENT_LLM_KEY` o `OPENAI_API_KEY` está configurada
- El PDF debe ser legible (no escaneado como imagen)

### Dependencias
```bash
# Backend
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall

# Frontend
rm -rf node_modules yarn.lock
yarn install
```

---

## Modelo de Datos

### Vulnerabilidad
| Campo | Tipo | Descripción |
|-------|------|-------------|
| fecha_hallazgo | Date | Fecha de descubrimiento |
| institucion | String | Empresa afectada |
| aplicaciones | Array | Sistemas/aplicaciones afectadas |
| vulnerabilidad | String | Título de la vulnerabilidad |
| descripcion_riesgo | Text | Descripción detallada |
| recomendaciones | Text | Acciones para remediar |
| severidad | Enum | Critica, Alta, Media, Baja |
| estatus | Enum | Estado actual |
| responsable | String | Persona asignada |
| fecha_compromiso | Date | Fecha límite |
| nombre_informe_pentest | String | Informe de origen |
| proveedor | String | Empresa de pentest |

### Valores de Enums

**Severidad**: Critica, Alta, Media, Baja

**Estatus**: En Proceso, Cerrado, Pendiente, Para Re Test, Corregido, Desestimado

**Resultado Re Test**: Corregido, Pendiente, Impedimento, Vulnerable, Desestimado

---

## Licencia

Este proyecto es de uso interno para gestión de vulnerabilidades de ciberseguridad.

---

## Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.
