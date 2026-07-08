# SecFind - Sistema de Gestión de Vulnerabilidades

## Última Actualización: 2026-07-08

### Cambios Recientes (Julio 2026)

- **BUGFIX CRÍTICO: Vulnerabilidades desaparecen de "En Retest" al agregar notas (2026-07-08)**:
  - **Problema reportado**: Las vulnerabilidades en "Para Re Test" desaparecían del módulo Seguimiento después de agregarles una "Nota de Seguimiento"
  - **Causa raíz**: En `POST /api/seguimiento/{id}/registrar`, el código actualizaba `resultado_re_test` con el valor del resultado para TODOS los casos, incluyendo "Nota de Seguimiento". Esto sobrescribía "Para Re Test" con "Nota de Seguimiento", y la vista "en_retest" filtra por `resultado_re_test='Para Re Test'`
  - **Solución**: Añadida condición `if not es_nota_seguimiento:` antes de actualizar `resultado_re_test` (server.py líneas 3492-3495)
  - **Verificado**: Testing agent iteration_31 - 100% backend (5/5 pytest), 100% frontend (E2E Playwright)
  - **Regresión**: Test file creado `/app/backend/tests/test_nota_seguimiento_retest_bug.py`

- **FEATURE/BUGFIX: Múltiples mejoras y correcciones (2026-07-08)**:
  - **BUG #1: "En Retest" no funciona con vulnerabilidades activas con fecha**:
    * Problema: Cuando una vulnerabilidad activa con fecha se ponía "Para Re Test", no aparecía en vista "En Retest"
    * Causa: La lógica conservaba la fecha_compromiso, pero la vista "En Retest" requiere fecha_compromiso = null
    * Solución: Modificado para que "Para Re Test" LIMPIE la fecha_compromiso
  - **BUG #2: Status "En Retest" no se guarda al editar**:
    * Problema: Al editar vulnerabilidad y cambiar a "Para Re Test", no se aplicaba correctamente
    * Solución: Añadida lógica para manejar "para re test" en endpoint PUT de vulnerabilidades
  - **FEATURE #3: Campo "Área" en Responsables**:
    * Backend: Añadido campo `area` en modelos Responsable, ResponsableCreate, ResponsableUpdate
    * Frontend: Actualizado Responsables.jsx con columna "Área" y campo en formulario
  - **FEATURE #4: Campo "Fecha de Cierre" en Vulnerabilidades y Hallazgos**:
    * Backend Vulnerabilidades: Añadido campo `fecha_cierre`, se establece automáticamente cuando resultado_re_test = Corregido/Desestimado
    * Backend Hallazgos: Añadido campo `fecha_cierre`, se establece cuando estado = "Cerrado"
    * Lógica: Si se reabre (cambia de Cerrado a otro estado), se limpia fecha_cierre
  - **FEATURE #5: Botón "Importar" solo para Administradores**:
    * Vulnerabilidades: Cambiado de `canAdd` a `isAdmin` + modal de confirmación
    * HallazgosAuditoria: Envuelto botón Importar con `{isAdmin && ...}`
    * CatalogoRiesgos: Ya estaba correctamente con `isAdmin`

- **BUGFIX: Selección de Dropdown en Pivot Tables no funcionaba (2026-07-08)**:
  - **Problema**: Al hacer clic en opciones del dropdown (Table, Table Heatmap, etc.) no se seleccionaban
  - **Causa 1**: `rendererName="Table"` estaba forzado DESPUÉS de `{...vulnTableState}` en PivotTableUI, sobrescribiendo cualquier cambio del usuario
  - **Causa 2**: El prop `data` no se estaba eliminando en los handlers `onChange`, causando problemas de re-render (issue conocido de react-pivottable)
  - **Solución**:
    * Movido `{...vulnTableState}` y `{...hallTableState}` al final de los props para que el state controle el renderer
    * Añadido `delete s.data` en todos los handlers onChange (handleVulnTableChange, handleVulnChartChange, etc.)
  - **Verificado**: Playwright confirma `Renderer after click: ×Table Heatmap` - selección funciona correctamente

