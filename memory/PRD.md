# SecFind - Sistema de Gestión de Vulnerabilidades

## Última Actualización: 2025-12-27

### Cambios Recientes
- **Fase Frontend GRC Completada (Dic 2025)**: Implementación completa de UI para módulos GRC:
  - Dominios y Controles integrados como tabs en Configuración
  - Catálogo de Riesgos como página independiente (/catalogo-riesgos)
  - Hallazgos de Auditoría como página independiente (/hallazgos-auditoria)
  - Cálculo reactivo de Riesgo Inherente (Probabilidad × Impacto)
  - Dropdown cascada Dominio → Control en formulario de Hallazgos
  - Modal de búsqueda de riesgos del catálogo
- **Arquitectura Backend Modular GRC (Dic 2025)**: Nueva arquitectura con Router Factories en `/app/backend/routes/` para Dominios, Controles, Catálogo de Riesgos y Hallazgos de Auditoría.
- **Vistas Guardadas en Vista Comité**: Nueva funcionalidad para guardar configuraciones personalizadas de filtros (grupos, informes, severidades) y cargarlas rápidamente en futuras reuniones de comité.
- **Auditoría como submódulo de Configuración**: El historial de auditoría se movió del sidebar al módulo de Configuración como una pestaña adicional (solo visible para administradores).
- **Modal de Detalle en Vista Comité**: Al hacer clic en cualquier fila de la tabla, se abre un modal con todas las vulnerabilidades del informe/grupo, incluyendo código, severidad, estatus y responsable.
- **Vista Mixta (Grupos + Informes Individuales)**: En modo "Por Grupo", se puede agregar informes individuales (sin grupo) a la tabla para crear vistas personalizadas según las necesidades de los directivos.
- **Grupos de Informes en Vista Comité**: Nueva funcionalidad para agrupar múltiples informes de pentest bajo un nombre de grupo. Permite consolidar la vista ejecutiva y alternar entre modo Individual y Por Grupo.
- **Parser PDF sin IA**: Nuevo parser basado en reglas para informes de Pentraze Cybersecurity. No requiere API key ni costos adicionales
- **Entrada Masiva**: Formulario tipo spreadsheet para agregar múltiples vulnerabilidades a la vez con opción de pegar desde Excel
- **Campo Código**: Agregado campo "Código" a vulnerabilidades para identificación única

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
- [x] **Grupos de Informes** (NUEVO - Dic 2025):
  - [x] Toggle para alternar entre vista "Individual" y "Por Grupo"
  - [x] Filtro de grupos cuando está en modo agrupado
  - [x] Ícono de carpeta para identificar grupos en la tabla
  - [x] Tooltip con lista de informes incluidos en cada grupo
  - [x] Consolidación de métricas por grupo
- [x] **Modal de Detalle** (NUEVO - Dic 2025):
  - [x] Click en cualquier fila abre modal con vulnerabilidades
  - [x] Muestra código, vulnerabilidad, severidad, estatus, responsable
  - [x] Para grupos: columna adicional con nombre del informe
  - [x] Badges con conteos por severidad
- [x] **Vista Mixta** (NUEVO - Dic 2025):
  - [x] Botón "Agregar informes..." para añadir informes individuales
  - [x] Combina grupos + informes sin grupo en la misma tabla
  - [x] Ícono diferenciador (carpeta para grupos, nada para individuales)

- [x] **Vistas Guardadas** (NUEVO - Dic 2025):
  - [x] Botón "Vistas" en header con contador de vistas guardadas
  - [x] Dropdown con lista de vistas y opción "Guardar vista actual"
  - [x] Modal de guardar: nombre, descripción, resumen de configuración
  - [x] Cargar vista aplica todos los filtros automáticamente
  - [x] Eliminar vista con confirmación
  - [x] Toast de feedback para cada operación

### Grupos de Informes (NUEVO - Dic 2025)
- [x] Nueva pestaña "Grupos Informes" en Configuración
- [x] CRUD completo de grupos (crear, leer, actualizar, eliminar)
- [x] Asignar múltiples informes a un grupo
- [x] Validación: un informe solo puede pertenecer a un grupo
- [x] Vista de informes sin asignar
- [x] KPIs: Total grupos, Informes agrupados, Informes sin grupo

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

### Módulo GRC - Governance, Risk, Compliance (NUEVO - Dic 2025)

