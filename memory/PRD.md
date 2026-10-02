# SecFind — Gestión de Vulnerabilidades y GRC

Última actualización: **2026-10-02**. Idioma de comunicación y documentación: español.

## Problema original y usuarios
Aplicación web para gestionar vulnerabilidades de ciberseguridad y sustituir un flujo de trabajo basado en Excel. Incluye operaciones CRUD sobre hallazgos de pentest, seguimiento de remediación y paneles para presentaciones ejecutivas.

Usuarios: administradores de seguridad, analistas de vulnerabilidades/GRC, responsables de remediación y comités ejecutivos. El usuario principal utiliza una instalación **local en Windows 11**: preservar compatibilidad multiplataforma, rutas Windows y mongodump configurable.

## Solicitud vigente — Selección de aplicaciones y estatus en Dashboard GRC
Usuario: «Excelente vista!, algunos puntos de mejoras poder filtrar aplicación por si solo quieren verse algunas seleccionadas especificas y necesito el el estatus de esas vulnerabilidades ya que en el detalle no se muestran(te dejo libertad para eso crea una panel o como entiendas que se vea mejor, pero en el detalle de la vulnerabilidad pon el estatus tambien)».

Alcance aprobado («Aprobado»): selector múltiple de aplicaciones con búsqueda que afecta los paneles; resumen por estatus seleccionable; estatus visible en cada detalle y «Sin estado» cuando falta. Se mantienen activas por defecto; cerradas/corregidas/desestimadas mediante filtro general de estados.

### Implementado y verificado 2026-10-02 (iteración39)
- Selector Aplicaciones encima de los paneles, con búsqueda, casillas, contador y limpieza. Admite varias aplicaciones y grupo Sin aplicación asignada. Conserva opciones/selección mientras se actualizan los resultados.
- Filtrar por una aplicación solo muestra esa fila aunque una vulnerabilidad esté asociada a otras. Seleccionar varias usa OR sin duplicar el total de vulnerabilidades; riesgo, severidad y estatus se combinan con AND entre dimensiones.
- Nuevo resumen **Estatus de las vulnerabilidades**, con conteos, colores y multiselección reversible. Respeta los filtros generales y locales; ignora su propia selección al calcular opciones para poder añadir otros estados.
- Cada aplicación muestra sus conteos desglosados por estatus. Cada vulnerabilidad tiene una línea independiente **Estatus:** con etiqueta destacada. Valores missing/null/vacíos/solo espacios se muestran como **Sin estado**, sin asignar un estado inventado ni modificar la BD.
- Filtros activos de aplicación/estatus se ven como etiquetas removibles. Se guardan/cargan en Vistas, compatibles con vistas anteriores, incluidos valores null para Sin aplicación.
- Detalle, paginación, recomendaciones y filtros anteriores se conservan; las selecciones nuevas solo afectan estos paneles y el detalle, no los demásKPIs/Pivot.
- Datos de comprobación: Active Directory+MBP=24vulnerabilidades (20Pendiente,4EnProceso), seleccionando EnProceso quedan4 y solo aparece ActiveDirectory. Baseline152activas intacto tras limpieza de fixtures.

### Contrato ampliado
- Nuevos parámetros repetidos (NO CSV) en `/api/dashboard/vulnerabilidades/paneles` y `/detalle`: `aplicaciones=<nombre>` y `estatus=<estado>`. Se preservan comas, `&`, Unicode y nombres largos. `incluir_sin_aplicacion=true` combina ese grupo por OR con las aplicaciones elegidas.
- `aplicacion` y `sin_aplicacion` singulares siguen siendo el destino del detalle, aplicando también los filtros locales y generales.
- Resumen añade `estatus[{valor,total}]`, `opciones_aplicaciones[{aplicacion,total}]` y `aplicaciones[].estatus{estado:conteo}`. Opciones de aplicación ignoran la selección de aplicación pero respetan las otras dimensiones.
- `FiltrosVista.aplicaciones_vulnerabilidad: List[Optional[str]]` y `estatus_vulnerabilidad: List[str]`, vacíos por defecto.
- Sin cambios de credenciales, integraciones o lógica de autenticación. Sin migración.