- **MEJORA: FilterBox cierre con ESC y Click Fuera + Orden de Vistas (2026-07-06)**:
  - **Problema 1**: El popup de filtros (pvtFilterBox) no se podía cerrar con el botón X ni mover
  - **Solución**:
    * Añadido listener de teclado para cerrar con tecla ESC
    * Añadido listener de click fuera del FilterBox para cerrarlo
    * Ambos métodos funcionan simultáneamente para mejor UX
  - **Problema 2**: El orden de los botones de vista no era el deseado
  - **Solución**: Cambiado orden a "Solo Tabla" → "Solo Gráfico" → "Paralelo"
  - **Configuración inicial**: Vista comienza en "Solo Tabla" por defecto
  - **Verificado**: ESC cierra el FilterBox (confirmado via Playwright)

- **BUGFIX: Dark Mode en Pivot Tables - Dropdowns pvtDropdown (2026-07-06)**:
  - **Problema reportado**: Los selectores "Table", "Stacked Bar Chart", "Count" tenían fondo blanco con texto gris claro casi invisible
  - **Causa**: React-pivottable usa componentes `div.pvtDropdown` personalizados (NO elementos `<select>` nativos) que no se estilizaban
  - **Solución**:
    * Agregados estilos CSS específicos para `.pvtDropdown`, `.pvtDropdownValue`, `.pvtDropdownCurrent`, `.pvtDropdownMenu`
    * MutationObserver modificado para aplicar estilos inline a los `.pvtDropdown` dinámicamente
    * Añadido `overflow: visible !important` al contenedor `.pvtDropdown` para mostrar el menú desplegable
    * Estilos: fondo `#18181b`, texto `#ffffff`, borde `#6366f1`
  - **Verificado**: Screenshots y JavaScript confirman estilos aplicados correctamente

- **FEATURE: Análisis Avanzado con Pivot Tables SEPARADOS (2026-07-06)**:
  - **Rediseño completo por requerimiento del usuario**: Separación estricta de datos
  - **Frontend** (`PivotAnalysis.jsx`):
    * DOS tabs independientes: "PIVOT VULNERABILIDADES" (266) y "PIVOT HALLAZGOS" (184)
    * Tab Vulnerabilidades: campos de Pentest (codigo, vulnerabilidad, severidad, nivel_riesgo, estatus, responsable, institucion, aplicacion, informe_pentest, proveedor, dominio, mes_deteccion, resultado_retest, veces_retest)
    * Tab Hallazgos: campos de Auditoría/GRC (codigo, brecha, nivel_riesgo, estado, responsable, dominio, control, mes_deteccion, probabilidad, impacto, riesgo_inherente)
    * Selector de layout: Paralelo / Solo Tabla / Solo Gráfico
    * CSS ultra-agresivo con selectores comodín (!important) para Dark Mode
    * Botón "Exportar CSV" funcional por módulo
  - **Backend** (`dashboard.py`):
    * Endpoint `/api/dashboard/data` retorna `datos_vulnerabilidades` y `datos_hallazgos` como arrays SEPARADOS
    * Función `_get_datos_vulnerabilidades_pivot()` - campos técnicos de Pentest
    * Función `_get_datos_hallazgos_pivot()` - campos normativos de Auditoría
    * Schemas estrictamente disjuntos (sin mezcla de campos)
  - **Verificado**: Testing agent iteration_30 - 100% backend (6/6 pytest), 100% frontend

- **BUGFIX: Modal de Confirmación - Dominio faltante y Scroll (2026-07-01)**:
  - **Problema 1**: El Dominio seleccionado no aparecía en el modal de confirmación
    * Causa: `dominio_id` estaba en IGNORED_FIELDS y no se guardaba en formData
    * Solución: Removido de IGNORED_FIELDS, ahora se guarda en `formData.dominio_id` y se incluye en `originalDataForDiff`
  - **Problema 2**: El scroll no funcionaba con muchos cambios
    * Causa: El ScrollArea de Radix no respetaba el maxHeight en flex layout
    * Solución: Reemplazado por `<div className="overflow-y-auto min-h-0" style={{maxHeight: 'calc(85vh - 250px)'}}>` (scroll nativo)
  - **Verificado**: Testing agent confirmó scroll funcional (scrollHeight 726px > clientHeight 668px) y Dominio visible con nombre legible
  - **Archivos**: `ConfirmChangesModal.jsx`, `Vulnerabilidades.jsx`, `HallazgosAuditoria.jsx`

