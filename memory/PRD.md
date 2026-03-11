# SecFind - Sistema de Gestión de Vulnerabilidades

## Problema Original
Aplicación web para la Gestión de Vulnerabilidades de Ciberseguridad, reemplazando un flujo de trabajo basado en Excel. Permite operaciones CRUD sobre hallazgos de pentests con Dashboard visual e intuitivo para presentaciones ejecutivas.

## Arquitectura
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React + Shadcn UI + Recharts
- **Base de datos**: MongoDB (colecciones: vulnerabilidades, instituciones, aplicaciones, proveedores, usuarios)
- **Autenticación**: JWT con bcrypt

## Usuarios
- Profesionales de ciberseguridad
- Ejecutivos que necesitan reportes visuales

## Requisitos Core (Implementados)

### Dashboard
- [x] KPIs (Total, Críticas abiertas, Corregidas, Pendientes)
- [x] Gráfico de pastel por Severidad
- [x] Gráfico de barras por Estatus  
- [x] Gráfico de barras por Institución
- [x] Gráfico de tendencias temporal
- [x] **Filtros dinámicos**: Año, Institución, Informe Pentest, Severidad, Proveedor
- [x] Botón "Limpiar filtros"
- [x] KPIs clickeables con modal de detalle
- [x] KPIs y gráficos se actualizan con filtros

### Gestión de Vulnerabilidades
- [x] Tabla CRUD con búsqueda y filtros
- [x] Modal para crear/editar vulnerabilidades
- [x] Eliminación con confirmación
- [x] Campos dropdown predefinidos
- [x] Filtro por Año
- [x] Filtro por Aplicación
- [x] **Campo Aplicaciones como multi-select**
- [x] **Campo Proveedor como dropdown del catálogo**
- [x] 225 vulnerabilidades importadas del Excel

### Módulo de Configuración
- [x] CRUD de Instituciones
- [x] CRUD de Aplicaciones
- [x] **CRUD de Proveedores**
- [x] CRUD de Usuarios
- [x] Activar/Desactivar elementos de catálogo
- [x] Catálogos dinámicos en todos los dropdowns

### Sistema de Usuarios y Permisos
- [x] Autenticación JWT
- [x] Usuario admin por defecto (admin/admin123)
- [x] Permisos por módulo (ver, crear, editar, eliminar)
- [x] Roles de administrador

### Importar/Exportar
- [x] Exportar a CSV y Excel
- [x] Importar desde CSV y Excel

## Campos del Modelo de Vulnerabilidad
- fecha_hallazgo, institucion, **aplicaciones** (array), vulnerabilidad
- recomendaciones, severidad, riesgo_asociado, descripcion_riesgo
- responsable, fecha_compromiso, estatus, resultado_re_test
- nombre_informe_pentest, proveedor

## Catálogos del Sistema
- **Instituciones**: Extraídas de datos existentes (BHD)
- **Aplicaciones**: 58 aplicaciones únicas extraídas y normalizadas
- **Proveedores**: F2TC, GBM, Pentraze, SISAP

## Historial de Implementación

### 11 Marzo 2026
- Dashboard con filtros avanzados (5 filtros)
- Módulo de configuración para instituciones
- Sistema de autenticación y permisos
- CRUD de usuarios con roles
- KPIs clickeables con modal de detalle
- Gráfico de tendencias
- Refactorización del campo `aplicacion` a `aplicaciones` (array)
- Multi-select de aplicaciones en formulario
- Filtro por año en vulnerabilidades
- **Módulo de Proveedores en Configuración**
- **Campo Proveedor como dropdown del catálogo**

## Backlog

### P1 (Alta Prioridad)
- Ninguna tarea pendiente de alta prioridad

### P2 (Media Prioridad)  
- [ ] Historial de cambios por vulnerabilidad
- [ ] Notificaciones por email de fechas de compromiso
- [ ] Reportes PDF generados

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning
- [ ] Modo oscuro/claro configurable

## Credenciales de Prueba
- **Usuario**: admin
- **Contraseña**: admin123

## Documentación
- `/app/README.md` - Guía general del proyecto
- `/app/INSTALACION_WINDOWS.md` - Instrucciones de instalación local