### Archivos y pruebas
- Frontend: `ApplicationSelector.jsx`, `StatusSummary.jsx`, `StatusBadge.jsx` y ajustes de componentes existentes en `components/grc-vulnerabilities/`; estados y Vistas en `DashboardGRC.jsx`.
- Backend: ampliaciones en `vulnerability_panel_data.py`, `vulnerability_panels.py` y modelo/sanitización de Vistas en `dashboard.py`.
-13pruebas backend aprobadas (8generales+5casos controlados). El caso opcional de nombres especiales de la suite original se omite al no existir dato real; está cubierto plenamente con fixtures aislados en la suite adicional.8pruebas previas de iteración38 también aprobadas.
- UI: selección múltiple, chips, resumen/contadores, estatus del detalle, guardar/cargar/eliminar vista temporal. Capturas válidas del agente principal1920×800 y390×844, sin overflow (sesión20261002_140936).
- Compilación aprobada (`iteration_39_build.log`,33.13s), sin errores; advertencias heredadas de hooks en otros módulos y tamaño de bundle.
- Reportes: `iteration_39.json`, `iteration_39_edge_followup.json`, `iteration_39_followup.md`. Regresiones: `test_iteration39_vulnerability_panels.py` y `test_iteration39_edge_cases.py`.
- La prueba adicional ahora usa IDs únicos por ejecución y elimina únicamente sus propios IDs/informe en finally; no borra registros preexistentes.
- Pendiente comprobación Windows local. Recomendación de protección anti-intentos fallidos del login observada fuera del alcance registrada aparte en ROADMAP; no se ha cambiado autenticación ni se afirma una auditoría completa.

## Solicitud anterior — Nivel de riesgo y aplicaciones afectadas en Dashboard GRC
Usuario: «En el dashboard GRC, Dashboard Necesito un \"Panel por Nivel de riesgo - Vulnerabilidades\" puede ser justo al lado del Panel de Severidad ya que hay un espacio ahí disponible que se ve muy vació (ver imagen adjunta) y debajo un nuevo panel por aplicaciones afectadas, necesito que este panel sea intuitivo por ejemplo si selecciono nivel de riesgo alto el panel debe actualizar la vista y al hacer click pueda ver el detalle de las vulnerabilidades (tomar en cuenta que pueda seleccionar varios niveles de riesgo o severidad)».

Alcance aprobado literalmente («Aprobado»): riesgo junto a severidad, aplicaciones debajo, selección múltiple reversible; OR dentro de cada grupo y AND entre riesgo/severidad; pulsar aplicación abre sus vulnerabilidades filtradas, respetando filtros generales.

### Implementado y verificado 2026-10-02 (iteración38)
- Panel de severidad renovado con barras seleccionables y nuevo panel de riesgo a su derecha; en móvil se apilan. Selección visible con borde/marca y chips removibles, limpieza por dimensión o de toda la selección.
- Riesgos: Alto, Medio Alto, Medio, Bajo y Sin clasificar cuando procede; severidades Crítica, Alta, Media, Baja y Sin clasificar cuando procede. No se inventan niveles para datos sin clasificación.
- Facetas cruzadas: severidades respeta riesgos seleccionados; riesgos respeta severidades seleccionadas. Cada distribución mantiene alternativas de su propia dimensión para permitir multiselección. Aplicaciones y detalle aplican ambas condiciones.
- Aplicaciones afectadas: conteos, segmentos por riesgo, búsqueda, orden por mayor número y8filas por página. Cada vulnerabilidad cuenta una vez por aplicación; total global único, suma por aplicación puede ser mayor. Grupo explícito Sin aplicación asignada, aplicación `null` en API.
- Detalle por aplicación y botones Ver detalle/Ver todas:10resultados por página desde el servidor, sin el límite20 anterior ni recorte de descripción. Código, descripción, estado, nivel, severidad, aplicaciones, informe, responsable, institución, fechas y recomendaciones expandibles.
- Los filtros locales solo afectan estos3paneles y su detalle, no modifican los demásKPIs/Pivot. Se respetan informes (incluidos grupos), dominios, responsables y estados de vulnerabilidades generales. Por defecto excluye Cerrado/Corregido/Desestimado, igual que el Dashboard; estado explícito permite consultarlos.
- Normalización de aplicaciones repetidas/espacios y formato legacy string; datos Mongo sin `_id` en respuestas y modelos Pydantic. Risk computed reutiliza regla existente de Primera emulación<=2024.
- API admite alias Crítica/Critica y Medio-Alto/Medio Alto, mayúsculas/espacios y rechaza categorías desconocidas. No se modifica la base de datos para normalizar consultas.
- Selecciones se guardan/cargan en Vistas mediante nuevos campos opcionales; vistas antiguas siguen funcionando. Informes de grupos se conservan como informes efectivos al guardar.
- Corregido ancho de filas de Vistas Guardadas con nombres largos (la acción eliminar podía quedar fuera del menú), leyendas que desbordaban en móvil y contenedor Sonner con ancho100% más margen lateral.
- Consultas cancelables contra respuestas obsoletas; carga, vacío, error explícito y reintento. Diseño y permisos existentes preservados; no se cambió autenticación.

