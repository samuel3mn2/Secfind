// react-pivottable onChange también devuelve funciones/renderers/aggregators.
// Al pasar por JSON se convierten en objetos vacíos que rompen una vista cargada.
// Guardar y restaurar únicamente las preferencias editables del análisis.
const CONFIG_FIELDS = [
  'rows', 'cols', 'vals', 'aggregatorName', 'rendererName',
  'valueFilter', 'rowOrder', 'colOrder',
];

export const cleanPivotState = (state) => Object.fromEntries(
  CONFIG_FIELDS.filter(field => state?.[field] !== undefined)
    .map(field => [field, state[field]])
);