- **BUGFIX: Modal de Confirmación muestra UUIDs en lugar de nombres (2026-07-01)**:
  - **Problema reportado**: El modal ConfirmChangesModal mostraba UUIDs para Control Asociado y Riesgo del Catálogo en lugar de nombres legibles
  - **Causa**: El componente mostraba valores crudos de `control_id` y `riesgo_id` sin resolverlos a nombres
  - **Solución**:
    * Agregado prop `lookupMaps` al componente `ConfirmChangesModal.jsx`
    * Creada función `resolveIdToName()` que mapea IDs a nombres legibles (formato: "COD - Nombre")
    * `Vulnerabilidades.jsx`: Creado `lookupMaps` useMemo con mapas de controles, riesgos y dominios
    * `HallazgosAuditoria.jsx`: Aplicada la misma arquitectura
    * `dominio_id` agregado a IGNORED_FIELDS (solo se usa para filtro en cascada)
  - **Mejora de scroll**: Cambiado de inline style a clase Tailwind `max-h-[calc(90vh-280px)]` para mejor compatibilidad
  - **Verificado**: Testing agent confirmó 0 UUIDs en el modal - 100% éxito

### Cambios Recientes (Junio 2026)

- **BUGFIX: EXPORTACIÓN EXCEL CON FILTROS (2026-06-30)**:
  - **Problema**: Al exportar a Excel con filtros aplicados, no se respetaban los filtros de `nivel_riesgo` y `proveedor`
  - **Causa**: Frontend no enviaba estos parámetros y backend no los procesaba
  - **Solución**:
    * Frontend: `handleExport()` en `Vulnerabilidades.jsx` ahora envía `filterNivelRiesgo` y `filterProveedor`
    * Backend: Endpoint `/api/export/excel` ahora procesa `nivel_riesgo`, `proveedor`, `dominio` y `control`
  - **Verificado**: Exportación ahora retorna solo los registros que coinciden con TODOS los filtros seleccionados

- **SISTEMA DE GOBERNANZA COMPLETO - HALLAZGOS Y CATÁLOGO (2026-06-30)**:
  - **Catálogo de Riesgos**: Integración completa de modales de gobernanza
    * `DeleteWithJustificationModal` para eliminaciones con justificación obligatoria
    * `ConfirmChangesModal` con Diff visual antes de actualizar registros
    * Creación directa sin modal diff (solo para ediciones)
    * Data-testids añadidos: `btn-editar-riesgo-{id}`, `btn-eliminar-riesgo-{id}`
  - **Hallazgos de Auditoría**: Integración completa de modales de gobernanza
    * Misma arquitectura que Vulnerabilidades y Catálogo de Riesgos
    * Modal Diff muestra campos modificados con valor anterior/nuevo
    * Data-testids añadidos: `btn-editar-hallazgo-{id}`, `btn-eliminar-hallazgo-{id}`
  - **Tests**: 8/8 pruebas pasadas (iteration_27.json) - 100% éxito

- **SISTEMA DE GOBERNANZA Y CONTROL (2026-06-30)**:
  - **Flujo de Borrado con Justificación Obligatoria**:
    * Componente reutilizable `DeleteWithJustificationModal.jsx`
    * Modal requiere nota mínima de 10 caracteres antes de habilitar botón de eliminar
    * Backend: Todos los endpoints DELETE ahora requieren parámetro `justificacion` (Query, min 10 chars)
    * Endpoints actualizados: vulnerabilidades, usuarios, instituciones, aplicaciones, proveedores, informes-pentest, responsables, grupos-informes, vistas-guardadas
    * Eliminaciones se registran en colección de auditoría con campo `justificacion_borrado`
  - **Modal de Confirmación con Diff Visual**:
    * Componente reutilizable `ConfirmChangesModal.jsx`
    * Al editar vulnerabilidades, muestra comparación visual de campos modificados
    * Valor anterior (rojo) → Valor nuevo (verde)
    * Contador de campos modificados
    * Botones: "Cancelar y Seguir Editando" / "Sí, Confirmar y Guardar"
  - **Barra de Búsqueda en Auditoría**:
    * Filtrado reactivo local de registros en la tabla de logs
    * Búsqueda por usuario, elemento, acción, descripción, justificación
    * Indicador de coincidencias encontradas
  - **Tests**: 6/6 tests pasados en test_delete_justification.py