### Archivos y API nuevos
- Backend: `backend/routes/vulnerability_panel_data.py` (normalización/filtros/pipeline), `vulnerability_panels.py` (modelos, consultas y rutas), inclusión desde `dashboard.py`.
- `GET /api/dashboard/vulnerabilidades/paneles`: `total`, `severidades`, `niveles_riesgo`, `aplicaciones[{aplicacion,total,niveles}]`.
- `GET /api/dashboard/vulnerabilidades/detalle`: `items,total,pagina,limite,total_paginas`. `aplicacion` exacta o `sin_aplicacion=true`; no combinar ambos. Límite1–100, página≥1; páginas fuera de rango se ajustan a la última.
- Parámetros comunes: informes, dominios, responsables, estados_vuln, riesgos, severidades (CSV). Categorías OR; dimensiones AND.
- Frontend: `components/grc-vulnerabilities/` (paneles, distribución, aplicaciones, detalle, selección, paginación y hook), integración en `pages/DashboardGRC.jsx`.
- Vistas: `filtros.niveles_riesgo_vulnerabilidad` y `filtros.severidades_vulnerabilidad`, listas opcionales vacías por defecto.

### Pruebas y estado
-8/8pruebas backend verificadas contra Mongo real y reejecutadas después de correcciones; alias y parámetros canónicos comparados con respuesta idéntica.
- UI: OR+AND (Alto+MedioAlto y Crítica+Alta=10vulnerabilidades en7aplicaciones en datos de prueba existentes), búsqueda/paginación, detalle, volver desde Pivot, guardado/restauración de cuatro selecciones.
- Se guardó/cargó/eliminó por UI una vista temporal de nombre largo, con confirmación, en390px. Limpieza confirmada HTTP200. Ninguna vista original ni vulnerabilidad/hallazgo modificados.
- Detalle Sin aplicación:37resultados en4páginas,10por página; segunda página verificada en móvil.
- Reintentos de paneles/detalle probados tras interrupción de red simulada solo en navegador de pruebas; las APIs reales no están simuladas.
- Capturas finales1920×800 y390×844, incluidos modal y notificación, sin overflow. Reportes `iteration_38.json` y `iteration_38_followup.md`; pruebas `backend/tests/test_iteration38_vulnerability_panels.py`.
- Verificación en Windows local pendiente. No requiere migración ni credenciales nuevas.
- Compilación final correcta (`iteration_38_final_build.log`,38.60s), sin errores ni advertencias en componentes nuevos; conserva advertencias previas de hooks en otros módulos y tamaño del bundle. Ruff de módulos nuevos aprobado.

## Solicitud anterior — Tipos de tabla del Pivot GRC
Usuario: «Sigamos en el mismo lugar en la tabla me acabo de dar cuenta de algo, ver imagen al cambiar el tipo de tabla no cambia el diseño de la tabla. Probe los graficos y los graficos si funcionan correctamente». Imagen: selector Table / Table Heatmap / Table Col Heatmap / Table Row Heatmap. Confirmación: «Así tanto en vulnerabilidaes como en Hallazgos».

