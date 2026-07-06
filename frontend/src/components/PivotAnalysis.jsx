import React, { useEffect, useMemo, useState } from "react";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-basic-dist";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, Download, BarChart3, Table2, Info, Filter, FileText, Shield, 
  AlertTriangle, Columns, Maximize2, LayoutGrid 
} from "lucide-react";
import { toast } from "sonner";

// Crear componente Plot con Plotly
const Plot = createPlotlyComponent(Plotly);

// Crear renderers de Plotly para gráficos
const PlotlyRenderers = createPlotlyRenderers(Plot);

// Escala de colores para nivel de riesgo
const RISK_COLORS = {
  "Alto": "#ef4444",
  "Medio Alto": "#f97316",
  "Medio": "#eab308",
  "Bajo": "#22c55e"
};

// Tipos de layout
const LAYOUT_TYPES = {
  SPLIT: "split",
  TABLE_ONLY: "table",
  CHART_ONLY: "chart"
};

// Estilos CSS AGRESIVOS para sobrescribir TODOS los elementos de react-pivottable
const darkModeStyles = `
  /* =====================================================
     PIVOT TABLE - DARK MODE - MAXIMUM OVERRIDE
     Todos los elementos con !important para garantizar
     legibilidad absoluta en fondo oscuro
     ===================================================== */
  
  /* === CONTENEDOR PRINCIPAL === */
  .pvtUi {
    background: transparent !important;
    color: #ffffff !important;
    font-family: inherit !important;
  }
  
  /* === SELECTORES Y DROPDOWNS - CRÍTICO === */
  .pvtUi select,
  .pvtRenderers select,
  .pvtAggregator select,
  .pvtAttrDropdown select,
  .pvtVals select,
  select.pvtAttrDropdown,
  .pvtAxisContainer select,
  .pvtUi option,
  .pvtRenderers option,
  .pvtAggregator option {
    background: #1e1e21 !important;
    background-color: #1e1e21 !important;
    color: #ffffff !important;
    border: 2px solid #4f46e5 !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-weight: 500 !important;
    font-size: 14px !important;
    cursor: pointer !important;
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    appearance: none !important;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e") !important;
    background-repeat: no-repeat !important;
    background-position: right 8px center !important;
    background-size: 16px !important;
    padding-right: 32px !important;
  }
  
  .pvtUi select:hover,
  .pvtRenderers select:hover,
  .pvtAggregator select:hover {
    border-color: #818cf8 !important;
    background-color: #27272a !important;
  }
  
  .pvtUi select:focus,
  .pvtRenderers select:focus,
  .pvtAggregator select:focus {
    outline: none !important;
    border-color: #a5b4fc !important;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3) !important;
  }
  
  /* OPTIONS dentro de selects */
  .pvtUi select option,
  .pvtRenderers select option,
  .pvtAggregator select option,
  select option {
    background: #1e1e21 !important;
    background-color: #1e1e21 !important;
    color: #ffffff !important;
    padding: 10px !important;
    font-weight: 500 !important;
  }
  
  .pvtUi select option:hover,
  .pvtUi select option:checked,
  select option:hover,
  select option:checked {
    background: #4f46e5 !important;
    background-color: #4f46e5 !important;
    color: #ffffff !important;
  }
  
  /* === INPUTS === */
  .pvtUi input,
  .pvtSearch,
  .pvtSearch input,
  .pvtFilterBox input {
    background: #1e1e21 !important;
    color: #ffffff !important;
    border: 2px solid #3f3f46 !important;
    border-radius: 6px !important;
    padding: 8px 12px !important;
    font-weight: 500 !important;
  }
  
  .pvtUi input:focus,
  .pvtSearch input:focus,
  .pvtFilterBox input:focus {
    border-color: #6366f1 !important;
    outline: none !important;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3) !important;
  }
  
  .pvtUi input::placeholder {
    color: #71717a !important;
  }
  
  /* === TABLA DE RESULTADOS === */
  .pvtTable {
    background: #18181b !important;
    color: #ffffff !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    border: 1px solid #3f3f46 !important;
  }
  
  .pvtTable th,
  .pvtTable td {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    padding: 10px 14px !important;
    color: #ffffff !important;
    font-weight: 500 !important;
    font-size: 13px !important;
  }
  
  .pvtTable th {
    background: #3f3f46 !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    text-transform: uppercase !important;
    font-size: 11px !important;
    letter-spacing: 0.5px !important;
  }
  
  .pvtTable tbody tr:hover td {
    background: #353538 !important;
  }
  
  .pvtTable .pvtTotal,
  .pvtTable .pvtGrandTotal {
    background: #1e1e21 !important;
    font-weight: 700 !important;
    color: #a5b4fc !important;
    border-color: #4f46e5 !important;
  }
  
  .pvtColLabel,
  .pvtRowLabel {
    font-weight: 700 !important;
    color: #ffffff !important;
  }
  
  /* === CONTENEDORES DE ARRASTRE === */
  .pvtAxisContainer,
  .pvtVals,
  .pvtRows,
  .pvtCols,
  .pvtUnused {
    background: #1e1e21 !important;
    border: 2px solid #3f3f46 !important;
    border-radius: 8px !important;
    padding: 12px !important;
    min-height: 60px !important;
  }
  
  .pvtAxisContainer:hover,
  .pvtVals:hover {
    border-color: #4f46e5 !important;
  }
  
  .pvtUnused {
    border-style: dashed !important;
  }
  
  /* === ELEMENTOS ARRASTRABLES (ATRIBUTOS) === */
  .pvtAxisContainer li,
  .pvtAxis li,
  .pvtAttr,
  span.pvtAttr {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
    border: 1px solid #818cf8 !important;
    border-radius: 6px !important;
    color: #ffffff !important;
    padding: 8px 14px !important;
    margin: 4px !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    cursor: grab !important;
    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4) !important;
    transition: all 0.2s ease !important;
    display: inline-flex !important;
    align-items: center !important;
  }
  
  .pvtAxisContainer li:hover,
  .pvtAxis li:hover,
  .pvtAttr:hover {
    background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5) !important;
  }
  
  .pvtAxisContainer li:active,
  .pvtAxis li:active,
  .pvtAttr:active {
    cursor: grabbing !important;
    transform: scale(1.02) !important;
  }
  
  /* === TRIÁNGULO DE FILTRO === */
  .pvtTriangle {
    color: #ffffff !important;
    border-left-color: transparent !important;
    border-right-color: transparent !important;
    border-top-color: #ffffff !important;
    margin-left: 6px !important;
  }
  
  /* === FILTER BOX (POPUP DE FILTROS) === */
  .pvtFilterBox {
    background: #1e1e21 !important;
    border: 2px solid #4f46e5 !important;
    border-radius: 10px !important;
    color: #ffffff !important;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6) !important;
    padding: 16px !important;
    z-index: 9999 !important;
  }
  
  .pvtFilterBox h4 {
    color: #ffffff !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    margin-bottom: 12px !important;
    padding-bottom: 8px !important;
    border-bottom: 1px solid #3f3f46 !important;
  }
  
  .pvtFilterBox p {
    color: #a1a1aa !important;
    font-size: 12px !important;
  }
  
  .pvtFilterBox button {
    background: #4f46e5 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 8px 16px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
    margin: 4px !important;
  }
  
  .pvtFilterBox button:hover {
    background: #6366f1 !important;
    transform: translateY(-1px) !important;
  }
  
  .pvtFilterBox .pvtSearch {
    margin-bottom: 12px !important;
  }
  
  /* === CHECKBOX CONTAINER === */
  .pvtCheckContainer {
    background: #27272a !important;
    color: #ffffff !important;
    max-height: 280px !important;
    overflow-y: auto !important;
    border-radius: 6px !important;
    border: 1px solid #3f3f46 !important;
    padding: 8px !important;
  }
  
  .pvtCheckContainer p,
  .pvtCheckContainer label {
    color: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    padding: 6px 10px !important;
    cursor: pointer !important;
    border-radius: 4px !important;
    font-size: 13px !important;
  }
  
  .pvtCheckContainer p:hover,
  .pvtCheckContainer label:hover {
    background: #3f3f46 !important;
  }
  
  .pvtCheckContainer input[type="checkbox"] {
    accent-color: #6366f1 !important;
    width: 16px !important;
    height: 16px !important;
    margin-right: 10px !important;
  }
  
  /* === DROPDOWN MENU DE ATRIBUTOS === */
  .pvtDropdown,
  .pvtAttrDropdown {
    background: #1e1e21 !important;
    color: #ffffff !important;
    border: 2px solid #4f46e5 !important;
    border-radius: 8px !important;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5) !important;
    z-index: 9999 !important;
  }
  
  .pvtDropdown li,
  .pvtAttrDropdown li {
    background: transparent !important;
    color: #ffffff !important;
    padding: 10px 14px !important;
    cursor: pointer !important;
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  
  .pvtDropdown li:hover,
  .pvtAttrDropdown li:hover {
    background: #4f46e5 !important;
    transform: none !important;
  }
  
  /* === RENDERERS Y AGGREGATOR LABELS === */
  .pvtRenderers,
  .pvtAggregator {
    margin-bottom: 12px !important;
  }
  
  .pvtRenderers label,
  .pvtAggregator label {
    color: #a1a1aa !important;
    font-size: 11px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    margin-bottom: 4px !important;
    display: block !important;
  }
  
  /* === CLOSE BUTTON (X) === */
  .pvtFilterBox .pvtCloseX,
  .pvtCloseX,
  a.pvtCloseX {
    color: #ffffff !important;
    background: #ef4444 !important;
    border-radius: 50% !important;
    width: 24px !important;
    height: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 14px !important;
    cursor: pointer !important;
    text-decoration: none !important;
  }
  
  .pvtFilterBox .pvtCloseX:hover,
  .pvtCloseX:hover,
  a.pvtCloseX:hover {
    background: #dc2626 !important;
  }
  
  /* === PLOTLY DARK MODE === */
  .js-plotly-plot .plotly,
  .js-plotly-plot .plotly .modebar {
    background: transparent !important;
  }
  
  .js-plotly-plot .plotly .modebar-btn path {
    fill: #a1a1aa !important;
  }
  
  .js-plotly-plot .plotly .modebar-btn:hover path {
    fill: #ffffff !important;
  }
  
  /* Plotly axis labels and text */
  .js-plotly-plot .plotly text,
  .js-plotly-plot .plotly .xtick text,
  .js-plotly-plot .plotly .ytick text,
  .js-plotly-plot .plotly .gtitle,
  .js-plotly-plot .plotly .g-gtitle text {
    fill: #ffffff !important;
  }
  
  /* === SCROLLBAR PERSONALIZADO === */
  .pvtTable::-webkit-scrollbar,
  .pvtCheckContainer::-webkit-scrollbar,
  .pivot-container-table::-webkit-scrollbar,
  .pivot-container-chart::-webkit-scrollbar {
    width: 10px !important;
    height: 10px !important;
  }
  
  .pvtTable::-webkit-scrollbar-track,
  .pvtCheckContainer::-webkit-scrollbar-track,
  .pivot-container-table::-webkit-scrollbar-track,
  .pivot-container-chart::-webkit-scrollbar-track {
    background: #27272a !important;
    border-radius: 5px !important;
  }
  
  .pvtTable::-webkit-scrollbar-thumb,
  .pvtCheckContainer::-webkit-scrollbar-thumb,
  .pivot-container-table::-webkit-scrollbar-thumb,
  .pivot-container-chart::-webkit-scrollbar-thumb {
    background: #4f46e5 !important;
    border-radius: 5px !important;
  }
  
  .pvtTable::-webkit-scrollbar-thumb:hover,
  .pvtCheckContainer::-webkit-scrollbar-thumb:hover {
    background: #6366f1 !important;
  }
  
  /* === LABELS EN FILAS/COLUMNAS === */
  .pvtRowLabel,
  .pvtColLabel,
  .pvtAxisLabel,
  .pvtTotalLabel {
    color: #ffffff !important;
    font-weight: 600 !important;
  }
  
  /* === VALORES NUMÉRICOS === */
  .pvtVal,
  .pvtTotal,
  td.pvtVal {
    color: #ffffff !important;
    font-weight: 500 !important;
    text-align: right !important;
  }
`;

