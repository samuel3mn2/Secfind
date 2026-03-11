# SecFind - Sistema de Gestión de Vulnerabilidades

## Problema Original
Aplicación web para la Gestión de Vulnerabilidades de Ciberseguridad, reemplazando un flujo de trabajo basado en Excel. Permite operaciones CRUD sobre hallazgos de pentests con Dashboard visual e intuitivo para presentaciones ejecutivas.

## Arquitectura
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React + Shadcn UI + Recharts
- **Base de datos**: MongoDB (colecciones: vulnerabilidades, instituciones)

## Usuarios
- Profesionales de ciberseguridad
- Ejecutivos que necesitan reportes visuales

## Requisitos Core (Implementados)

### Dashboard
- [x] KPIs (Total, Críticas abiertas, Corregidas, Pendientes)
- [x] Gráfico de pastel por Severidad
- [x] Gráfico de barras por Estatus  
- [x] Gráfico de barras por Institución
- [x] **Filtros dinámicos**: Año, Institución, Informe Pentest, Severidad, Proveedor
- [x] Botón "Limpiar filtros"
- [x] KPIs y gráficos se actualizan con filtros

### Gestión de Vulnerabilidades
- [x] Tabla CRUD con búsqueda y filtros
- [x] Modal para crear/editar vulnerabilidades
- [x] Eliminación con confirmación
- [x] Campos dropdown predefinidos
- [x] 225 vulnerabilidades importadas del Excel

### Módulo de Configuración
- [x] CRUD de Instituciones
- [x] Activar/Desactivar instituciones
- [x] Instituciones dinámicas en dropdowns

### Importar/Exportar
- [x] Exportar a CSV y Excel
- [x] Importar desde CSV y Excel

## Campos del Modelo
- fecha_hallazgo, institucion, aplicacion, vulnerabilidad
- recomendaciones, severidad, riesgo_asociado, descripcion_riesgo
- responsable, fecha_compromiso, estatus, resultado_re_test
- nombre_informe_pentest, proveedor

## Implementado: 11 Marzo 2026
- Dashboard con filtros avanzados (5 filtros)
- Módulo de configuración para instituciones
- Todas las funcionalidades CRUD

## Backlog
### P1 (Alta Prioridad)
- [ ] Autenticación de usuarios
- [ ] Roles y permisos

### P2 (Media Prioridad)  
- [ ] Historial de cambios por vulnerabilidad
- [ ] Notificaciones por email de fechas de compromiso
- [ ] Reportes PDF generados

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning
