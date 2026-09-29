// Mantener la escala blanco→rojo del renderer de tablas, sin NaN cuando
// una fila/columna tiene un único valor o todos sus valores son iguales.
// Los ámbitos global/fila/columna los calcula react-pivottable, no este módulo.
export const tableHeatmapColorScale = (values) => {
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return () => ({});
  const min = finiteValues.reduce((current, value) => Math.min(current, value), Infinity);
  const max = finiteValues.reduce((current, value) => Math.max(current, value), -Infinity);
  return (value) => {
    if (!Number.isFinite(value)) return {};
    const intensity = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    const channel = 255 - Math.round(255 * intensity);
    return { backgroundColor: `rgb(255, ${channel}, ${channel})` };
  };
};