// Tipos de segmentación
const SEGMENT_TYPES = {
  ALL: "all",
  VULNERABILITIES: "vulnerabilities",
  FINDINGS: "findings"
};

/**
 * Componente de Análisis Avanzado con Tabla Pivote
 */
export function PivotAnalysis({ data = [], pivotState, onPivotStateChange, loading = false }) {
  // Estados
  const [activeSegment, setActiveSegment] = useState(SEGMENT_TYPES.ALL);
  const [layoutMode, setLayoutMode] = useState(LAYOUT_TYPES.SPLIT);
  
  const [tableState, setTableState] = useState(pivotState || {
    rows: ["tipo_registro"],
    cols: ["nivel_riesgo"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Table",
    sorters: {},
    rowOrder: "key_a_to_z",
    colOrder: "key_a_to_z"
  });
  
  const [chartState, setChartState] = useState(pivotState || {
    rows: ["tipo_registro"],
    cols: ["nivel_riesgo"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Stacked Bar Chart",
    sorters: {},
    plotlyOptions: { width: 700, height: 450 },
    plotlyConfig: {}
  });

  useEffect(() => {
    if (pivotState) {
      setTableState(prev => ({ ...prev, ...pivotState, rendererName: "Table" }));
      setChartState(prev => ({ ...prev, ...pivotState, rendererName: pivotState.rendererName || "Stacked Bar Chart" }));
    }
  }, [pivotState]);

  // Transformar datos
  const pivotData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(item => {
      let mes_deteccion = "Sin fecha";
      const fecha = item.fecha_hallazgo || item.fecha_identificacion;
      if (fecha) {
        try {
          const d = new Date(fecha);
          const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          mes_deteccion = `${meses[d.getMonth()]} ${d.getFullYear()}`;
        } catch (e) {
          mes_deteccion = "Sin fecha";
        }
      }

      return {
        tipo_registro: item.tipo || "Desconocido",
        area_proceso: item.dominio || item.area_proceso || "Sin área",
        nivel_riesgo: item.nivel_riesgo || item.nivel_riesgo_computed || "Sin clasificar",
        estado: item.estatus || item.estado || "Sin estado",
        responsable: item.responsable || "Sin asignar",
        institucion: item.institucion || "N/A",
        mes_deteccion: mes_deteccion,
        severidad: item.severidad || "N/A",
        informe: item.nombre_informe_pentest || "N/A",
        riesgo_inherente: item.riesgo_inherente || 0,
        codigo: item.codigo || "N/A"
      };
    });
  }, [data]);

  // Filtrar por segmento
  const filteredPivotData = useMemo(() => {
    if (activeSegment === SEGMENT_TYPES.ALL) return pivotData;
    if (activeSegment === SEGMENT_TYPES.VULNERABILITIES) {
      return pivotData.filter(item => item.tipo_registro === "Vulnerabilidad");
    }
    if (activeSegment === SEGMENT_TYPES.FINDINGS) {
      return pivotData.filter(item => item.tipo_registro === "Hallazgo");
    }
    return pivotData;
  }, [pivotData, activeSegment]);

  // Contadores
  const counts = useMemo(() => ({
    all: pivotData.length,
    vulnerabilities: pivotData.filter(item => item.tipo_registro === "Vulnerabilidad").length,
    findings: pivotData.filter(item => item.tipo_registro === "Hallazgo").length
  }), [pivotData]);

  // Sincronizar cambios
  const handleTableChange = (newState) => {
    setTableState(newState);
    setChartState(prev => ({
      ...prev,
      rows: newState.rows,
      cols: newState.cols,
      aggregatorName: newState.aggregatorName,
      vals: newState.vals,
      sorters: newState.sorters
    }));
    
    if (onPivotStateChange) {
      onPivotStateChange({
        rows: newState.rows || [],
        cols: newState.cols || [],
        aggregatorName: newState.aggregatorName || "Count",
        vals: newState.vals || [],
        rendererName: chartState.rendererName || "Stacked Bar Chart",
        sorters: newState.sorters || {},
        rowOrder: newState.rowOrder || "key_a_to_z",
        colOrder: newState.colOrder || "key_a_to_z"
      });
    }
  };

  const handleChartChange = (newState) => {
    setChartState(newState);
    setTableState(prev => ({
      ...prev,
      rows: newState.rows,
      cols: newState.cols,
      aggregatorName: newState.aggregatorName,
      vals: newState.vals,
      sorters: newState.sorters
    }));
    
    if (onPivotStateChange) {
      onPivotStateChange({
        rows: newState.rows || [],
        cols: newState.cols || [],
        aggregatorName: newState.aggregatorName || "Count",
        vals: newState.vals || [],
        rendererName: newState.rendererName || "Stacked Bar Chart",
        sorters: newState.sorters || {},
        rowOrder: newState.rowOrder || "key_a_to_z",
        colOrder: newState.colOrder || "key_a_to_z"
      });
    }
  };

  // Exportar CSV
  const handleExportCSV = () => {
    try {
      const headers = Object.keys(filteredPivotData[0] || {});
      const csvContent = [
        headers.join(","),
        ...filteredPivotData.map(row => headers.map(h => `"${row[h] || ""}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `analisis_pivote_${activeSegment}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      toast.success("Datos exportados a CSV");
    } catch (error) {
      toast.error("Error al exportar datos");
    }
  };

  // Inyectar estilos
  useEffect(() => {
    const styleId = "pivot-dark-mode-styles-v2";
    let style = document.getElementById(styleId);
    if (style) style.remove();
    
    style = document.createElement("style");
    style.id = styleId;
    style.textContent = darkModeStyles;
    document.head.appendChild(style);
    
    return () => {
      const s = document.getElementById(styleId);
      if (s) s.remove();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-zinc-400">Cargando datos para análisis...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <CardTitle className="text-lg text-white">Análisis Avanzado - Tabla Pivote</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                data-testid="export-pivot-csv"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Segmentación */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Segmentar datos:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeSegment === SEGMENT_TYPES.ALL ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSegment(SEGMENT_TYPES.ALL)}
                className={activeSegment === SEGMENT_TYPES.ALL 
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="segment-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Todo (Híbrido)
                <Badge className="ml-2 bg-zinc-700 text-zinc-200">{counts.all}</Badge>
              </Button>
              <Button
                variant={activeSegment === SEGMENT_TYPES.VULNERABILITIES ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSegment(SEGMENT_TYPES.VULNERABILITIES)}
                className={activeSegment === SEGMENT_TYPES.VULNERABILITIES 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="segment-vulnerabilities"
              >
                <Shield className="w-4 h-4 mr-2" />
                Solo Vulnerabilidades
                <Badge className="ml-2 bg-red-900/50 text-red-200">{counts.vulnerabilities}</Badge>
              </Button>
              <Button
                variant={activeSegment === SEGMENT_TYPES.FINDINGS ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSegment(SEGMENT_TYPES.FINDINGS)}
                className={activeSegment === SEGMENT_TYPES.FINDINGS 
                  ? "bg-orange-600 hover:bg-orange-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="segment-findings"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Solo Hallazgos
                <Badge className="ml-2 bg-orange-900/50 text-orange-200">{counts.findings}</Badge>
              </Button>
            </div>
          </div>

          {/* Selector de Layout */}
          <div className="flex flex-col gap-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <LayoutGrid className="w-4 h-4" />
              <span className="font-medium">Modo de visualización:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={layoutMode === LAYOUT_TYPES.SPLIT ? "default" : "outline"}
                size="sm"
                onClick={() => setLayoutMode(LAYOUT_TYPES.SPLIT)}
                className={layoutMode === LAYOUT_TYPES.SPLIT 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="layout-split"
              >
                <Columns className="w-4 h-4 mr-2" />
                Vista Paralelo (Split)
              </Button>
              <Button
                variant={layoutMode === LAYOUT_TYPES.TABLE_ONLY ? "default" : "outline"}
                size="sm"
                onClick={() => setLayoutMode(LAYOUT_TYPES.TABLE_ONLY)}
                className={layoutMode === LAYOUT_TYPES.TABLE_ONLY 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="layout-table"
              >
                <Table2 className="w-4 h-4 mr-2" />
                Solo Tabla (Maximizada)
              </Button>
              <Button
                variant={layoutMode === LAYOUT_TYPES.CHART_ONLY ? "default" : "outline"}
                size="sm"
                onClick={() => setLayoutMode(LAYOUT_TYPES.CHART_ONLY)}
                className={layoutMode === LAYOUT_TYPES.CHART_ONLY 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
                data-testid="layout-chart"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Solo Gráfico (Maximizado)
              </Button>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
            <span className="text-sm text-zinc-500">Escala de Riesgo:</span>
            {Object.entries(RISK_COLORS).map(([nivel, color]) => (
              <div key={nivel} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-400">{nivel}</span>
              </div>
            ))}
          </div>

          {/* Instrucciones */}
          <details className="bg-zinc-800/50 rounded-lg border border-zinc-700">
            <summary className="cursor-pointer p-3 flex items-center gap-2 text-sm text-zinc-300 hover:bg-zinc-800/70 rounded-lg">
              <Info className="w-4 h-4 text-amber-400" />
              <span className="font-medium">Cómo usar la tabla pivote</span>
            </summary>
            <div className="px-3 pb-3 text-sm text-zinc-400">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Arrastra los campos a <span className="text-indigo-400 font-medium">filas</span> o <span className="text-indigo-400 font-medium">columnas</span></li>
                <li>Usa los botones de segmentación para analizar por separado</li>
                <li>Cambia el modo de vista para maximizar tabla o gráfico</li>
                <li>La configuración se guarda con la vista</li>
              </ul>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Contenido según layout */}
      {filteredPivotData.length > 0 ? (
        <div className={`grid gap-4 ${
          layoutMode === LAYOUT_TYPES.SPLIT ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
        }`}>
          {/* Tabla Pivote */}
          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.TABLE_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm text-white">Tabla de Datos</CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                      {filteredPivotData.length} registros
                    </Badge>
                  </div>
                  {layoutMode === LAYOUT_TYPES.TABLE_ONLY && (
                    <Badge className="bg-emerald-600 text-white text-xs">Maximizada</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                <div className="pivot-container-table min-w-full">
                  <PivotTableUI
                    data={filteredPivotData}
                    onChange={handleTableChange}
                    renderers={TableRenderers}
                    {...tableState}
                    rendererName="Table"
                    unusedOrientationCutoff={Infinity}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Gráfico Pivote */}
          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.CHART_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <CardTitle className="text-sm text-white">Visualización Gráfica</CardTitle>
                    <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                      Sincronizado
                    </Badge>
                  </div>
                  {layoutMode === LAYOUT_TYPES.CHART_ONLY && (
                    <Badge className="bg-indigo-600 text-white text-xs">Maximizado</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                <div className="pivot-container-chart min-w-full">
                  <PivotTableUI
                    data={filteredPivotData}
                    onChange={handleChartChange}
                    renderers={PlotlyRenderers}
                    {...chartState}
                    unusedOrientationCutoff={Infinity}
                    hiddenAttributes={["codigo"]}
                    hiddenFromDragDrop={["codigo"]}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Table2 className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No hay datos disponibles</p>
              <p className="text-sm mt-1">Ajusta los filtros o selecciona informes</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PivotAnalysis;
