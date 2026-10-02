# Cierre — Paneles GRC de vulnerabilidades

Fecha:2026-10-02. Complementa `iteration_38.json` tras corregir sus observaciones.

## Hallazgos resueltos
1. **Alias en API:** `selection` normaliza acentos, guiones, mayúsculas y espacios a las categorías canónicas, conservando422para valores desconocidos. Consulta riesgos=Alto,Medio-Alto/severidades=Crítica,Alta y equivalente canónica devuelven JSONidéntico, total10.
2. **Borrado de vista desde menú:** la fila con nombre largo no podía contraerse, desplazando el botón eliminar fuera del área visible. Corregidos min-width, truncado y shrink; contenedor de fila con identificador estable. Prueba: guardar SOLOTEST_GRC_PANELS_38_NOMBRE_LARGO_MULTISELECCION_RIESGO_Y_SEVERIDAD, recargar, cargar, verificar las4selecciones y eliminar mediante clic real+confirmación en390px. HTTP200, vista temporal eliminada.
3. **Responsive:** leyendas anteriores de Dashboard ahora envuelven líneas. Contenedor Sonner usaba100%más desplazamiento izquierdo en móvil aunque el toast era menor: ancho corregido según ambos offsets, sin cambiar el sistema de notificaciones.

## Verificaciones
- Suite `/app/backend/tests/test_iteration38_vulnerability_panels.py`:8/8PASS después de correcciones. JUnit: `pytest/pytest_iteration38_followup.xml`.
- Conteos/facetas comparados contra Mongo real; sin modificaciones a vulnerabilidades/hallazgos/usuarios.
- Selección Alto+MedioAlto y Crítica+Alta:7aplicaciones,10vulnerabilidades. Persistencia real tras reload; ninguna selección perdida.
- Sin aplicación:37vulnerabilidades,4páginas; página2con10registros y rango11–20de37 en UI móvil.
- Pruebas originales del agente: filtros generales, búsqueda/paginación de aplicaciones, detalle y persistencia al ir/volver de Pivot.
- Interrupción de red simulada únicamente en Playwright: paneles y detalle muestran error; al retirar interrupción y pulsar Reintentar muestran datos reales. No hay endpoints simulados en el producto.
- Diseño final1920×800 y390×844 sin desbordamiento, incluido modal con notificación activa. Sesión de navegador final20261002_135941, capturas `grc-panels-toast-mobile-verified.jpg` y `grc-panels-desktop-verified.jpg` (artefactos del navegador, no archivos locales).
- Sesión20261002_135704 aprobó guardado/carga/eliminaciónUI y detalle paginado antes de detectar el ancho del toaster; el desbordamiento se corrigió y verificó en la sesión final.
- Un intento de test forzó un clic durante la animación de cierre de un diálogo y no abrió el siguiente. Se corrigió la secuencia de prueba esperando a que el diálogo esté oculto y usando clic real; no era un fallo del producto.
- Ruff E722/F601/F821/F401 de nuevos módulos aprobado. Build final aprobado en38.60s (`iteration_38_final_build.log`); solo advertencias heredadas de hooks de otros módulos y tamaño del bundle, sin errores.

## Límites/pendientes
- Apps asociadas se cuentan según el registro de vulnerabilidad y sus filtros de estado general; no se creó un nuevo flujo de remediación individual por aplicación.
- Solo estos3paneles usan las selecciones locales nuevas; los demásKPIs/Pivot conservan su comportamiento.
- No se crearon credenciales, nuevas integraciones ni migraciones. VistaTEST eliminada; datos originales intactos.
- Pendiente validación del usuario en Windows local.