# Cierre de hallazgos — Filtros Pivot GRC

Fecha:2026-09-29. Verificación dirigida posterior al informe36, sin sustituirlo.

## Resultados
1. **Reapertura acumulativa:** reproducida antes del cambio en ambos módulos (riesgo y estatus/estado visibles simultáneamente después de cerrar riesgo). Ahora X desmonta el popup; no vuelve a aparecer al abrir otro.
2. **Alternancia del mismo triángulo:** el estado de la biblioteca funcionaba, pero su ventana tapaba el disparador. Posicionamiento corregido. Clics físicos sin `force` verificados en Vulnerabilidades/Hallazgos × Solo Tabla/Solo Gráfico/Paralelo: abre→cierra→abre→X,6/6.
3. **Móvil:** CSS transform del atributo creaba un containing block para el popup fijo. Se corrigió especificidad y se excluyó transform de la transición al abrirlo. Rectángulos medidos inmediatamente:
   - Vulnerabilidades,3layouts: x16, y215.75, ancho358, alto412.5.
   - Hallazgos,3layouts: x16, y282.75, ancho358, alto278.5.
   - Viewport390x844, overflow[] en las6combinaciones. X accesible y DOM sin ventanas después del cierre.
4. **Escritorio:** viewport1920x800, overflow[]. Ejemplo Estatus: x698.28, y382.5, ancho300, alto401.5; popup completo dentro del viewport y triángulo accesible.
5. **Escape/clic fuera/apertura de otro filtro:** aprobados por informe36 y comprobaciones dirigidas; selección se conserva al cerrar/reabrir.
6. **Vistas guardadas:** la regresión adicional detectó excepción `aggregators[aggregatorName] is not a function` al recargar una vista. `cleanPivotState` ahora excluye data, funciones y diccionarios de renderers/aggregators del estado guardado y restaurado. Prueba final real: filtrar Nivel de riesgo → guardar TEST_PIVOT_36 → recargar página → cargar vista → valores seleccionados idénticos → abrir Estatus/cerrar riesgo. PASS.
7. **Diálogos y gráficos:** descripciones accesibles en los diálogos GRC e initialDimension1x1 en ResponsiveContainer; no aparecen avisos Description/width(-1) en el log de la prueba final.

## Datos y evidencias
- Vistas temporales de cada intento eliminadas en finally mediante API, HTTP200; no se editaron vistas originales, vulnerabilidades, hallazgos o credenciales.
- Última verificación móvil: sesión de navegador20260929_133822, captura `pivot-verified-mobile.jpg`.
- Verificación desktop/restauración final: sesión20260929_134108, captura `pivot-verified-desktop.jpg`.
- Capturas son artefactos del navegador, no archivos locales en esta carpeta.
- Script de regresión del agente: `/app/tests/test_pivot_filter_lifecycle_regression.py` (función para runner Playwright con sesión ya iniciada, no suite autónoma).
- Build final aprobado (35.35s), con advertencias heredadas de hooks fuera del Pivot y tamaño de bundle. Sin errores de compilación. Log: `/app/test_reports/iteration_36_final_build.log`.
- Verificación Windows local pendiente del usuario. Ninguna integración nueva o simulada.

## Notas de los intentos de prueba
- `only` requiere hover del valor para ser visible (comportamiento nativo); para persistencia se utilizó checkbox real.
- POST de vistas devuelve id/mensaje, no toda la configuración; la comprobación final usa recarga y restauración real en UI.
- Un toast de éxito pausado por hover interceptaba un clic del robot; se comprobó persistencia recargando la página, sin modificar las notificaciones de la aplicación.