- **FILTRO DE PROVEEDOR EN VULNERABILIDADES (2026-06-30)**:
  - MultiSelectFilter para filtrar por proveedor
  - Backend actualizado para soportar múltiples valores de proveedor

- **REORGANIZACIÓN FORMULARIOS VULNERABILIDADES (2026-06-26)**:
  - Secciones "Vinculación GRC" y "Riesgo del Catálogo" movidas al final del formulario
  - Aplica tanto al modal de Vista como al de Edición

- **CONSOLIDACIÓN MASTER MÓDULO SEGUIMIENTO (2026-06-26)**:
  - **Backend - 7 Estados Literal**: Validación Pydantic estricta con:
    * Corregido, Pendiente, Impedimento, Vulnerable, Desestimado, Para Re Test, Nota de Seguimiento
  - **Backend - 6 Casos de Ciclo de Vida (A-F)**:
    * CASO A (Cierre): Corregido/Desestimado → estatus=Cerrado, +veces_en_retest, fecha=null
    * CASO B (Impedimento): Bloqueo operativo, fecha reprogramable, NO +veces_en_retest
    * CASO C (Vulnerable): Persiste, +veces_en_retest, puede limpiar fecha
    * CASO D (Para Re Test): Congela fecha y contadores, estatus=Pendiente
    * CASO E (Pendiente): Exclusión mutua prórroga vs retest fallido
    * CASO F (Nota de Seguimiento): Comentario puro, sin impacto en contadores
  - **Frontend - 4 Pestañas de Vista** en SeguimientoRiesgos:
    * Activas con Fecha: Vulnerabilidades abiertas con calendario activo
    * En Análisis: Sin fecha, último estado Vulnerable/Impedimento
    * En Retest: Estado "Para Re Test" en validación con proveedor
    * Histórico Cerrado: Corregido/Desestimado
  - **Frontend - Badges Dinámicos**:
    * `[ 🧪 En Retest ]` cyan para estado Para Re Test
    * `[ ⏳ En Análisis ]` amber para vulnerabilidades sin fecha
    * `[ ⚠️ VENCIDA ]` rojo para vulnerabilidades con fecha vencida
  - **Frontend - Formulario con 7 estados**: Dropdown con descripciones claras
  - **Frontend - Fecha deshabilitada** para: Corregido, Desestimado, Para Re Test, Nota de Seguimiento
  - **Frontend - Timeline en Vulnerabilidades**: Componente reutilizado en modo solo lectura
  - **Tests**: 28/28 tests pasados en test_seguimiento_bitacora.py

- **MODO AUDITORÍA Y BÚSQUEDA - SEGUIMIENTO (2026-06-24)**:
  - Backend: Parámetro `incluir_cerradas=true` para mostrar histórico de cerradas
  - Backend: Parámetro `busqueda` para filtrar por código o nombre de vulnerabilidad
  - Frontend: Tabs de alternancia "Vulnerabilidades Activas" / "Histórico Cerrado"
  - Frontend: Barra de búsqueda con debounce (300ms) e indicador de resultados
  - Modo Auditoría oculta KPIs y filtros de fecha (no aplican para cerradas)
  - Indicador visual de modo activo con mensaje explicativo
  - Botón "Limpiar" para resetear búsqueda

- **INDICADORES VISUALES TIPO DE REGISTRO - SEGUIMIENTO (2026-06-24)**:
  - Timeline muestra tipo de registro para cada entrada:
    * **Retest Técnico** (cyan): Pendiente sin cambio de fecha
    * **Prórroga Administrativa** (púrpura): Pendiente con nueva fecha
    * **Validación Técnica** (verde/naranja): Corregido, Vulnerable, Desestimado
    * **Bloqueo Operativo** (rojo): Impedimento
  - Leyenda visual de tipos en la cabecera de la bitácora
  - Subtipo descriptivo para cada entrada (ej: "Remediación exitosa", "Reprogramación de fecha")
  - Iconos diferenciados: TestTube2, ArrowRightLeft, CheckCheck, Ban, XCircle

