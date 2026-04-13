# SecFind - Sistema de Gestión de Vulnerabilidades

## Problema Original
Aplicación web para la Gestión de Vulnerabilidades de Ciberseguridad, reemplazando un flujo de trabajo basado en Excel. Permite operaciones CRUD sobre hallazgos de pentests con Dashboard visual e intuitivo para presentaciones ejecutivas.

## Arquitectura
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React + Shadcn UI + Recharts
- **Base de datos**: MongoDB
- **Autenticación**: JWT con bcrypt
- **IA**: GPT-4.1-mini para extracción de PDF (requiere EMERGENT_LLM_KEY)

## Requisitos para Instalación Local

### Software Necesario
- Python 3.9+
- Node.js 18+ con Yarn
- MongoDB 6.0+

### Variables de Entorno

**Backend (.env)**
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="secfind_db"
CORS_ORIGINS="http://localhost:3000"
EMERGENT_LLM_KEY="..."  # Opcional, solo para PDF
```

**Frontend (.env)**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Funcionalidades que requieren API Key
| Funcionalidad | Sin API Key | Con API Key |
|---------------|-------------|-------------|
| Dashboard | ✅ Funciona | ✅ Funciona |
| CRUD Vulnerabilidades | ✅ Funciona | ✅ Funciona |
| Importar Excel/CSV | ✅ Funciona | ✅ Funciona |
| Exportar Excel/CSV | ✅ Funciona | ✅ Funciona |
| Seguimiento de Riesgos | ✅ Funciona | ✅ Funciona |
| Vista Comité | ✅ Funciona | ✅ Funciona |
| Configuración | ✅ Funciona | ✅ Funciona |
| **Importar PDF con IA** | ❌ Error | ✅ Funciona |

## Funcionalidades Implementadas

### Dashboard (6 KPIs)
- [x] Total Vulnerabilidades
- [x] Críticas Abiertas
- [x] Corregidas
- [x] Pendientes
- [x] En Proceso
- [x] Para Re Test
- [x] Gráficos: Severidad, Estatus, Institución, Tendencias
- [x] 6 Filtros: Año, Institución, Informe, Severidad, Proveedor, Aplicación
- [x] KPIs clickeables con modal de detalle

### Vista Comité (NUEVO - Dic 2025)
- [x] Resumen ejecutivo de vulnerabilidades por informe de pentest
- [x] Tabla con ratios Pendiente/Total por severidad (Crítico, Alto, Medio, Bajo)
- [x] Columnas: Informe/Alcance, Responsable(s), Total Pend./Total, % Pendiente
- [x] KPIs: Críticas Pendientes, Altas Pendientes, Total Pendientes, % Global
- [x] Filtro multi-select por Alcance/Informe
- [x] Filtro por Severidades con badges toggleables
- [x] Colores por ratio (verde=0%, amarillo=50%, naranja=75%, rojo=100%)
- [x] Fila TOTALES con suma de todas las filas
- [x] Exportar CSV
- [x] **Exportar Imagen PNG** (para presentaciones PowerPoint)

### Gestión de Vulnerabilidades
- [x] Tabla CRUD con búsqueda (texto visible)
- [x] Filtros: Año, Severidad, Estatus, Institución, Aplicación, **Informe**
- [x] Multi-select para aplicaciones
- [x] Dropdowns para campos de catálogo
- [x] Importar: Excel, CSV, **PDF con IA**
- [x] Exportar: Excel, CSV

### Importación de PDF con IA
- [x] Extracción automática con GPT-4.1-mini
- [x] Identifica: nombre informe, fecha, institución, proveedor
- [x] Identifica **aplicación evaluada** (no confunde con servidores)
- [x] Extrae vulnerabilidades con severidad, descripción, recomendaciones
- [x] Activos técnicos (servidores/URLs) van en descripción
- [x] Detecta elementos nuevos para agregar al catálogo
- [x] Revisión individual antes de guardar

### Seguimiento de Riesgos
- [x] Página dedicada /seguimiento-riesgos
- [x] KPIs: Vencidas, Próximos 7 días, Próximos 30 días
- [x] Cálculo automático de días restantes
- [x] Filtros por severidad e institución

### Módulo de Configuración
- [x] CRUD Instituciones
- [x] CRUD Aplicaciones
- [x] CRUD Proveedores
- [x] CRUD Informes Pentest
- [x] CRUD Usuarios con permisos

### Sistema de Autenticación
- [x] JWT con bcrypt
- [x] Usuario admin por defecto (admin/admin123)
- [x] Permisos por módulo

## Rutas de la Aplicación
- `/` - Dashboard (6 KPIs)
- `/vulnerabilidades` - Gestión de Vulnerabilidades
- `/seguimiento-riesgos` - Seguimiento de Riesgos
- `/vista-comite` - **Vista Comité (NUEVO)**
- `/configuracion` - Configuración del Sistema
- `/login` - Inicio de Sesión

## Documentación
- `/app/README.md` - Guía completa de instalación y uso
- `/app/INSTALACION_WINDOWS.md` - Guía paso a paso para Windows

## Credenciales de Prueba
- **Usuario**: admin
- **Contraseña**: admin123

## Estadísticas Actuales
- 219 vulnerabilidades
- 6 instituciones
- 48 aplicaciones
- 4 proveedores
- 27 informes pentest

## Backlog

### P2 (Media Prioridad)
- [ ] Historial de cambios por vulnerabilidad
- [ ] Notificaciones por email de fechas de compromiso
- [ ] Reportes PDF generados

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning
