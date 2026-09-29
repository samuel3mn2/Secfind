# SecFind — Gestión de Vulnerabilidades y GRC

Última actualización: **2026-09-29**. Idioma de comunicación y documentación: español.

## Problema original y usuarios
Aplicación web para gestionar vulnerabilidades de ciberseguridad y sustituir un flujo de trabajo basado en Excel. Incluye operaciones CRUD sobre hallazgos de pentest, seguimiento de remediación y paneles para presentaciones ejecutivas.

Usuarios: administradores de seguridad, analistas de vulnerabilidades/GRC, responsables de remediación y comités ejecutivos. El usuario principal utiliza una instalación **local en Windows 11**: preservar compatibilidad multiplataforma, rutas Windows y mongodump configurable.

## Solicitud vigente — Filtros del Pivot GRC
Usuario: «Bien estamos listo, en el ambiente local todo funciona correctamente. Necesito que revises el modulo de Dashboard GRC submodulo Análisis Avanzado (Pivot) tiene algunos errores por ejemplo si abro un tab ejemplo Nivel de riesgo hago mi selección lo cierro y abro otro tab por ejemplo Estatus vuelve abrir Nivel de riesgo y así sucesivamente sigue abriendo todos los tabs».

Aclaración: «Sí son las ventanas de filtros, el error ocurre en ambos» (Vulnerabilidades y Hallazgos de Auditoría). Corregir el ciclo de apertura/cierre sin perder selecciones ni vistas guardadas.

### Implementado y verificado 2026-09-29
- Reproducido en ambos módulos: el cierre interceptaba eventos React y aplicaba `display:none`; un observador posterior reemplazaba `cssText` y reabría ventanas cuyo estado seguía abierto.
- Eliminados observadores de estilos globales y cierres visuales. Se usa el cierre real de react-pivottable: la ventana se desmonta.
- Una ventana activa por análisis; cierre mediante X, Escape, clic fuera o apertura de otro filtro. El mismo triángulo alterna correctamente.
- Selecciones conservadas al cerrar/reabrir y al guardar/cargar vistas.
- Se detectó otro fallo durante la regresión: `onChange` incluía funciones/aggregators/renderers que se serializaban como `{}`; restaurarlos provocaba `aggregators[aggregatorName] is not a function`. Se guardan/restauran únicamente preferencias serializables (campos, agregador, renderer, filtros y orden).
- Posicionamiento sin cubrir el triángulo; móvil dentro de la pantalla. Eliminada transición de transform en el atributo con filtro abierto para no desplazar el popup fijo. Arrastre de la ventana pertenece a react-draggable, no se sobrescribe su transform en escritorio.
- Atributos de prueba y accesibilidad en controles generados; descripciones de diálogos y dimensiones iniciales Recharts para eliminar avisos detectados.
- Archivos: `components/PivotAnalysis.jsx`, `components/pivot/{usePivotFilterLifecycle.js,positionPivotFilter.js,pivotState.js,PivotResponsive.css}`, `pages/DashboardGRC.jsx` y dimensiones iniciales en `pages/Dashboard.jsx`.
- Informe inicial: `test_reports/iteration_36.json`; correcciones verificadas después en `test_reports/iteration_36_followup.md`. El informe inicial conserva sus hallazgos; el seguimiento documenta su resolución.
- Probadas seis combinaciones por tamaño (ambos módulos × tabla/gráfico/paralelo), filtros repetidos y selección conservada. Móvil390×844 sin overflow en las seis combinaciones; escritorio1920×800 sin overflow y triángulo accesible.
- Vista temporal guardada, página recargada y vista restaurada con filtros conservados. Vistas TEST eliminadas (HTTP200), ninguna vista existente ni datos reales modificados.
- Credenciales e integraciones sin cambios. Verificación en Windows local pendiente del usuario.
- Compilación final `CI=false yarn build` correcta (iteration_36_final_build.log); sin advertencias en los archivos Pivot nuevos/modificados. Persisten avisos heredados de hooks en otros módulos y tamaño del bundle.

## Solicitud anterior — Historial de backups (validada en Windows local)
«Hay que revisar la vista del submodulo de backups. El historial de backups muestra todos los backups, y con el timepo este historial va crecer mucho hay que mejorar esa vista».