- **REGLA EXCLUSIÓN MUTUA PENDIENTE - SEGUIMIENTO (2026-06-24)**:
  - CASO A (Prórroga): Pendiente + fecha_nueva != fecha_actual
    * SÍ incrementa veces_cambiada_fecha
    * NO incrementa veces_en_retest (solo se movió el calendario)
  - CASO B (Retest fallido): Pendiente + fecha_nueva == fecha_actual (o sin fecha)
    * SÍ incrementa veces_en_retest (se validó técnicamente)
    * NO incrementa veces_cambiada_fecha
  - Suite de pruebas actualizada: `/app/backend/tests/test_seguimiento_bitacora.py` (28 tests)
  - Clase `TestPendienteExclusionLogic` con 6 tests específicos
  - Clase `TestNewStates` con 3 tests para Para Re Test y Nota de Seguimiento
  - Clase `TestSeguimientoRiesgosVista` con 5 tests para el parámetro vista

- **AJUSTES REGLAS DE NEGOCIO - SEGUIMIENTO (2026-06-24)**:
  - Validación Pydantic Literal para `resultado_retest`: Solo acepta ["Corregido", "Pendiente", "Impedimento", "Vulnerable", "Desestimado", "Para Re Test", "Nota de Seguimiento"]
  - Estados de cierre (Corregido/Desestimado): fecha_compromiso forzada a null, NO incrementa veces_cambiada_fecha
  - Impedimento: NO incrementa veces_en_retest (la validación técnica no pudo ejecutarse)
  - Para Re Test: Congela fecha y todos los contadores (en validación con proveedor)
  - Nota de Seguimiento: Comentario puro, no altera ningún contador ni fecha
  - Vulnerable/Pendiente/Corregido/Desestimado: SÍ incrementan veces_en_retest
  - Frontend: Campo fecha deshabilitado automáticamente al seleccionar estados que no permiten fecha
  - Mensaje visual según estado: "(No aplica para cierre)", "(Se congela fecha - En validación)", "(No altera fecha)"

- **SUBMÓDULO BITÁCORA E IMPEDIMENTOS - SEGUIMIENTO (2026-06-24)**:
  - Nuevo campo `veces_cambiada_fecha` - Contador de veces que se reprograma la fecha de compromiso
  - Nuevo campo `historial_impedimentos_seguimiento` - Array de entradas de bitácora con:
    * id_accion, fecha_registro_nota, resultado_retest, fecha_compromiso_asignada
    * notas_impedimento (crítico para documentar bloqueos)
    * usuario_registro
  - Endpoint `POST /api/seguimiento/{vuln_id}/registrar` - Registra entrada de bitácora
  - Endpoint `GET /api/seguimiento/{vuln_id}/historial` - Obtiene historial ordenado cronológicamente
  - Frontend: Badge `⚠️ VENCIDA` animado en tabla de seguimiento
  - Frontend: Modal con tabs Info/Bitácora y formulario de registro
  - Frontend: Timeline visual con estados coloreados y notas de impedimento
  - Lógica automática: Incrementa contador solo si fecha cambia, sincroniza estatus
  - 14/14 tests backend pasados, frontend E2E verificado

- **SIDEBAR COLAPSABLE (2026-06-19)**:
  - Nueva funcionalidad para colapsar/expandir la barra lateral izquierda
  - Botón toggle con iconos dinámicos (PanelLeftClose/PanelLeft)
  - Estado persistido en localStorage (se mantiene al recargar)
  - Sidebar colapsado muestra solo iconos centrados con tooltips
  - Transiciones suaves con Tailwind (`transition-all duration-300`)
  - Optimiza espacio para Vista Comité, Dashboard GRC y tablas densas
  - Ancho expandido: 256px (w-64), Ancho colapsado: 72px (w-[72px])

