# Cierre funcional — Aplicaciones y estatus GRC

Fecha:2026-10-02.

## Resultado del alcance aprobado
- Filtro múltiple de aplicaciones con búsqueda: solo aparecen filas seleccionadas, incluso con vulnerabilidades compartidas. OR dentro de cada dimensión y AND entre aplicaciones/estatus/riesgo/severidad; filtros generales respetados.
- Resumen de estatus, conteos por aplicación y línea Estatus: explícita y coloreada en el detalle. Ausentes/null/vacío/espacios→Sin estado, sin modificar documentos.
- Persistencia en Vistas y limpieza de selección; active-only por defecto, cerradas/corregidas/desestimadas al incluirlas expresamente con estados generales.
- API sinObjectId, nombres con coma/&/Unicode preservados mediante parámetros repetidos y paginación anterior conservada.

## Evidencias y cobertura
- Suite39general:8PASS+1SKIP (opcional, requiere nombre con coma/& en dataset real).
- Nueva suite de casos controlados:5/5PASS, cubre completamente el caso omitido más null/legacy/duplicados/estados de cierre/AND-OR/nombres largos. Ver `iteration_39_edge_followup.json`.
- Fixtures mejorados tras revisión: IDs con UUIDpor ejecución, sin borrado preventivo de IDs fijos, cleanup exacto por IDs+informe en finally. Reejecución final:5PASS y luego8PASS+1SKIP, baseline152activas intacto.
- Logs JUnit finales: `pytest/pytest_iteration39_edges_final.xml` y `pytest/pytest_iteration39_final.xml`.
- Regresión anterior38:8/8PASS. Ruff E722/F601/F821/F401 de módulos afectados y compilación Python aprobados.
- Buildfrontend aprobado33.13s, `iteration_39_build.log`; solo avisos heredados en otros módulos y bundle, sin errores nuevos.
- SmokeUI principal con medidas válidas1920×800 y390×844: sesión20261002_140936, capturas `grc-app-status-desktop.jpg` y `grc-app-status-mobile.jpg` (artefactos del navegador). Ambas overflow[]. El agente de pruebas mencionó1920×1080; esa medida no se usa como evidencia final, se usan las capturas válidas del principal.
- Ejemplo real: AD+MBP=24vulnerabilidades,20Pendiente+4EnProceso, solo2filas de app. EnProceso deja4vulnerabilidades y una app; cada detalle muestra EnProceso explícito.
- PruebasUI del agente: guardar/cargar/eliminar vistaTEST por UI, multiselección/normalizaciónSinestado y responsive móvil. VistasTEST eliminadas.
- Sin APIs simuladas y sin modificaciones a datos originales, usuarios o credenciales.

## Observaciones fuera del alcance
El primer informe incluyó pruebas de6intentos fallidos de login y una recomendación de reconciliar contraseña admin con seed, aunque la tarea no modificaba autenticación. El login legítimo funciona. No se implementó una nueva política de bloqueo ni se sobrescribieron contraseñas; se registra evaluación de protección frente a intentos fallidos en ROADMAP. Esta observación no es una regresión introducida por los paneles ni constituye una auditoría de seguridad completa.

## Pendiente
Verificación del usuario en Windows local. No requiere migración ni configuración nueva.