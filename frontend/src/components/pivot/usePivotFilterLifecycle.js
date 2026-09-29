import { useEffect } from "react";
import { positionPivotFilter } from "./positionPivotFilter";

// Usar el cierre de react-pivottable: actualiza `open` y desmonta la ventana.
// Ocultarla mediante CSS deja el estado abierto y provoca reaperturas posteriores.
export const usePivotFilterLifecycle = (rootRef) => {
  useEffect(() => {
    let closing = false;
    const closeFilters = (except = null) => {
      if (closing) return;
      closing = true;
      try {
        rootRef.current?.querySelectorAll('.pvtFilterBox').forEach(box => {
          if (box !== except) box.querySelector('.pvtCloseX')?.click();
        });
      } finally {
        closing = false;
      }
    };
    const onClick = (event) => {
      if (closing || !(event.target instanceof Element)) return;
      const box = event.target.closest('.pvtFilterBox');
      if (box && rootRef.current?.contains(box)) return;
      // Dejar que el mismo triángulo alterne su propia ventana normalmente.
      const trigger = event.target.closest('.pvtTriangle');
      closeFilters(trigger?.closest('li')?.querySelector('.pvtFilterBox'));
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        const trigger = rootRef.current?.querySelector('.pvtFilterBox')?.closest('li')?.querySelector('.pvtTriangle');
        closeFilters();
        trigger?.focus({ preventScroll: true });
      } else if (['Enter', ' '].includes(event.key) && rootRef.current?.contains(event.target)
        && event.target.matches('.pvtTriangle, .pvtCloseX, .pvtButton, .pvtOnly, .pvtCheckContainer p')) {
        event.preventDefault();
        event.target.click();
      }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rootRef]);
};

// Instrumentación accesible del DOM generado por la biblioteca. No modifica
// visibilidad ni manejadores React. Se limita a este análisis Pivot.
export const usePivotFilterControls = (rootRef, loading) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || loading) return;
    const positioned = new WeakSet();
    const mark = (element, id, label, role) => {
      if (!element) return;
      element.setAttribute('data-testid', id);
      if (label) element.setAttribute('aria-label', label);
      if (role) {
        element.setAttribute('role', role);
        element.setAttribute('tabindex', '0');
      }
    };
    const annotate = () => root.querySelectorAll('.pivot-container').forEach(panel => {
      panel.querySelectorAll('li[data-id]').forEach(item => {
        const name = item.getAttribute('data-id');
        const prefix = `pivot-${panel.dataset.pivotId}-filter-${name.replaceAll('_', '-')}`;
        const box = item.querySelector('.pvtFilterBox');
        const trigger = item.querySelector('.pvtTriangle');
        mark(trigger, `${prefix}-trigger`, `Filtrar ${name}`, 'button');
        trigger?.setAttribute('aria-expanded', String(Boolean(box)));
        mark(box, `${prefix}-dialog`, `Filtro ${name}`);
        if (box && !positioned.has(box)) {
          positionPivotFilter(box, trigger);
          positioned.add(box);
        }
        box?.setAttribute('role', 'dialog');
        mark(box?.querySelector('.pvtCloseX'), `${prefix}-close`, `Cerrar filtro ${name}`, 'button');
        mark(box?.querySelector('.pvtSearch'), `${prefix}-search`, `Buscar valores de ${name}`);
        box?.querySelectorAll('.pvtButton').forEach((button, index) => mark(button,
          `${prefix}-${index === 0 ? 'select-all' : 'deselect-all'}`, index === 0 ? 'Seleccionar todos' : 'Deseleccionar todos', 'button'));
        box?.querySelectorAll('.pvtCheckContainer p').forEach((option, index) => {
          mark(option, `${prefix}-option-${index}`, null, 'checkbox');
          option.setAttribute('aria-checked', String(option.classList.contains('selected')));
          mark(option.querySelector('.pvtOnly'), `${prefix}-only-${index}`, 'Seleccionar solo este valor', 'button');
        });
      });
    });
    const observer = new MutationObserver(annotate);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    annotate();
    const reposition = () => root.querySelectorAll('.pvtFilterBox').forEach(box =>
      positionPivotFilter(box, box.closest('li')?.querySelector('.pvtTriangle')));
    window.addEventListener('resize', reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
    };
  }, [rootRef, loading]);
};