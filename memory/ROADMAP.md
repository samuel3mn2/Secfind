# SecFind — Prioridades

Actualizado: 2026-10-02.

## P0 — Verificación del usuario
- [ ] Comprobar en Windows local aplicaciones seleccionadas (una/varias), filtro por estatus, etiquetas por aplicación y Estatus: en cada detalle. No requiere migración.
- [ ] Comprobar en Windows local el nuevo Panel por Nivel de riesgo, multiselección con Severidad, aplicaciones y detalle paginado. No requiere migración.
- [ ] Verificar en Windows local Table → Table Heatmap → Table Col Heatmap → Table Row Heatmap → Table en ambos módulos. Deben cambiar colores según valores/global/columna/fila, no las cifras ni la disposición de ejes.
- [ ] Verificar en Windows local: Dashboard GRC → Análisis Avanzado → Nivel de riesgo → seleccionar → cerrar → Estatus/Estado. Repetir en Vulnerabilidades y Hallazgos.
- [x] Historial de backups: el usuario confirmó «en el ambiente local todo funciona correctamente» el2026-09-29.
- No hay fallos bloqueantes conocidos del Pivot tras la verificación final. El endpoint de migración anterior En Retest sigue disponible; no se ejecutó ni se modificó en este trabajo.

## P1 — Mantenimiento próximo (no iniciado)
- [ ] Refactorizar `server.py` en routers modulares con pruebas de regresión por dominio.
- [ ] Evaluar protección frente a intentos fallidos del inicio de sesión: el informe39 observó6respuestas401sin bloqueo visible. Hallazgo ajeno al alcance de paneles, no auditoría concluyente; requiere revisión específica y política antes de modificar autenticación. No reiniciar contraseñas existentes desde el seed.

## P2 — Calidad de datos y propuestas
- [ ] Consolidar dominios duplicados «Seguridad EndPoints»/«Seguridad de Endpoints» preservando referencias.
- [ ] Propuesta para el usuario: exportar el historial filtrado a CSV para auditoría. No implementada.
- [ ] Propuesta: contador visible de filtros activos en el Pivot. No implementada.
- [ ] Propuesta: leyenda de intensidad relativa para las tablas Heatmap. No implementada.
- [ ] Propuesta: exportar a CSV/Excel el detalle filtrado de vulnerabilidades por aplicación. No implementada.
- [ ] Prueba adicional de permisos de historial con usuario no-admin cuando se faciliten credenciales. No se crearon usuarios en esta iteración.

## Backlog histórico — Requiere priorización antes de iniciar
- Detección de duplicados en importación y creación manual.
- Integración con herramientas de scanning (Nessus, Qualys, etc.).
- Historial de cambios en catálogos: verificar cobertura actual antes de extenderla.
- Dashboard comparativo por períodos.
- Revisar programación automática de notificaciones, independiente del scheduler de backups.
- No sincronizar automáticamente contraseñas admin con un seed sin política explícita de rotación; la recomendación genérica del informe35 no es un bug funcional del historial.

## Completado en la iteración actual
- [x] Selector de aplicaciones múltiple con búsqueda y limpieza; restricción de filas a aplicaciones seleccionadas, sin duplicar totales.
- [x] Resumen de estatus seleccionable, conteos por aplicación y Estatus: destacado en detalle; Sin estado para vacíos reales.
- [x] Combinación con riesgo/severidad/filtros generales y persistencia en Vistas con compatibilidad hacia atrás.
- [x]13pruebas backend de la mejora aprobadas, UI desktop/móvil y build; fixtures y vistasTEST limpiados, datos reales intactos.

## Completado anteriormente — Paneles de riesgo/aplicaciones
- [x] Panel Nivel de riesgo a la derecha de Severidad y aplicaciones afectadas debajo.
- [x] Multiselección OR dentro de dimensiones, AND entre riesgos/severidades y respeto de filtros generales.
- [x] Aplicaciones buscables/paginadas, detalle completo10por página, conteos correctos para múltiples aplicaciones y grupo sin asignar.
- [x] Persistencia de selecciones en vistas; compatibilidad con vistas anteriores; menú de nombres largos y acción eliminar accesible en móvil.
- [x]8/8pruebas backend, UI desktop/móvil, reintentos y overflow[]; sin cambios de datos reales o credenciales.

## Completado anteriormente — Tipos de tabla Pivot
- [x] Modos Heatmap de ambas tablas visibles: corrección de fondos CSS forzados y contraste de cifras.
- [x] Escala segura para celdas vacías/valores iguales/únicos y normalización nativa global/fila/columna;10/10unitarias.
- [x] Ciclos completos4modos, filtros y vistas guardadas conservados; pruebas escritorio/móvil y gráfico en paralelo sin overflow.

## Completado anteriormente — Ventanas Pivot
- [x] Cierre real de ventanas de filtros Pivot en ambos módulos, sin reapertura acumulativa.
- [x] Un filtro abierto a la vez; X/Escape/fuera/otro campo y alternancia del mismo triángulo.
- [x] Ventanas dentro del viewport móvil y desktop sin tapar el triángulo;6combinaciones por tamaño verificadas.
- [x] Restauración de vistas sin funciones serializadas inválidas; vista temporal guardada/recargada/restaurada y limpiada.
- [x] Descripciones accesibles de diálogos y avisos de dimensiones iniciales de gráficos corregidos.

## Completado anteriormente — Backups
- [x] Paginación real y filtros de historial, sin eliminar archivos/registro automáticamente.
- [x] Conteos, navegación, estados de error/vacío/carga, fechas locales inclusivas y ajuste de última página.
- [x] Descarga/eliminación con confirmación preservadas; formulario de configuración independiente.
- [x] Pruebas backend20/20 y UI escritorio/móvil; corrección de contraste calendario verificada.
- [x] Bloqueos Ruff heredados E722/F601 corregidos.
- [x] PRD resumido y documentación histórica separada.