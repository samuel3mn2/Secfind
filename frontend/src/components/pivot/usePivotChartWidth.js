import { useLayoutEffect, useState } from "react";

// La biblioteca calcula el gráfico desde el ancho de la ventana, no del panel.
// En vista paralela hay que descontar los controles laterales del espacio real.
export const usePivotChartWidth = (panelRef, activeModule, layoutMode, loading) => {
  const [width, setWidth] = useState(undefined);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || loading) return;
    const measure = () => {
      const sidebar = window.innerWidth >= 1024
        ? panel.querySelector('.pvtRenderers')?.getBoundingClientRect().width || 0
        : 0;
      setWidth(Math.max(1, Math.floor(panel.clientWidth - sidebar - 8)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [panelRef, activeModule, layoutMode, loading]);
  return width;
};