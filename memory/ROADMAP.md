# SecFind — Prioridades

Actualizado: 2026-09-29.

## P0 — Verificación del usuario
- [ ] Verificar en Windows local: Dashboard GRC → Análisis Avanzado → Nivel de riesgo → seleccionar → cerrar → Estatus/Estado. Repetir en Vulnerabilidades y Hallazgos.
- [x] Historial de backups: el usuario confirmó «en el ambiente local todo funciona correctamente» el2026-09-29.
- No hay fallos bloqueantes conocidos del Pivot tras la verificación final. El endpoint de migración anterior En Retest sigue disponible; no se ejecutó ni se modificó en este trabajo.

## P1 — Mantenimiento próximo (no iniciado)
- [ ] Refactorizar `server.py` en routers modulares con pruebas de regresión por dominio.

## P2 — Calidad de datos y propuestas
- [ ] Consolidar dominios duplicados «Seguridad EndPoints»/«Seguridad de Endpoints» preservando referencias.
- [ ] Propuesta para el usuario: exportar el historial filtrado a CSV para auditoría. No implementada.
- [ ] Propuesta: contador visible de filtros activos en el Pivot. No implementada.
- [ ] Prueba adicional de permisos de historial con usuario no-admin cuando se faciliten credenciales. No se crearon usuarios en esta iteración.

## Backlog histórico — Requiere priorización antes de iniciar
- Detección de duplicados en importación y creación manual.
- Integración con herramientas de scanning (Nessus, Qualys, etc.).
- Historial de cambios en catálogos: verificar cobertura actual antes de extenderla.
- Dashboard comparativo por períodos.
- Revisar programación automática de notificaciones, independiente del scheduler de backups.
- No sincronizar automáticamente contraseñas admin con un seed sin política explícita de rotación; la recomendación genérica del informe35 no es un bug funcional del historial.

## Completado en la iteración actual
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