# Cierre funcional y visual — Iteración40

Fecha:2026-10-13.

## Solicitud y caso real
- Top5Dominios/CargaCombinada retirado del Dashboard GRC, incluidos gráfico/tooltip/imports y cálculo enrespuesta. Clave `top_dominios:[]` conservada porcompatibilidad.
- Caso read-only id`d17d8ea8-26b0-4e90-b3c6-c88c0d3084f8`, códigoVULN_IP_TPC_3, Acceso no autorizado al saldo de cuentas: IBPresultadoCorregido, IBEVulnerable, globalPendiente.
- Antes: IBP+Pendiente devolvía registro e IBP+Corregido0. Después: IBP+Pendiente0; IBE+Pendiente1; IBP+Corregido yaliasCorregida1. UIcoincidencias IBP:Corregido / Global:Pendiente, sin mutar datos.

## Pruebas
-10/10PASS `/app/backend/tests/test_iteration40_vulnerability_scope.py`, reejecutadas después del informe inicial. JUnitfinal `pytest/pytest_iteration40_final.xml`.
- Se cubren variasappsOR, estatus+resultado por mismaapp, aliascerrado, consulta global sinapps, prioridad deestadoindividual, consultaanteslimit, exportCSV/Excel reales conglobal separado y respuestaDashboard.
- Snapshotreal antes/después idéntico. Fixtures temporales conIDs únicos e informeaislado, cleanupfinally; insert ubicado dentro deltry para limpiar también ante fallos parciales.
- Auth legítima solo para acceder; no pruebas/cambios de seeding, contraseñas o bloqueo.

## Hallazgo móvil del informe inicial resuelto
El informe40 aprobó flujos funcionales, pero la tabla medía1313px dentro deviewport390 (scrolllocal, aunque documento390). Se añadió presentación etiquetada móvil sin ocultar campos elegidos; desktop conserva tabla. Se ajustaron botonescabecera, herramientas, paginación ytabsdetalle para envolverlíneas. La selección de toda la página sigue disponible mediante controlmobile específico.

Prueba visual final en sesión20261013_144059:
- Escritorio1920×800: overflow[].
- Móvil390×844:11celdas/11visibles porregistro (igual adesktop), tabla sin desbordamiento y etiquetaIBP:Corregido legible. Seleccionar/deseleccionar página funciona.
- Modal móvil muestra Aplicaciones que coinciden y Global claramente; overflow[].
- Dashboardmóvil mantiene panelestatus y no muestra Top5.
- Capturas `vuln-scope-final-desktop.jpg` y `vuln-scope-final-mobile.jpg` son artefactos del navegador, noarchivos locales de esta carpeta.

## Alcance y pendientes
- Datos de producción/local no intervenidos. Cambios de lectura ypresentación, no migración ni nuevasintegraciones/credenciales.
- Sin APIs simuladas. Fakecursor en pruebaunitaria solo verifica el límite despuésde filtrar.
- La semántica corregida es la del módulo principalVulnerabilidades, no se cambió porarrastre el filtro de los otrosDashboardspaneles.
- Ruffmodule nuevo y compilaciónPython aprobados. Buildfinal aprobado55.86s (`iteration_40_final_build.log`), sin errores; solo avisos heredados de otros módulos y tamaño del bundle.
- Pendiente comprobación delusuario en Windows local.