- **VISTA COMITÉ - EXCEL EJECUTIVO (2026-06-19)**:
  - Nuevo endpoint `PUT /api/vistas-comite/{id}` para actualizar vistas existentes sin crear duplicados
  - Nuevo endpoint `GET /api/vistas-comite/{id}/exportar-excel` para exportación Excel con formato ejecutivo
  - Excel generado con Openpyxl con 9 columnas exactas:
    * Nombre de reporte, Fecha Reporte, Críticas (P/T), Altas (P/T)
    * Total Vulns Altas, Estado remediación, Responsable
    * Fecha de compromiso, Tiempo de retraso (meses)
  - Estilos corporativos: Cabecera verde (`4A7C31`), texto blanco negrita, bordes finos
  - Métricas P/T (Pendientes/Total) con color rojo/marrón para items pendientes
  - Frontend con botón "Excel Ejecutivo" y dropdown de Vistas para guardar/cargar/eliminar
  - Router modular en `/app/backend/routes/vista_comite.py`
  - 13/13 tests backend pasados, frontend verificado al 100%

- **BULK UPDATE VECES EN RETEST (2026-06-12)**:
  - Endpoint POST `/api/vulnerabilidades/bulk-update` para incrementar campo `veces_en_retest` masivamente
  - Soporta payload JSON con lista de códigos de vulnerabilidad
- **MATRIZ GRC 4x4 UNIFICADA (Según directiva gerencial)**:
  - Eje Vertical (Probabilidad): Crítica (4), Alta (3), Media (2), Baja (1)
  - Eje Horizontal (Impacto/Nivel de Riesgo): Bajo (1), Medio (2), Medio Alto (3), Alto (4)
  - Vulnerabilidades: Probabilidad SIEMPRE = 3 (Alta) - forzadas en esa fila
  - Hallazgos: Probabilidad e Impacto dinámicos según registro
  - Colores rígidos Tailwind sin gradientes:
    * Verde (`bg-emerald-500`): Bajo
    * Amarillo (`bg-yellow-500`): Medio  
    * Naranja (`bg-orange-500`): Medio Alto
    * Rojo (`bg-red-500/600`): Alto/Crítico
  - Indicadores v=Vulnerabilidad, h=Hallazgo en cada celda
  
- **SWITCH DE VISUALIZACIÓN**:
  - [Combinado]: Muestra V + H combinados
  - [Solo Vulns]: Filtra solo vulnerabilidades (concentradas en fila Alta)
  - [Solo Hallazgos]: Muestra solo hallazgos distribuidos dinámicamente
  - Totales actualizados según modo seleccionado
  
- **Filtro nivel_riesgo en Vulnerabilidades**: MultiSelectFilter para filtrar por nivel GRC (Alto, Medio Alto, Medio, Bajo)

- **Endpoint Bulk Associate GRC**: `/api/admin/bulk-associate-grc` para mapeo masivo de vulnerabilidades a dominios y riesgos mediante JSON con campos (CodigoDeVulns, Dominio, Riesgo)
- **Homogeneización `nivel_riesgo` (Junio 2026)**: Valores estrictos limitados a: "Bajo", "Medio", "Medio Alto", "Alto" en todo el sistema (Pydantic, UI, imports, PDF parsers)
- **Matriz 4×4 (Junio 2026)**: Conversión de matriz de riesgo de 5×5 a 4×4 para hallazgos de auditoría
- **Dashboard de Mando Unificado GRC (Junio 2026)**: Nuevo dashboard tipo Tableau que combina vulnerabilidades técnicas y hallazgos de auditoría en una sola vista. Incluye:
  - 4 KPIs: Vulnerabilidades Activas, Hallazgos Abiertos, Índice de Exposición (score ponderado), Riesgo Total Hallazgos
  - Matriz de Riesgo 5×5 para Hallazgos (colores estáticos basados en metodología clásica, contadores dinámicos con drill-down)
  - Panel de Severidad para Vulnerabilidades (gráfico de barras horizontal con desglose)
  - Top 5 Dominios con Carga Combinada (barras apiladas: severidades + hallazgos)
  - 5 Filtros Globales Multi-select: Informes, Dominios, Responsables, Estado Vuln, Estado Hallazgo
  - Sistema de Vistas Guardadas (CRUD con nombres únicos por usuario, vistas públicas globalmente únicas)
  - Backend: /api/dashboard/data y /api/dashboard/vistas (GET/POST/DELETE)
  - Frontend: /dashboard-grc con Recharts