### Implementado y verificado 2026-09-29 (iteración37)
- Reproducción: al elegir Heatmap el renderer calculaba colores inline, pero los estilos oscuros `background:... !important` los tapaban; el color computado permanecía gris en ambos módulos.
- Eliminadas reglas duplicadas de celdas y prioridad forzada en fondos de datos/totales/hover. Se conserva el estilo oscuro como reserva y la tabla normal sin colores residuales.
- Colores blanco→rojo del renderer de tablas: global, por columna o por fila según opción. Cálculo de grupos/ejes/agregaciones sigue en react-pivottable, sin cambios en node_modules.
- `tableHeatmapColorScale` maneja valores iguales, filas/columnas únicas, cero/negativos, vacíos y números no finitos. Vacíos sin color; min=max usa intensidad media válida, sin NaN. Texto `#111111` en celdas coloreadas, contraste mínimo≥4.5.
- Totales parciales reciben su escala y total general permanece oscuro. Cambiar modo no cambia cifras, filtros ni agrupaciones.
- Test IDs y teclado en selector de renderer y celdas. Se conserva el comportamiento nativo del menú (permanece abierto tras elegir otra opción).
- Regresión en vista paralela detectó ancho de gráfico calculado a partir de toda la ventana: `usePivotChartWidth` ahora mide el panel y descuenta los controles. No modifica datos, tipos ni cálculo de gráficos.
- Archivos: `PivotAnalysis.jsx`, `pivot/tableHeatmap.js`, `pivot/usePivotChartWidth.js`, `pivot/usePivotFilterLifecycle.js`; pruebas en `pivot/tableHeatmap.test.js`.
- Verificación:10/10pruebas unitarias, ciclos de los4tipos en ambos módulos, colores inline=computado, hover, filtros, Plotly y vista temporal guardada/recargada/restaurada. Vista TEST eliminada (HTTP200), sin modificar datos originales.
- Escritorio1920×800 y móvil390×844: ambos módulos y paralelo sin overflow. Informes `iteration_37.json` y `iteration_37_followup.md` (el primero quedó parcial por secuencia del menú en la automatización; el segundo documenta verificación completa y RCA).
- Sin cambios backend, credenciales ni integraciones. No requiere migración. Pendiente comprobación del usuario en Windows local.
- Compilación final aprobada (`iteration_37_final_build.log`,41.35s); solo advertencias heredadas de hooks fuera de Pivot y tamaño del bundle, sin errores.

## Solicitud anterior — Filtros del Pivot GRC
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
- Paneles interactivos GRC: `components/grc-vulnerabilities/` y rutas modulares `backend/routes/vulnerability_panels.py`, con filtros comunes en `vulnerability_panel_data.py`.
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
- P0: comprobar selector múltiple de aplicaciones, resumen de estatus y estatus explícito en detalle en Windows local. No hay fallos conocidos bloqueantes de estos flujos GRC.
- P1: modularizar gradualmente `server.py`, con regresiones por módulo.
- P1 separado: evaluar protección frente a intentos fallidos del login. Observación de pruebas fuera del alcance actual, no corregida ni tratada como auditoría de seguridad completa.
- P2: consolidar dominios duplicados; exportación CSV del historial/detalle filtrado de aplicaciones y leyenda de intensidad Heatmap como propuestas futuras. El indicador de filtros activos ya está implementado en los paneles GRC, no en Pivot.
- Detalle de prioridades: `/app/memory/ROADMAP.md`.
- Histórico completo previo y cambios de esta iteración: `/app/memory/CHANGELOG.md`. Sus menciones antiguas de «Para Re Test» son históricas y quedan superadas por la regla actual de «En Retest».
- Documentación local: `/app/README.md`, `/app/INSTALACION_WINDOWS.md`, `/app/scripts/INSTRUCCIONES_TAREA_PROGRAMADA.md`.