#### Dominios de Seguridad (Tab en Configuración)
- [x] CRUD completo de dominios (nombre, código de referencia)
- [x] Seed data: 6 dominios base (Gestión Identidades, Endpoints, Red/Perímetro, Aplicaciones, Datos, Monitoreo)
- [x] Validación de unicidad por nombre
- [x] Protección: no se puede eliminar si tiene controles asociados

#### Controles de Seguridad (Tab en Configuración)
- [x] CRUD completo de controles (código, nombre, dominio_id)
- [x] Asociación obligatoria a un dominio
- [x] Filtro por dominio en la lista
- [x] Seed data: 4 controles de ejemplo para Endpoints
- [x] Protección: no se puede eliminar si tiene vulnerabilidades o hallazgos asociados

#### Catálogo de Riesgos (Página independiente /catalogo-riesgos)
- [x] CRUD completo de riesgos (código, nombre corto, descripción completa)
- [x] Búsqueda por código, nombre o descripción
- [x] Paginación de resultados
- [x] Solo administradores pueden crear/editar/eliminar
- [x] Protección: no se puede eliminar si tiene vulnerabilidades o hallazgos asociados

#### Hallazgos de Auditoría (Página independiente /hallazgos-auditoria)
- [x] CRUD completo de hallazgos de auditoría
- [x] Campos: código (auto-generado AUD-YYYY-XXX), brecha, control asociado, riesgo asociado
- [x] **Cálculo reactivo de Riesgo Inherente**: Probabilidad (1-5) × Impacto (1-5) = Riesgo Inherente
- [x] Dropdown cascada: Dominio → Control
- [x] Modal de búsqueda de riesgos del catálogo
- [x] Estados: Abierto, En Proceso, Listo para Revisión, Cerrado
- [x] Filtros por estado y búsqueda
- [x] Dashboard con KPIs: Total, Abiertos, En Proceso, Revisión, Alto Riesgo (≥15)
- [x] Colores por nivel de riesgo (verde < 4, amarillo < 8, naranja < 15, rojo ≥ 15)
- [x] Paginación de resultados

### Módulo de Configuración
- [x] CRUD Instituciones (con actualización en cascada)
- [x] CRUD Aplicaciones (con actualización en cascada)
- [x] CRUD Proveedores (con actualización en cascada)
- [x] CRUD Informes Pentest (con actualización en cascada)
- [x] CRUD Usuarios con permisos
- [x] CRUD Grupos de Informes
- [x] **Auditoría del Sistema** (movido desde sidebar - Dic 2025)
  - [x] Historial de todos los cambios del sistema
  - [x] Filtros por entidad, acción, usuario, fechas
  - [x] Paginación con 15 registros por página
  - [x] Modal de detalle de cambios
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
- `/catalogo-riesgos` - Catálogo de Riesgos (GRC)
- `/hallazgos-auditoria` - Hallazgos de Auditoría (GRC)
- `/configuracion` - Configuración del Sistema (incluye tabs: Dominios, Controles, Auditoría)
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

### P0 (Alta Prioridad)
- [ ] Detección de duplicados en importación y creación manual
- [ ] Actualizar Formulario de Vulnerabilidades con campos GRC (control_id, dropdown cascada Dominio→Control, búsqueda de riesgos)
- [x] **Arquitectura GRC Backend** (COMPLETADO - Dic 2025):
  - [x] Modularización de server.py con factory routers
  - [x] Colecciones: config_dominios, config_controles, catalogo_riesgos, hallazgos_auditoria
  - [x] CRUD endpoints para todos los módulos GRC
  - [x] Seed data: 6 dominios + 4 controles de Seguridad EndPoints
  - [x] Migración: riesgo_asociado -> riesgo_id en vulnerabilidades
- [x] **Fase Frontend GRC** (COMPLETADO - Dic 2025):
  - [x] Frontend: UI de Dominios y Controles en Configuración (como tabs)
  - [x] Frontend: Módulo Catálogo de Riesgos (página independiente)
  - [x] Frontend: Módulo Hallazgos de Auditoría (página independiente)
  - [x] Frontend: Selector cascada Dominio → Control en Hallazgos
  - [x] Frontend: Modal de búsqueda de Riesgos en Hallazgos
  - [x] Frontend: Cálculo reactivo de Riesgo Inherente (Probabilidad × Impacto)