- **Sistema de Notificaciones Unificado GRC (Mayo 2026)**: El motor de notificaciones por email ahora aplica tanto a Vulnerabilidades como a Hallazgos de Auditoría. Los endpoints `ejecutar_notificaciones` y `resumen_semanal` consultan ambas colecciones en paralelo. El toggle "Enviar a responsables" mapea el responsable de ambas entidades. Emails de alerta y resumen semanal muestran secciones separadas para cada tipo.
- **Unificación Módulo Seguimiento (Mayo 2026)**: El módulo de Seguimiento de Riesgos ahora incluye dos Tabs: "Vulnerabilidades" y "Hallazgos de Auditoría". Ambos tabs comparten KPIs (Vencidas, Próximos 7/30 días, Total Pendientes), filtros comunes, y visualización de detalles en modal. Los registros vencidos (fecha_compromiso < hoy y estado ≠ Cerrado) muestran badge "VENCIDO" en rojo.
- **Nuevos Campos Hallazgos de Auditoría (Mayo 2026)**: Agregados campos `responsable` (dropdown de catálogo existente), `fecha_hallazgo` (default: hoy), y `fecha_compromiso` (deadline para remediación). Validación: fecha_compromiso no puede ser anterior a fecha_hallazgo. Tabla actualizada con columnas nuevas. Plantilla Excel actualizada para import masivo.
- **Importación Masiva GRC (Dic 2025)**: Nuevos endpoints para importar Riesgos del Catálogo y Hallazgos de Auditoría desde Excel. Incluye descarga de plantillas, validación de datos y registro automático en auditoría.
- **Conexión GRC a Auditoría (Dic 2025)**: Todos los módulos GRC (Dominios, Controles, Catálogo de Riesgos, Hallazgos de Auditoría) ahora registran sus cambios en el historial de auditoría del sistema. El filtro de entidades en Auditoría incluye las nuevas opciones GRC.
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

### Dashboard GRC Unificado (NUEVO - Junio 2026)
- [x] 4 KPIs: Vulnerabilidades Activas, Hallazgos Abiertos, Índice de Exposición, Riesgo Promedio
- [x] Matriz de Riesgo 4×4 para Hallazgos de Auditoría (colores estáticos, contadores dinámicos)
- [x] Drill-down en celdas de la matriz (modal con lista de hallazgos)
- [x] Panel de Severidad para Vulnerabilidades (gráfico de barras horizontal)
- [x] **Mapa de Calor GRC Unificado** - Matriz bidimensional (Probabilidad × Impacto) que combina Vulnerabilidades + Hallazgos
  - Vulnerabilidades: Probabilidad SIEMPRE Alta (fila 3-4), Impacto basado en severidad/nivel_riesgo
  - Hallazgos: Probabilidad e Impacto dinámicos según registro
  - Colores rígidos: Verde=Bajo, Amarillo=Medio, Naranja=Alto, Rojo=Crítico
  - Indicadores V (Vuln) y H (Hallazgo) en cada celda
- [x] Drill-down en celdas del Mapa de Calor GRC (modal con lista combinada de vulns y hallazgos)
- [x] Top 5 Dominios con Carga Combinada (barras apiladas)
- [x] 5 Filtros Globales Multi-select (Informes, Dominios, Responsables, Estado Vuln, Estado Hallazgo)
- [x] Grupos de Informes con selector y conteo combinado
- [x] Sistema de Vistas Guardadas (crear, aplicar, eliminar)
- [x] Vistas públicas (visibles para todos) y privadas (solo el creador)
- [x] Backend: `/api/dashboard/data`, `/api/dashboard/vistas` (GET/POST/DELETE)
- [x] Frontend: `/dashboard-grc` con Recharts

### Filtro nivel_riesgo en Vulnerabilidades (NUEVO - Junio 2026)
- [x] MultiSelectFilter para filtrar por nivel de riesgo GRC
- [x] Opciones: Alto, Medio Alto, Medio, Bajo
- [x] Filtrado reactivo en cliente/servidor

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
- [x] **Actualizar Formulario de Vulnerabilidades con GRC** (COMPLETADO - Dic 2025):
  - [x] Sección "Vinculación GRC" con dropdown cascada Dominio → Control
  - [x] Campo "Riesgo del Catálogo" con modal de búsqueda
  - [x] Campo riesgo_asociado eliminado, ahora usa riesgo_id apuntando al catálogo
  - [x] Modal de visualización muestra GRC con control y riesgo asociados
  - [x] Edición carga correctamente control_id y riesgo_id existentes
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