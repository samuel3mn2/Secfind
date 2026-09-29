// Posicionar sin tapar el triángulo que abre/cierra el filtro. Los desplazamientos
// manuales siguen perteneciendo a react-draggable (no sobrescribir transform).
export const positionPivotFilter = (box, trigger) => {
  if (!box || !trigger || window.innerWidth < 1024) return;
  const anchor = trigger.getBoundingClientRect();
  const below = Math.max(0, window.innerHeight - anchor.bottom - 24);
  const above = Math.max(0, anchor.top - 24);
  const placeBelow = below >= Math.min(box.offsetHeight, 240) || below >= above;
  const available = Math.max(120, placeBelow ? below : above);
  box.style.setProperty('--pivot-filter-max-height', `${available}px`);
  const height = Math.min(box.offsetHeight, available);
  const left = Math.max(16, Math.min(anchor.left, window.innerWidth - box.offsetWidth - 16));
  const top = Math.max(16, placeBelow ? anchor.bottom + 8 : anchor.top - height - 8);
  box.style.setProperty('--pivot-filter-left', `${left}px`);
  box.style.setProperty('--pivot-filter-top', `${top}px`);
};