### P1 (Media-Alta Prioridad)
- [ ] Integración con herramientas de scanning (Nessus, Qualys, etc.)

### P2 (Media Prioridad)
- [ ] Historial de cambios en catálogos de configuración (instituciones, aplicaciones, etc.)
- [ ] Refactorización de server.py en routers modulares (deuda técnica)
- [ ] Compartir vistas guardadas entre usuarios (marcar como públicas)

### P3 (Baja Prioridad)
- [ ] Dashboard comparativo por períodos
- [ ] Ejecución automática programada de notificaciones (cron job)

## Notas Técnicas

### Colección MongoDB: grupos_informes
```json
{
  "id": "uuid",
  "nombre": "Nombre del grupo",
  "descripcion": "Descripción opcional",
  "informes": ["Informe 1", "Informe 2"],
  "created_at": "ISO datetime"
}
```

### Endpoints Nuevos (Dic 2025)
- `GET /api/config/grupos-informes` - Lista grupos
- `POST /api/config/grupos-informes` - Crear grupo
- `PUT /api/config/grupos-informes/{id}` - Actualizar grupo
- `DELETE /api/config/grupos-informes/{id}` - Eliminar grupo
- `GET /api/config/informes-sin-grupo` - Informes no asignados
- `GET /api/vista-comite?agrupar_por=grupo&grupos=id1,id2` - Vista agrupada
- `GET /api/vista-comite?informes_adicionales=informe1,informe2` - Vista mixta
- `GET /api/vistas-guardadas` - Lista vistas guardadas
- `POST /api/vistas-guardadas` - Crear vista guardada
- `PUT /api/vistas-guardadas/{id}` - Actualizar vista guardada
- `DELETE /api/vistas-guardadas/{id}` - Eliminar vista guardada

### Endpoints GRC (Dic 2025)
```
# Dominios
GET    /api/config/dominios         - Lista dominios
POST   /api/config/dominios         - Crear dominio
GET    /api/config/dominios/{id}    - Obtener dominio
PUT    /api/config/dominios/{id}    - Actualizar dominio
DELETE /api/config/dominios/{id}    - Eliminar dominio

# Controles
GET    /api/config/controles        - Lista controles (filtro: ?dominio_id=xxx)
POST   /api/config/controles        - Crear control
GET    /api/config/controles/{id}   - Obtener control
PUT    /api/config/controles/{id}   - Actualizar control
DELETE /api/config/controles/{id}   - Eliminar control

# Catálogo de Riesgos
GET    /api/catalogo-riesgos        - Lista paginada (filtros: ?search=xxx&skip=0&limit=50)
GET    /api/catalogo-riesgos/all    - Todos los riesgos (para selectores)
POST   /api/catalogo-riesgos        - Crear riesgo (solo admin)
GET    /api/catalogo-riesgos/{id}   - Obtener riesgo
PUT    /api/catalogo-riesgos/{id}   - Actualizar riesgo (solo admin)
DELETE /api/catalogo-riesgos/{id}   - Eliminar riesgo (solo admin)

# Hallazgos de Auditoría
GET    /api/hallazgos-auditoria           - Lista paginada (filtros: ?estado=xxx&control_id=xxx&search=xxx)
GET    /api/hallazgos-auditoria/stats     - Estadísticas (total, por_estado, alto_riesgo_pendientes)
GET    /api/hallazgos-auditoria/next-codigo - Próximo código AUD-YYYY-XXX
POST   /api/hallazgos-auditoria           - Crear hallazgo (calcula riesgo_inherente automático)
GET    /api/hallazgos-auditoria/{id}      - Obtener hallazgo con datos enriquecidos
PUT    /api/hallazgos-auditoria/{id}      - Actualizar hallazgo (recalcula riesgo_inherente)
DELETE /api/hallazgos-auditoria/{id}      - Eliminar hallazgo
```

### Colección MongoDB: vistas_guardadas
```json
{
  "id": "uuid",
  "nombre": "Nombre de la vista",
  "descripcion": "Descripción opcional",
  "agrupar_por_grupo": true/false,
  "grupos_ids": ["id1", "id2"],
  "informes_adicionales": ["Informe X"],
  "informes_individuales": ["Informe Y"],
  "severidades": ["Critica", "Alta", "Media", "Baja"],
  "created_by": "user_id",
  "created_at": "ISO datetime"
}
```