# SecFind — Prioridades

Actualizado: 2026-09-18.

## P0 — Verificación del usuario
- [ ] Comprobar Configuración → Backups en Windows local: 10/25/50, filtros y navegación. No requiere migración ni eliminación de respaldos.
- [ ] Confirmar que se ejecutó la migración local de «Para Re Test» a «En Retest» mediante `POST /api/admin/migrar-estatus-retest` (trabajo previo). Si el usuario necesita alternativa a curl, ofrecer botón administrativo con confirmación; no implementado aún.
- No hay fallos bloqueantes conocidos en el historial mejorado.

## P1 — Mantenimiento próximo (no iniciado)
- [ ] Refactorizar `server.py` en routers modulares con pruebas de regresión por dominio.

## P2 — Calidad de datos y propuestas
- [ ] Consolidar dominios duplicados «Seguridad EndPoints»/«Seguridad de Endpoints» preservando referencias.
- [ ] Propuesta para el usuario: exportar el historial filtrado a CSV para auditoría. No implementada.
- [ ] Prueba adicional de permisos de historial con usuario no-admin cuando se faciliten credenciales. No se crearon usuarios en esta iteración.

## Backlog histórico — Requiere priorización antes de iniciar
- Detección de duplicados en importación y creación manual.
- Integración con herramientas de scanning (Nessus, Qualys, etc.).
- Historial de cambios en catálogos: verificar cobertura actual antes de extenderla.
- Dashboard comparativo por períodos.
- Revisar programación automática de notificaciones, independiente del scheduler de backups.
- No sincronizar automáticamente contraseñas admin con un seed sin política explícita de rotación; la recomendación genérica del informe35 no es un bug funcional del historial.

## Completado en la iteración actual
- [x] Paginación real y filtros de historial, sin eliminar archivos/registro automáticamente.
- [x] Conteos, navegación, estados de error/vacío/carga, fechas locales inclusivas y ajuste de última página.
- [x] Descarga/eliminación con confirmación preservadas; formulario de configuración independiente.
- [x] Pruebas backend20/20 y UI escritorio/móvil; corrección de contraste calendario verificada.
- [x] Bloqueos Ruff heredados E722/F601 corregidos.
- [x] PRD resumido y documentación histórica separada.