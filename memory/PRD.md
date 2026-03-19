# SecFind - Sistema de Gestión de Vulnerabilidades

## Problema Original
Aplicación web para la Gestión de Vulnerabilidades de Ciberseguridad, reemplazando un flujo de trabajo basado en Excel. Permite operaciones CRUD sobre hallazgos de pentests con Dashboard visual e intuitivo para presentaciones ejecutivas.

## Arquitectura
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React + Shadcn UI + Recharts
- **Base de datos**: MongoDB (colecciones: vulnerabilidades, instituciones, aplicaciones, proveedores, informes_pentest, usuarios)
- **Autenticación**: JWT con bcrypt
- **IA**: GPT-4.1-mini para extracción de PDF

## Usuarios
- Profesionales de ciberseguridad
- Ejecutivos que necesitan reportes visuales

## Requisitos Core (Implementados)

### Dashboard
- [x] KPIs: Total, Críticas Abiertas, Corregidas, Pendientes, **En Proceso**, **Para Re Test**
- [x] Gráfico de pastel por Severidad
- [x] Gráfico de barras por Estatus  
- [x] Gráfico de barras por Institución
- [x] Gráfico de tendencias temporal
- [x] Filtros dinámicos: Año, Institución, Informe Pentest, Severidad, Proveedor
- [x] KPIs clickeables con modal de detalle
- [x] **Cálculos corregidos para que la suma cuadre**

### Gestión de Vulnerabilidades
- [x] Tabla CRUD con búsqueda y filtros
- [x] Modal para crear/editar vulnerabilidades
- [x] Filtro por Año, Aplicación
- [x] Campo Aplicaciones como multi-select
- [x] Campo Proveedor como dropdown del catálogo
- [x] Campo Informe Pentest como dropdown del catálogo
- [x] Exportar a CSV y Excel
- [x] Importar desde CSV y Excel
- [x] **NUEVO: Importar desde PDF con IA**

### Importación desde PDF (NUEVO)
- [x] Subir informe de pentest en PDF
- [x] Extracción automática con IA (GPT-4.1-mini)
- [x] Extrae: nombre informe, fecha, institución, proveedor, vulnerabilidades
- [x] Detecta elementos nuevos (apps, informes, proveedores, instituciones)
- [x] Opción de agregar elementos al catálogo automáticamente
- [x] Revisión individual de cada vulnerabilidad antes de agregar
- [x] Edición de campos antes de guardar
- [x] Navegación entre vulnerabilidades (anterior/siguiente/omitir)

### Módulo de Seguimiento de Riesgos
- [x] Página dedicada /seguimiento-riesgos
- [x] KPIs: Vencidas, Próximos 7 días, Próximos 30 días, Total Pendientes
- [x] KPIs clickeables para filtrar
- [x] Tabla con estado de seguimiento, días restantes

### Módulo de Configuración
- [x] CRUD de Instituciones
- [x] CRUD de Aplicaciones
- [x] CRUD de Proveedores
- [x] CRUD de Informes Pentest
- [x] CRUD de Usuarios

### Sistema de Usuarios y Permisos
- [x] Autenticación JWT
- [x] Usuario admin por defecto (admin/admin123)
- [x] Permisos por módulo

## Catálogos del Sistema
- **Instituciones**: BHD, BHDIB, Remesas, Puesto de bolsa, Purple Team, Fondo
- **Aplicaciones**: 49+ aplicaciones
- **Proveedores**: F2TC, GBM, Pentraze, SISAP, Pentraze Cybersecurity
- **Informes Pentest**: 28+ informes

## Historial de Implementación

### 19 Marzo 2026
- **Importación desde PDF con IA**: Extrae vulnerabilidades de informes de pentest
- Revisión y edición individual antes de agregar
- Detección automática de elementos nuevos en catálogos

### 11 Marzo 2026 - Sesión 2
- Filtro por Aplicación en Vulnerabilidades
- Catálogo de Informes Pentest
- Módulo de Seguimiento de Riesgos
- KPIs de "En Proceso" y "Para Re Test" en Dashboard
- Corrección de cálculos del dashboard (suma cuadra)

### 11 Marzo 2026 - Sesión 1
- Dashboard con filtros avanzados
- Sistema de autenticación y permisos
- CRUD de usuarios con roles
- KPIs clickeables
- Módulo de Proveedores

## Backlog

### P1 (Alta Prioridad)
- Ninguna tarea pendiente

### P2 (Media Prioridad)  
- [ ] Historial de cambios por vulnerabilidad
- [ ] Notificaciones por email de fechas de compromiso
- [ ] Reportes PDF generados

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning

## Credenciales de Prueba
- **Usuario**: admin
- **Contraseña**: admin123

## Variables de Entorno
- `MONGO_URL`: Conexión a MongoDB
- `DB_NAME`: Nombre de la base de datos
- `EMERGENT_LLM_KEY`: Key para extracción de PDF con IA

## Rutas de la Aplicación
- `/` - Dashboard (6 KPIs)
- `/vulnerabilidades` - Gestión de Vulnerabilidades (con importación PDF)
- `/seguimiento-riesgos` - Seguimiento de Riesgos
- `/configuracion` - Configuración del Sistema
- `/login` - Inicio de Sesión