Alcance aceptado por el usuario («Me parece bien el alcance»):
- Paginación real desde el servidor: 10 registros por página; opciones de 25 y 50.
- Filtros por estado, destino y rango de fechas.
- Totales, navegación y orden del más reciente al más antiguo.
- Conservar descarga y eliminación con confirmación.
- No eliminar automáticamente ningún registro o archivo de backup.

## Arquitectura
- Frontend: React, Shadcn UI, Tailwind, Recharts. API mediante `REACT_APP_BACKEND_URL` en `frontend/.env`.
- Backend: FastAPI, Motor y MongoDB. Base de datos exclusivamente por `MONGO_URL` y `DB_NAME` en `backend/.env`.
- Puertos del entorno: frontend 3000 y backend 8001, gestionados por supervisor. Rutas de API con prefijo `/api`.
- Autenticación existente: JWT Bearer, bcrypt, usuarios en `usuarios`, login por `username`. `POST /api/auth/login` devuelve `token` y `usuario`, no `access_token`.
- `backend/server.py` sigue concentrando gran parte de las rutas (>6400 líneas). Existen routers modulares GRC en `backend/routes/`.
- Respaldos: `backend/backup_service.py` (mongodump, rutas Windows/Linux, Google Drive, scheduler APScheduler).
- Consulta paginada: `backend/backup_history.py` (modelos Pydantic, filtros, índices y consulta acotada).
- Vista: `frontend/src/pages/Backups.jsx`, integrada en Configuración → Backups.
- Componentes de historial: `frontend/src/components/backups/` contiene `BackupHistory`, filtros, tabla adaptable, paginación y hook de consulta independiente.
- Pivot GRC: `PivotAnalysis.jsx` reutiliza react-pivottable y Plotly; `components/pivot/` contiene el ciclo de filtros, coordenadas responsivas y normalización de preferencias guardadas.
- Integraciones existentes: extracción PDF con IA, Google Drive y SMTP. No se añadieron ni modificaron integraciones de almacenamiento/email en esta iteración.

## Requisitos funcionales vigentes
- CRUD de vulnerabilidades y hallazgos, importación Excel/CSV/PDF y exportaciones.
- Seguimiento y bitácora atribuida al usuario que hace el cambio.
- Resultado Re-Test independiente por aplicación; cierre y reapertura sincronizados con las fechas.
- Estado **«En Retest»** único en interfaz y lógica actual; no reintroducir «Para Re Test» como valor de almacenamiento.
- Dashboards, matriz GRC 4×4, análisis pivot, Vista Comité y vistas guardadas.
- Catálogos: instituciones, aplicaciones, proveedores, informes, responsables, dominios y controles.
- Auditoría y confirmación de operaciones destructivas.
- Backups manuales y programados, mongodump configurable, validación de rutas, descarga y notificación de errores.
- Historial consultable sin cargar toda la colección ni eliminar respaldos antiguos automáticamente.

## Historial de backups — implementado 2026-09-18
- El navegador carga exclusivamente una página de 10/25/50 registros; filtros aplicados sobre toda la colección `backup_logs`.
- Estado: Exitoso/Fallido/En progreso. Destino: Local/Google Drive/Local + Google Drive; coincidencia exacta del destino solicitado.
- Rango de fechas inclusivo en calendario local. Cliente convierte `desde` al inicio del día y `hasta` al inicio del día siguiente en UTC.
- Servidor usa rango `[fecha_desde, fecha_hasta)`; valida fechas invertidas, enums y límites de paginación.
- Orden estable por `fecha DESC, id DESC`, índices compuestos para estado/destino/fecha/id, `_id` excluido y respuestas Pydantic.
- Navegación primera/anterior/siguiente/última, totales, limpiar filtros, reinicio a primera página al filtrar/cambiar tamaño.
- Página fuera de rango se ajusta a la última disponible, incluida eliminación de la última fila.
- Estados de carga, error/reintentar, vacío y rango inválido. Cancelación de solicitudes obsoletas.
- Consultar historial no recarga ni sobrescribe cambios no guardados en configuración.
- Descarga y eliminación conservadas; no se modifica scheduler, mongodump ni las políticas de almacenamiento.
- Vista móvil por registros etiquetados, sin desplazamiento horizontal. Iconos de calendario corregidos solo en los nuevos filtros.

