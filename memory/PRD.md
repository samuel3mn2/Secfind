# SecFind - Sistema de Gestión de Vulnerabilidades

## Última Actualización: 2025-12-01

### Cambios Recientes
- **Filtro Anual en Dashboard**: Agregada opción "Anual" en la gráfica de Evolución de Vulnerabilidades para ver el progreso año por año
- **Filtro por Año Específico**: Agregado selector para filtrar la gráfica de tendencias por un año específico (2023, 2024, 2025, 2026) o ver todos los años
- **Filtro Tipo Fecha en Seguimiento**: Agregado filtro "Todas / Con fecha / Sin fecha" para mostrar todas las vulnerabilidades pendientes, solo las que tienen fecha de compromiso, o solo las que no la tienen
- **Bug fix MongoDB**: Corregida query que usaba múltiples `$ne` incorrectamente, ahora usa `$nin` para filtrar valores nulos y vacíos

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
- 235 vulnerabilidades
- 8 instituciones
- 48 aplicaciones
- 4 proveedores
- 27 informes pentest
- 2 usuarios (admin, sfernandez)

## Última Actualización: Abril 2026
### Cambios Completados (Iteración 11 - Vista Comité Fix + Lógica Re-Test + Filtros Multi-Select)
- ✅ **Vista Comité - Corrección de bugs**:
  - **Nombres de informe completos**: Eliminado truncado de texto que cortaba los nombres largos
  - **Lógica de filtros corregida**: Al deseleccionar severidades, los totales se recalculan correctamente
  - **Buscador de informes agregado**: Popover con campo de búsqueda para filtrar informes fácilmente
  - También corregido en exportación CSV
- ✅ **Sincronización Estatus ↔ Resultado Re-Test**:
  - Al importar Excel o actualizar vulnerabilidad, el estatus se sincroniza automáticamente (solo si estatus está vacío)
  - Re-Test = "Corregido/Desestimado" → Estatus = "Cerrado"
  - Re-Test = "Vulnerable/Impedimento" → Estatus = "Pendiente"
  - "En Proceso" se mantiene si ya está definido y se considera pendiente en reportes
- ✅ **Filtros Multi-Select en Dashboard**:
  - Informe Pentest y Severidad: Permiten seleccionar múltiples valores
- ✅ **Filtros Multi-Select en Vulnerabilidades**:
  - Severidad y Estatus: Cambiados de Select simple a Multi-Select
  - Resumen de filtros activos en encabezado
- ✅ **Filtros Multi-Select en Seguimiento de Riesgos**:
  - Severidad: Cambiado a Multi-Select
- ✅ **Nombres de informe completos en todos los módulos**:
  - Dashboard, Vulnerabilidades, Seguimiento y Vista Comité

### Cambios Completados (Iteración 10)
- ✅ **Documentación actualizada**:
  - README.md actualizado con nuevas funcionalidades
  - DOCKER.md creado con guía completa de instalación Docker
  - INSTALACION_WINDOWS.md actualizado
  - Plantilla Excel creada en /plantillas/plantilla_vulnerabilidades.xlsx

### Cambios Completados (Iteración 9)
- ✅ **Catálogo de Responsables** - Nueva sección en Configuración:
  - CRUD de responsables con nombre y email
  - Buscador integrado en la tabla
  - Actualización en cascada (cambiar nombre actualiza vulnerabilidades)
- ✅ **Campo Responsable mejorado** en Vulnerabilidades:
  - Ahora es un combobox con búsqueda (SearchableSelect)
  - Muestra nombre y email del responsable
  - Permite crear nuevo si no existe
  - También implementado en acciones masivas

### Cambios Completados (Iteración 8)
- ✅ **Notificaciones por Email** - Módulo completo en Configuración:
  - Configuración SMTP (Gmail u otro servidor)
  - Alertas configurables: 7, 3, 1 días antes del vencimiento
  - Opción de enviar a responsables además de administradores
  - Resumen semanal automático
  - Botones: Probar Conexión, Enviar Email de Prueba, Ejecutar Ahora
- ✅ Burbuja "Made with Emergent" removida de la UI

### Cambios Completados (Iteración 7)
- ✅ Eliminación masiva de vulnerabilidades con confirmación
- ✅ Auto-creación de catálogos en importación Excel (case-insensitive)
- ✅ Permisos de Auditoría en configuración de usuarios

## Backlog

### P2 (Media Prioridad)
- [ ] Detección de duplicados en importación
- [ ] Historial de cambios en catálogos de configuración (instituciones, aplicaciones, etc.)

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Integración con herramientas de scanning
- [ ] Ejecución automática programada de notificaciones (cron job)

