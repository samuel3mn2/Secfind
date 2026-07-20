# SecFind - Sistema de Gestión de Vulnerabilidades y GRC

Sistema web completo para la gestión de vulnerabilidades de ciberseguridad y Gobernanza, Riesgo y Cumplimiento (GRC). Diseñado para reemplazar flujos de trabajo basados en Excel. Incluye dashboard ejecutivo, **Dashboard GRC Unificado**, módulo CRUD completo, seguimiento de riesgos, catálogos GRC (Dominios, Controles, Riesgos), **Vista Comité**, **reportes PDF**, **auditoría del sistema**, **notificaciones por email** e importación inteligente desde PDF con IA.

![Dashboard](https://img.shields.io/badge/Dashboard-6%20KPIs%20%2B%20Gráficos-blue)
![GRC](https://img.shields.io/badge/GRC-Matriz%204x4%20Unificada-orange)
![Stack](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React%20%2B%20MongoDB-green)
![Idioma](https://img.shields.io/badge/Idioma-Español-red)
![AI](https://img.shields.io/badge/AI-GPT--4o--mini-purple)

---

## Características Principales

### Dashboard GRC Unificado (NUEVO)
- **Matriz de Riesgo 4x4** unificada (Probabilidad × Impacto)
- **Switch de visualización**: Combinado, Solo Vulnerabilidades, Solo Hallazgos
- **Colores rígidos por zona**: Verde (Bajo), Amarillo (Medio), Naranja (Alto), Rojo (Crítico)
- **4 KPIs**: Vulnerabilidades Activas, Hallazgos Abiertos, Índice de Exposición, Riesgo Promedio
- **Panel de Severidad** con gráfico de barras horizontal
- **Top 5 Dominios** con carga combinada
- **Filtros multi-select**: Informes, Dominios, Responsables, Estados
- **Sistema de Vistas Guardadas** (públicas y privadas)

### Dashboard Ejecutivo
- **6 KPIs interactivos**: Total, Críticas Abiertas, Corregidas, Pendientes, En Proceso, Para Re Test
- **Click en KPIs** para ver el detalle de vulnerabilidades
- **Gráfico de evolución temporal** (mensual/trimestral)
- **Gráficos de pastel y barras** por Severidad, Estatus e Institución
- **6 filtros dinámicos**: Año, Institución, Informe Pentest, Severidad, Proveedor, Aplicación

### Catálogos GRC (NUEVO)
- **Dominios**: Catálogo de dominios de seguridad
- **Controles**: Catálogo de controles asociados a dominios
- **Catálogo de Riesgos**: Riesgos con código, nombre corto y descripción
- **Hallazgos de Auditoría**: Gestión de hallazgos con probabilidad e impacto

### Gestión de Vulnerabilidades
- Tabla CRUD con búsqueda por **código**, texto, aplicación, responsable
- **Selector de columnas** configurable (18 columnas disponibles)
- Multi-select para aplicaciones
- **Nivel de Riesgo GRC**: Bajo, Medio, Medio Alto, Alto
- **Acciones Masivas**:
  - Cambiar estatus de múltiples vulnerabilidades
  - Asignar responsable en lote
  - Actualizar fecha de compromiso
  - **Incrementar Veces Retest** (+N a seleccionados)
  - Eliminación masiva con confirmación

### Exportación Avanzada
- **Excel y CSV** con todas las columnas seleccionadas:
  - Código, Fecha, Institución, Aplicaciones, Vulnerabilidad
  - Recomendaciones, Severidad, Nivel Riesgo, Estatus
  - Responsable, Dominio, Control Asociado, **Riesgo Catálogo**
  - Veces Retest, Informe Pentest, Proveedor

### Reportes PDF
- **Reporte Ejecutivo**: KPIs + gráficos
- **Reporte por Institución**: Resumen + tabla con colores
- **Reporte por Informe Pentest**: Detalle de vulnerabilidades
- **Reporte Vista Comité**: Tabla ejecutiva

### Vista Comité
- Resumen por informe de pentest (Alcance)
- Ratios Pendiente/Total por severidad
- Exportar a CSV e Imagen PNG

### Auditoría del Sistema
- Historial completo de cambios
- Registro automático de creación, actualización y eliminación
- Detalle: campo modificado, valor anterior, valor nuevo

### Notificaciones por Email
- Configuración SMTP flexible
- Alertas configurables: 7, 3, 1 días antes del vencimiento
- Resumen semanal automático

---

## API Endpoints Completos

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener usuario actual |
| POST | `/api/auth/change-password` | Cambiar contraseña |

### Vulnerabilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vulnerabilidades` | Listar con filtros (incluye búsqueda por código) |
| GET | `/api/vulnerabilidades/{id}` | Obtener una vulnerabilidad |
| POST | `/api/vulnerabilidades` | Crear vulnerabilidad |
| PUT | `/api/vulnerabilidades/{id}` | Actualizar vulnerabilidad |
| DELETE | `/api/vulnerabilidades/{id}` | Eliminar vulnerabilidad |
| POST | `/api/vulnerabilidades/verificar-duplicado` | Verificar duplicados |
| POST | `/api/vulnerabilidades/bulk-update` | **Acciones masivas** (estatus, responsable, fecha, +retest) |
| POST | `/api/vulnerabilidades/bulk-delete` | Eliminación masiva |
| DELETE | `/api/vulnerabilidades` | Eliminar todas (admin) |

### Dashboard GRC (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/data` | Datos del Dashboard GRC unificado |
| GET | `/api/dashboard/vistas` | Listar vistas guardadas |
| POST | `/api/dashboard/vistas` | Crear vista guardada |
| DELETE | `/api/dashboard/vistas/{id}` | Eliminar vista |

### Dashboard Ejecutivo
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | KPIs con filtros |
| GET | `/api/dashboard/tendencias` | Evolución temporal |
| GET | `/api/dashboard/kpi-detail` | Detalle de KPIs |

### Dominios GRC (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dominios` | Listar dominios |
| POST | `/api/dominios` | Crear dominio |
| PUT | `/api/dominios/{id}` | Actualizar dominio |
| DELETE | `/api/dominios/{id}` | Eliminar dominio |

### Controles GRC (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/controles` | Listar controles |
| POST | `/api/controles` | Crear control |
| PUT | `/api/controles/{id}` | Actualizar control |
| DELETE | `/api/controles/{id}` | Eliminar control |

### Catálogo de Riesgos (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/catalogo-riesgos` | Listar riesgos |
| POST | `/api/catalogo-riesgos` | Crear riesgo |
| PUT | `/api/catalogo-riesgos/{id}` | Actualizar riesgo |
| DELETE | `/api/catalogo-riesgos/{id}` | Eliminar riesgo |

### Hallazgos de Auditoría (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/hallazgos-auditoria` | Listar hallazgos |
| POST | `/api/hallazgos-auditoria` | Crear hallazgo |
| PUT | `/api/hallazgos-auditoria/{id}` | Actualizar hallazgo |
| DELETE | `/api/hallazgos-auditoria/{id}` | Eliminar hallazgo |

### Administración GRC (NUEVO)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/admin/bulk-associate-grc` | **Mapeo masivo de vulnerabilidades a Dominios/Riesgos** |
| POST | `/api/admin/migrate-nivel-riesgo` | Migrar nivel de riesgo |
| POST | `/api/admin/migrate-nivel-riesgo-all` | Migrar todos los niveles |
| GET | `/api/admin/nivel-riesgo-stats` | Estadísticas de nivel de riesgo |

### Reportes PDF
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/reportes/ejecutivo` | Reporte ejecutivo |
| GET | `/api/reportes/institucion/{nombre}` | Reporte por institución |
| GET | `/api/reportes/informe/{nombre}` | Reporte por informe pentest |
| GET | `/api/reportes/vista-comite` | Reporte Vista Comité |

### Vista Comité
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vista-comite` | Agregación por informe |

### Seguimiento de Riesgos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/seguimiento-riesgos` | Vulnerabilidades con fecha compromiso |
| GET | `/api/seguimiento-riesgos/resumen` | KPIs de seguimiento |

### Auditoría
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/historial` | Historial de cambios (solo admin) |

### Configuración
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| CRUD | `/api/config/instituciones` | Instituciones |
| CRUD | `/api/config/aplicaciones` | Aplicaciones |
| CRUD | `/api/config/proveedores` | Proveedores |
| CRUD | `/api/config/informes-pentest` | Informes Pentest |
| CRUD | `/api/config/responsables` | Responsables (con email) |
| CRUD | `/api/config/usuarios` | Usuarios y permisos |
| CRUD | `/api/config/grupos-informes` | Grupos de informes |
| GET | `/api/config/informes-sin-grupo` | Informes sin grupo |
| GET/PUT | `/api/config/notificaciones` | Config notificaciones email |
| POST | `/api/config/notificaciones/test` | Probar conexión SMTP |
| POST | `/api/config/notificaciones/send-test-email` | Enviar email de prueba |

### Vistas Guardadas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/vistas-guardadas` | Listar vistas |
| POST | `/api/vistas-guardadas` | Crear vista |
| PUT | `/api/vistas-guardadas/{id}` | Actualizar vista |
| DELETE | `/api/vistas-guardadas/{id}` | Eliminar vista |

### Notificaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/notificaciones/ejecutar` | Ejecutar alertas manualmente |
| POST | `/api/notificaciones/resumen-semanal` | Enviar resumen semanal |

### Importar/Exportar
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/export/csv` | Exportar a CSV (con columnas seleccionadas) |
| GET | `/api/export/excel` | Exportar a Excel (con columnas seleccionadas) |
| POST | `/api/import/csv` | Importar CSV |
| POST | `/api/import/excel` | Importar Excel |
| POST | `/api/import/pdf/extract` | Extraer de PDF con IA |
| POST | `/api/import/pdf/extract-rules` | Extraer reglas de PDF |
| POST | `/api/import/pdf/add-vulnerability` | Agregar vulnerabilidad de PDF |
| POST | `/api/import/pdf/add-catalog-items` | Agregar items al catálogo |

### Utilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dropdown-options` | Opciones para dropdowns |
| GET | `/api/` | Health check |

---

## Mapeo GRC Masivo

### Endpoint: `POST /api/admin/bulk-associate-grc`

Permite asociar vulnerabilidades a Dominios y Riesgos del catálogo usando un archivo JSON.

**Formato del JSON:**
```json
{
  "items": [
    {
      "CodigoDeVulns": "VULN_EA_CTCE_1",
      "Dominio": "Seguridad de Aplicaciones",
      "Riesgo": "Acceso a cuentas sin validación de identidad"
    }
  ]
}
```

**Pasos para usar:**
1. Crear Excel con columnas: `CodigoDeVulns`, `Dominio`, `Riesgo`
2. Convertir a JSON usando script Python
3. Login para obtener token
4. Enviar con curl: `curl -X POST .../api/admin/bulk-associate-grc -d @mapeo.json`

**Respuesta:**
```json
{
  "procesados": 100,
  "exitosos": 94,
  "vulnerabilidad_no_encontrada": 6,
  "dominio_creado": 4,
  "riesgo_creado": 87
}
```

---

## Modelo de Datos

### Vulnerabilidad
| Campo | Tipo | Descripción |
|-------|------|-------------|
| codigo | String | Código único (ej: VULN_EA_CTCE_1) |
| fecha_hallazgo | Date | Fecha de descubrimiento |
| institucion | String | Empresa afectada |
| aplicaciones | Array | Sistemas afectados |
| vulnerabilidad | String | Título |
| recomendaciones | Text | Acciones para remediar |
| severidad | Enum | Critica, Alta, Media, Baja |
| **nivel_riesgo** | Enum | **Bajo, Medio, Medio Alto, Alto** |
| estatus | Enum | Estado actual |
| responsable | String | Persona asignada |
| fecha_compromiso | Date | Fecha límite |
| **dominio_id** | String | **Referencia a Dominio GRC** |
| **riesgo_id** | String | **Referencia a Catálogo de Riesgos** |
| veces_en_retest | Number | Contador de retests |

### Valores de Enums

**Severidad**: Critica, Alta, Media, Baja

**Nivel Riesgo GRC**: Bajo, Medio, Medio Alto, Alto

**Estatus**: En Proceso, Cerrado, Pendiente, Para Re Test, Corregido, Desestimado

---

## Requisitos e Instalación

### Software Necesario

| Software | Versión Mínima | Descarga |
|----------|----------------|----------|
| Python | 3.9+ | [python.org](https://www.python.org/downloads/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| MongoDB | 6.0+ | [mongodb.com](https://www.mongodb.com/try/download/community) |
| Git | 2.30+ | [git-scm.com](https://git-scm.com/downloads) |

---

## 🪟 Instalación en Windows

### Paso 1: Instalar Prerequisitos

1. **Python 3.9+**
   - Descargar desde [python.org](https://www.python.org/downloads/windows/)
   - **IMPORTANTE**: Marcar ✅ "Add Python to PATH" durante la instalación
   - Verificar: Abrir CMD y ejecutar `python --version`

2. **Node.js 18+**
   - Descargar LTS desde [nodejs.org](https://nodejs.org/)
   - Instalar con opciones por defecto
   - Verificar: `node --version` y `npm --version`

3. **MongoDB 6.0+**
   - Descargar Community Server desde [mongodb.com](https://www.mongodb.com/try/download/community)
   - Seleccionar "Complete" durante instalación
   - Marcar ✅ "Install MongoDB as a Service"
   - El servicio inicia automáticamente en `localhost:27017`

4. **Yarn (Gestor de paquetes)**
   ```cmd
   npm install -g yarn
   ```

### Paso 2: Clonar el Repositorio

```cmd
git clone https://github.com/TU_USUARIO/secfind.git
cd secfind
```

### Paso 3: Configurar Backend

```cmd
cd backend

:: Crear entorno virtual
python -m venv venv

:: Activar entorno virtual (Windows CMD)
venv\Scripts\activate.bat

:: Activar entorno virtual (Windows PowerShell)
.\venv\Scripts\Activate.ps1

:: Instalar dependencias
pip install -r requirements.txt
```

### Paso 4: Configurar Variables de Entorno (Backend)

Crear archivo `backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=secfind
SECRET_KEY=tu_clave_secreta_aqui_cambiar_en_produccion
```

### Paso 5: Configurar Frontend

```cmd
cd ..\frontend

:: Instalar dependencias
yarn install
```

### Paso 6: Configurar Variables de Entorno (Frontend)

Crear archivo `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Paso 7: Ejecutar la Aplicación

**Terminal 1 - Backend:**
```cmd
cd backend
venv\Scripts\activate.bat
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 - Frontend:**
```cmd
cd frontend
yarn start
```

### Paso 8: Acceder a la Aplicación

- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8001/docs
- **Credenciales**: `admin` / `admin123`

---

## 🍎 Instalación en macOS

### Paso 1: Instalar Prerequisitos con Homebrew

```bash
# Instalar Homebrew si no lo tienes
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar dependencias
brew install python@3.11 node@18 mongodb-community@7.0 git

# Iniciar MongoDB
brew services start mongodb-community@7.0

# Instalar Yarn
npm install -g yarn
```

### Paso 2: Clonar y Configurar

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/secfind.git
cd secfind

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=secfind
SECRET_KEY=tu_clave_secreta_aqui
EOF

# Frontend
cd ../frontend
yarn install

# Crear .env
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

### Paso 3: Ejecutar

```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd frontend && yarn start
```

---

## 🐧 Instalación en Linux (Ubuntu/Debian)

### Paso 1: Instalar Prerequisitos

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Python
sudo apt install python3.11 python3.11-venv python3-pip -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Instalar MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install mongodb-org -y

# Iniciar MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Instalar Yarn
npm install -g yarn

# Instalar Git
sudo apt install git -y
```

### Paso 2: Clonar y Configurar

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/secfind.git
cd secfind

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=secfind
SECRET_KEY=tu_clave_secreta_aqui
EOF

# Frontend
cd ../frontend
yarn install

# Crear .env
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

### Paso 3: Ejecutar

```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend
cd frontend && yarn start
```

---

## 🐳 Instalación con Docker (Recomendado para Producción)

### docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: secfind-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: secfind-backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=secfind
      - SECRET_KEY=${SECRET_KEY:-cambiar_en_produccion}
    depends_on:
      - mongodb
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: secfind-frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mongo_data:
```

### Ejecutar con Docker

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## ⚠️ Solución de Problemas Comunes

### Windows: "python no se reconoce como comando"
- Reinstalar Python marcando "Add Python to PATH"
- O agregar manualmente: `C:\Users\TU_USUARIO\AppData\Local\Programs\Python\Python311` al PATH

### Windows: Error de ejecución de scripts en PowerShell
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### MongoDB no inicia (Windows)
- Abrir "Servicios" (services.msc)
- Buscar "MongoDB Server"
- Click derecho → Iniciar

### Error: "EACCES permission denied" (macOS/Linux)
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Puerto 3000 o 8001 ya en uso
```bash
# Linux/macOS
lsof -i :3000
kill -9 <PID>

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Problemas de conexión a MongoDB
```bash
# Verificar que MongoDB está corriendo
# Linux
sudo systemctl status mongod

# macOS
brew services list

# Windows - Buscar "MongoDB" en Servicios (services.msc)
```

---

## 🔑 Credenciales por Defecto

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin | admin123 | Administrador |

**⚠️ IMPORTANTE**: Cambiar las credenciales en producción.

---

## Estructura del Proyecto

```
secfind/
├── backend/
│   ├── server.py              # API FastAPI principal
│   ├── routes/                # Rutas modulares GRC
│   │   ├── dominios.py
│   │   ├── controles.py
│   │   ├── catalogo_riesgos.py
│   │   ├── hallazgos_auditoria.py
│   │   └── dashboard.py
│   ├── models/
│   │   └── grc_models.py      # Modelos Pydantic GRC
│   ├── pdf_reports.py
│   ├── email_service.py
│   ├── limpiar_db.py          # Script para limpiar BD
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DashboardGRC.jsx       # Dashboard GRC Unificado
│   │   │   ├── Vulnerabilidades.jsx
│   │   │   ├── CatalogoRiesgos.jsx    # Catálogo de Riesgos
│   │   │   ├── HallazgosAuditoria.jsx # Hallazgos
│   │   │   └── ...
│   │   └── components/ui/     # Componentes Shadcn
│   └── package.json
└── README.md
```

---

## Licencia

Este proyecto es de uso interno para gestión de vulnerabilidades de ciberseguridad y GRC.
