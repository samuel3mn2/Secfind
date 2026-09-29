# Cierre de verificación — Tipos de tabla Heatmap Pivot

Fecha:2026-09-29. Seguimiento del informe parcial `iteration_37.json`.

## Causa y corrección
La selección de renderer ya cambiaba correctamente. El DOM recibía colores inline (p.ej. rgb255,246,246) pero el estilo computado era rgb39,39,42 por reglas de fondo `!important`. Se eliminaron duplicados y esa prioridad para celdas/totales/hover, preservando el tema oscuro cuando no hay color inline.

La escala de tablas mantiene blanco→rojo con contraste≥4.5 (`#111111`). Se manejan min=max, valores únicos, nulos y no finitos sin colores NaN. La biblioteca sigue calculando los ámbitos de cada renderer.

## Informe inicial y bloqueo de automatización
El agente aprobó10pruebas unitarias y la primera visualización Heatmap, pero detuvo E2E por3timeouts al buscar Col Heatmap. La revisión read-only y el código de `Dropdown` de la biblioteca confirman que elegir una opción NUEVA mantiene el menú abierto; pulsar de nuevo el trigger lo cierra. La prueba debe consultar `menu.is_visible()` antes de abrir, no alternar a ciegas. No se modificó código del producto para esa observación. Se completó regresión dirigida con selección consciente del estado del menú.

## Pruebas completadas
- **10/10 unitarias**: [0,10,20], iguales, único, negativos, null/NaN/Infinity, vacío, contraste y matriz2×3 que distingue global/row/col. `iteration_37_unit.log`.
- **Ambos módulos**: Table→Heatmap→Col Heatmap→Row Heatmap→Table→Col Heatmap; mismas cifras y totales en todos los modos. Color computado=inline en celdas numéricas y totales, texto#111111. Table vuelve a fondo oscuro sin inline residual.
- Hover no pisa la escala; vacíos oscuros y total general oscuro.
- Hallazgos reales tiene1columna: global y columna legítimamente iguales; fila con único valor usa intensidad media. No se exige diferencia artificial entre modos con datos degenerados.
- **Filtros**: riesgo seleccionar→X→estatus/estado→Escape; una sola ventana, selección conservada.
- **Gráficos**: se cambió a Line Chart en ambos módulos en Paralelo y se verificó SVG/selección. Cambiar renderer de tabla no altera el gráfico.
- **Persistencia**: vistaTEST_PIVOT_HEATMAP_37 guardada, recarga de página, carga desde menú. Renderer Table Row Heatmap y selección de Nivel de riesgo restaurados en ambos módulos. DELETE de vistaTEST HTTP200, sin tocar vistas originales.
- **Desbordamiento detectado en E2E**: Plotly usaba ancho de ventana completa en paralelo. Corregido con `usePivotChartWidth`: ancho real del panel menos controles laterales en desktop; ancho disponible completo en móvil. No se cambió lógica del gráfico ni datos.
- **Verificación final**:4tipos de tabla ambos módulos a390×844 y1920×800; paralelo con gráficos en ambos módulos, overflow[] y números coloreados correctamente. Capturas finales en sesión de navegador20260929_144056; capturas son artefactos del navegador, no archivos de esta carpeta.
- E2E persistencia/filtros registrado en sesión20260929_143842; comprobaciones funcionales pasaron antes de detectar el overflow, corregido y verificado después.

## Alcance y pendientes
- Ningún cambio backend, credenciales o integraciones. Sin APIs simuladas.
- Datos originales no modificados; pruebas unitarias usan datos locales de prueba sin persistencia.
- Build final aprobado (`CI=false yarn build`,41.35s). Advertencias heredadas de hooks fuera del Pivot y tamaño del bundle; sin errores. Log: `iteration_37_final_build.log`.
- Pendiente verificación del usuario en su instalación Windows. No necesita migración.
- Recomendaciones futuras del informe inicial: extraer CSS de PivotAnalysis.jsx y reducir reglas!important restantes; fuera de esta corrección específica.