### Contrato API
`GET /api/backup/historial?pagina=1&limite=10`

Respuesta: `{items, total, pagina, limite, total_paginas}`. Página mínima 1, límite 1–200 (UI 10/25/50). Total de páginas mínimo 1 incluso vacío.

Parámetros opcionales: `estado`, `destino`, `fecha_desde` y `fecha_hasta` (ISO 8601, último exclusivo). Solo administradores.

Compatibilidad: sin `pagina` devuelve la lista legacy, con límite predeterminado de 50. No requiere migración del historial.

### Esquema relevante
- `backup_logs`: id, fecha (ISO UTC), estado, destino, ruta_local, google_drive_file_id, tamaño, tamaño_humano, duracion_segundos, error, error_google_drive.
- `configuracion`: documento `id=config_backup` (habilitado, ruta_local, ruta_mongodump, frecuencia, hora, destinos, notificaciones).
- Vulnerabilidades: estatus, resultado_re_test, aplicaciones_resultados, historial_impedimentos_seguimiento.

## Verificación anterior — Backups
- Informe: `/app/test_reports/iteration_35.json`; **20/20 pruebas backend**, flujos frontend de alcance aprobados.
- Pruebas: `/app/backend/tests/test_iteration35_backup_history.py` y semilla temporal `/app/tests/backup_history_seed_cleanup.py`.
- Se probaron >60 registros temporales, combinaciones de filtros, límites de fechas Santo Domingo, descarga, cancelación/eliminación de registros TEST y reajuste de página.
- Todos los datos temporales fueron eliminados; **11 registros originales preservados**.
- Revisión visual final posterior al informe: 1920×800 y 390×844 sin overflow; calendario claro y última página móvil `11–11 de 11 backups`.
- Login y rutas protegidas sin/con token inválido verificadas. 403 de usuario no-admin no probado por ausencia de credenciales conocidas; no se crearon usuarios.
- Ruff E722/F601 aprobado. `CI=false yarn build` finalizó correctamente; conserva advertencias previas de dependencias de hooks y tamaño del bundle. No hay errores de compilación ni advertencias en los nuevos componentes de historial.
- No APIs simuladas en el producto. Google Drive, SMTP y ejecución Windows no reprobados: fuera del alcance del historial.
- Credenciales existentes en `/app/memory/test_credentials.md`, sin modificaciones.
- Cierre de la observación visual del informe35: `/app/test_reports/iteration_35_followup.md`.

## Correcciones auxiliares exigidas por la comprobación del proyecto
- Reemplazados 15 `except:` heredados por captura explícita (server, dashboard, vista_comite y tests).
- `get_optional_user` captura `HTTPException` de la dependencia existente, sin cambiar tokens o credenciales; guía y verificación en `/app/auth_testing.md`.
- Corregida clave `$or` duplicada de `migrate_nivel_riesgo` mediante `$and` de ambos grupos; preserva intención del filtro.
- La reconciliación automática de contraseña admin sugerida por la guía ampliada **no se implementó**: no forma parte del alcance y podría sobrescribir contraseñas cambiadas por usuarios. Requiere política explícita, no es un fallo del historial.

## Estado y próximos pasos
- P0: verificar corrección de ventanas de filtros Pivot en Windows local. El usuario ya confirmó que el trabajo anterior funciona en local.
- P1: modularizar gradualmente `server.py`, con regresiones por módulo.
- P2: consolidar dominios duplicados; exportación CSV del historial e indicador de filtros activos del Pivot como propuestas futuras.
- Detalle de prioridades: `/app/memory/ROADMAP.md`.
- Histórico completo previo y cambios de esta iteración: `/app/memory/CHANGELOG.md`. Sus menciones antiguas de «Para Re Test» son históricas y quedan superadas por la regla actual de «En Retest».
- Documentación local: `/app/README.md`, `/app/INSTALACION_WINDOWS.md`, `/app/scripts/INSTRUCCIONES_TAREA_PROGRAMADA.md`.