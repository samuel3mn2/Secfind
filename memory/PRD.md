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
- [x] **Botón "Generar Reporte PDF"** con opciones de reportes

### Reportes PDF (NUEVO - Dic 2025)
- [x] **Reporte Ejecutivo**: KPIs + gráficos de pastel (severidad, estatus) + barras (instituciones)
- [x] **Reporte por Institución**: Resumen + tabla de vulnerabilidades con colores por severidad
- [x] **Reporte por Informe Pentest**: Similar al de institución pero filtrado por informe
- [x] **Reporte Vista Comité**: Tabla con ratios por severidad, tiempo activo, totales
- [x] Generación dinámica con filtros aplicados
- [x] Descarga automática del PDF

### Auditoría del Sistema (NUEVO - Dic 2025)
- [x] Página dedicada /auditoria (solo administradores)
- [x] Registro automático de todas las acciones en vulnerabilidades (crear, actualizar, eliminar)
- [x] Filtros por entidad, acción, usuario y rango de fechas
- [x] Detalle de cambios: campo modificado, valor anterior, valor nuevo
- [x] Paginación de registros

### Vista Comité (NUEVO - Dic 2025)
- [x] Resumen ejecutivo de vulnerabilidades por informe de pentest
- [x] Tabla con ratios Pendiente/Total por severidad (Crítico, Alto, Medio, Bajo)
- [x] Columnas: Informe/Alcance, Responsable(s), **Tiempo Activo (meses)**, Total Pend./Total, % Pendiente
- [x] KPIs: Críticas Pendientes, Altas Pendientes, Total Pendientes, % Global
- [x] Filtro multi-select por Alcance/Informe
- [x] Filtro por Severidades con badges toggleables
- [x] Colores por ratio (verde=0%, amarillo=50%, naranja=75%, rojo=100%)
- [x] Colores por tiempo activo (≥12 meses=rojo, ≥6 meses=naranja)
- [x] Fila TOTALES con suma de todas las filas
- [x] Exportar CSV (incluye Tiempo Activo)
- [x] **Exportar Imagen PNG fondo BLANCO** (para presentaciones PowerPoint)

### Gestión de Vulnerabilidades
- [x] Tabla CRUD con búsqueda (texto visible)
- [x] Filtros: Año, Severidad, Estatus, Institución, Aplicación, **Informe**
- [x] Multi-select para aplicaciones
- [x] Dropdowns para campos de catálogo
- [x] Importar: Excel, CSV, **PDF con IA**
- [x] Exportar: Excel, CSV
- [x] **Acciones Masivas** (NUEVO - Dic 2025):
  - [x] Selección múltiple con checkboxes
  - [x] Cambiar estatus de múltiples vulnerabilidades
  - [x] Asignar responsable en lote
  - [x] Actualizar fecha de compromiso en grupo
  - [x] **Eliminación masiva** con confirmación y registro en auditoría
  - [x] Registro en historial de auditoría

### Importación de PDF con IA
- [x] Extracción automática con GPT-4.1-mini
- [x] Identifica: nombre informe, fecha, institución, proveedor
- [x] Identifica **aplicación evaluada** (no confunde con servidores)
- [x] Extrae vulnerabilidades con severidad, descripción, recomendaciones
- [x] Activos técnicos (servidores/URLs) van en descripción
- [x] Detecta elementos nuevos para agregar al catálogo
- [x] Revisión individual antes de guardar
- [x] **Auto-creación de catálogos**: Al agregar vulnerabilidad, crea automáticamente institución, aplicación, proveedor e informe si no existen

### Importación de Excel
- [x] Mapeo automático de columnas
- [x] Conversión de fechas
- [x] **Auto-creación de catálogos** (NUEVO - Abr 2026): Al importar Excel, crea automáticamente instituciones, aplicaciones, proveedores e informes si no existen (matching case-insensitive)

### Seguimiento de Riesgos
- [x] Página dedicada /seguimiento-riesgos
- [x] KPIs: Vencidas, Próximos 7 días, Próximos 30 días
- [x] Cálculo automático de días restantes
- [x] Filtros por severidad, institución e **informe pentest**

### Módulo de Configuración
- [x] CRUD Instituciones (con actualización en cascada)
- [x] CRUD Aplicaciones (con actualización en cascada)
- [x] CRUD Proveedores (con actualización en cascada)
- [x] CRUD Informes Pentest (con actualización en cascada)
- [x] CRUD Usuarios con permisos
- [x] **Actualización en cascada**: Al cambiar nombre de institución, aplicación, proveedor o informe, se actualizan todas las vulnerabilidades relacionadas

### Sistema de Autenticación
- [x] JWT con bcrypt
- [x] Usuario admin por defecto (admin/admin123)
- [x] Permisos por módulo (Dashboard, Vulnerabilidades, Configuración, **Auditoría**)

## Rutas de la Aplicación
- `/` - Dashboard (6 KPIs + Generar Reportes PDF)
- `/vulnerabilidades` - Gestión de Vulnerabilidades
- `/seguimiento-riesgos` - Seguimiento de Riesgos
- `/vista-comite` - Vista Comité
- `/auditoria` - Auditoría del Sistema (solo admin)
- `/configuracion` - Configuración del Sistema
- `/login` - Inicio de Sesión

## Documentación
- `/app/README.md` - Guía completa de instalación y uso
- `/app/INSTALACION_WINDOWS.md` - Guía paso a paso para Windows

## Credenciales de Prueba
- **Usuario**: admin
- **Contraseña**: admin123

## Estadísticas Actuales
- 225 vulnerabilidades
- 8 instituciones
- 48 aplicaciones
- 4 proveedores
- 27 informes pentest
- 2 usuarios (admin, sfernandez)

## Última Actualización: Abril 2026
### Cambios Completados (Iteración 7)
- ✅ Eliminación masiva de vulnerabilidades con confirmación
- ✅ Auto-creación de catálogos en importación Excel (case-insensitive)
- ✅ Permisos de Auditoría en configuración de usuarios

## Backlog

### P2 (Media Prioridad)
- [ ] Notificaciones por email de fechas de compromiso
- [ ] Historial de cambios en catálogos de configuración (instituciones, aplicaciones, etc.)

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning
