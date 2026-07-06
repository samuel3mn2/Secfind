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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, Download, BarChart3, Table2, Info, Shield, 
  AlertTriangle, Columns, Maximize2, LayoutGrid, Target, ClipboardList
} from "lucide-react";
import { toast } from "sonner";

// Crear componente Plot con Plotly
const Plot = createPlotlyComponent(Plotly);
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

// ============================================================================
// CSS ULTRA-AGRESIVO CON SELECTORES COMODÍN PARA FORZAR DARK MODE
// ============================================================================
const FORCED_DARK_MODE_CSS = `
/* ============================================================================
   REACT-PIVOTTABLE DARK MODE - SELECTORES COMODÍN IRREVOCABLES
   Todos los elementos forzados a texto blanco sobre fondo oscuro
   ============================================================================ */

/* FORZAR TEXTO BLANCO EN TODOS LOS ELEMENTOS CON COMODÍN */
.pvtUi *, 
.pvtUi *::before, 
.pvtUi *::after,
.pvtTable *, 
.pvtVals *, 
.pvtAxisContainer *, 
.pvtFilterBox *,
.pvtDropdown *,
.pvtCheckContainer *,
.pvtRenderers *,
.pvtAggregator * {
    color: #ffffff !important;
}

/* CONTENEDOR PRINCIPAL */
.pvtUi {
    background: transparent !important;
    color: #ffffff !important;
    font-family: inherit !important;
}

/* FORZAR FONDO OSCURO EN TODAS LAS CELDAS DE LA TABLA INTERNA */
.pvtUi table,
.pvtUi table td,
.pvtUi table th,
.pvtUi > tbody > tr > td,
table.pvtUi > tbody > tr > td {
    background: #18181b !important;
    background-color: #18181b !important;
}

/* ============================================================================
   SELECTORES Y DROPDOWNS - SOLUCIÓN DEFINITIVA
   ============================================================================ */
select,
.pvtUi select,
.pvtRenderers select,
.pvtAggregator select,
.pvtAttrDropdown select,
.pvtVals select,
.pvtAxisContainer select,
.pvtDropdown select {
    background: #18181b !important;
    background-color: #18181b !important;
    color: #ffffff !important;
    border: 2px solid #6366f1 !important;
    border-radius: 8px !important;
    padding: 10px 36px 10px 14px !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    cursor: pointer !important;
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    appearance: none !important;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e") !important;
    background-repeat: no-repeat !important;
    background-position: right 10px center !important;
    background-size: 18px !important;
    min-width: 180px !important;
}

select:hover,
.pvtUi select:hover {
    border-color: #818cf8 !important;
    background-color: #27272a !important;
}

select:focus,
.pvtUi select:focus {
    outline: none !important;
    border-color: #a5b4fc !important;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4) !important;
}

/* OPTIONS - FORZAR FONDO OSCURO Y TEXTO BLANCO */
option,
select option,
.pvtUi select option,
.pvtRenderers select option,
.pvtAggregator select option {
    background: #18181b !important;
    background-color: #18181b !important;
    color: #ffffff !important;
    padding: 12px 14px !important;
    font-weight: 500 !important;
}

option:hover,
option:checked,
option:focus,
select option:hover,
select option:checked {
    background: #4f46e5 !important;
    background-color: #4f46e5 !important;
    color: #ffffff !important;
}

/* ============================================================================
   INPUTS Y BÚSQUEDA
   ============================================================================ */
input,
.pvtUi input,
.pvtSearch input,
.pvtFilterBox input,
input[type="text"],
input[type="search"] {
    background: #18181b !important;
    background-color: #18181b !important;
    color: #ffffff !important;
    border: 2px solid #3f3f46 !important;
    border-radius: 8px !important;
    padding: 10px 14px !important;
    font-weight: 500 !important;
    font-size: 14px !important;
}

input:focus,
.pvtUi input:focus {
    border-color: #6366f1 !important;
    outline: none !important;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3) !important;
}

input::placeholder {
    color: #71717a !important;
}

/* ============================================================================
   TABLA DE RESULTADOS
   ============================================================================ */
.pvtTable {
    background: #18181b !important;
    color: #ffffff !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    border-radius: 10px !important;
    overflow: hidden !important;
    border: 2px solid #3f3f46 !important;
}

.pvtTable th,
.pvtTable td {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    padding: 12px 16px !important;
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

/* TOTALES - ALTA VISIBILIDAD */
.pvtTotal,
.pvtGrandTotal,
td.pvtTotal,
td.pvtGrandTotal,
th.pvtTotal,
th.pvtGrandTotal {
    background: #1e1e21 !important;
    background-color: #1e1e21 !important;
    font-weight: 700 !important;
    color: #a5b4fc !important;
    border-color: #4f46e5 !important;
}

.pvtColLabel,
.pvtRowLabel,
th.pvtColLabel,
th.pvtRowLabel {
    font-weight: 700 !important;
    color: #ffffff !important;
}

/* ============================================================================
   CONTENEDORES DE ARRASTRE
   ============================================================================ */
.pvtAxisContainer,
.pvtVals,
.pvtRows,
.pvtCols,
.pvtUnused {
    background: #1e1e21 !important;
    border: 2px solid #3f3f46 !important;
    border-radius: 10px !important;
    padding: 14px !important;
    min-height: 65px !important;
}

.pvtAxisContainer:hover,
.pvtVals:hover {
    border-color: #6366f1 !important;
}

.pvtUnused {
    border-style: dashed !important;
}

/* ============================================================================
   ELEMENTOS ARRASTRABLES (ATRIBUTOS)
   ============================================================================ */
.pvtAxisContainer li,
.pvtAxis li,
.pvtAttr,
span.pvtAttr,
li.pvtAttr {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
    border: 2px solid #818cf8 !important;
    border-radius: 8px !important;
    color: #ffffff !important;
    padding: 10px 16px !important;
    margin: 5px !important;
    font-weight: 700 !important;
    font-size: 13px !important;
    cursor: grab !important;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.5) !important;
    transition: all 0.2s ease !important;
    display: inline-flex !important;
    align-items: center !important;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
}

.pvtAxisContainer li:hover,
.pvtAxis li:hover,
.pvtAttr:hover {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.6) !important;
}

.pvtAxisContainer li:active,
.pvtAttr:active {
    cursor: grabbing !important;
    transform: scale(1.02) !important;
}

/* TRIÁNGULO DE FILTRO */
.pvtTriangle {
    color: #ffffff !important;
    border-left-color: transparent !important;
    border-right-color: transparent !important;
    border-top-color: #ffffff !important;
    margin-left: 8px !important;
}

/* ============================================================================
   FILTER BOX (POPUP DE FILTROS)
   ============================================================================ */
.pvtFilterBox {
    background: #18181b !important;
    background-color: #18181b !important;
    border: 2px solid #6366f1 !important;
    border-radius: 12px !important;
    color: #ffffff !important;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7) !important;
    padding: 20px !important;
    z-index: 99999 !important;
}

.pvtFilterBox h4,
.pvtFilterBox p,
.pvtFilterBox span,
.pvtFilterBox label {
    color: #ffffff !important;
}

.pvtFilterBox h4 {
    font-weight: 700 !important;
    font-size: 16px !important;
    margin-bottom: 14px !important;
    padding-bottom: 10px !important;
    border-bottom: 2px solid #3f3f46 !important;
}

.pvtFilterBox button {
    background: #4f46e5 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 8px !important;
    padding: 10px 18px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
    margin: 5px !important;
}

.pvtFilterBox button:hover {
    background: #6366f1 !important;
    transform: translateY(-1px) !important;
}

/* CHECKBOX CONTAINER */
.pvtCheckContainer {
    background: #27272a !important;
    background-color: #27272a !important;
    color: #ffffff !important;
    max-height: 300px !important;
    overflow-y: auto !important;
    border-radius: 8px !important;
    border: 2px solid #3f3f46 !important;
    padding: 10px !important;
}

.pvtCheckContainer p,
.pvtCheckContainer label,
.pvtCheckContainer span {
    color: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    padding: 8px 12px !important;
    cursor: pointer !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
}

.pvtCheckContainer p:hover,
.pvtCheckContainer label:hover {
    background: #3f3f46 !important;
}

.pvtCheckContainer input[type="checkbox"] {
    accent-color: #6366f1 !important;
    width: 18px !important;
    height: 18px !important;
    margin-right: 12px !important;
}

/* CLOSE BUTTON */
.pvtCloseX,
a.pvtCloseX,
button.pvtCloseX {
    color: #ffffff !important;
    background: #ef4444 !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 16px !important;
    cursor: pointer !important;
    text-decoration: none !important;
    font-weight: bold !important;
}

.pvtCloseX:hover {
    background: #dc2626 !important;
}

/* ============================================================================
   DROPDOWN MENU DE ATRIBUTOS
   ============================================================================ */
.pvtDropdown,
.pvtAttrDropdown,
ul.pvtDropdown {
    background: #18181b !important;
    background-color: #18181b !important;
    color: #ffffff !important;
    border: 2px solid #6366f1 !important;
    border-radius: 10px !important;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6) !important;
    z-index: 99999 !important;
    overflow: hidden !important;
}

.pvtDropdown li,
.pvtAttrDropdown li {
    background: transparent !important;
    color: #ffffff !important;
    padding: 12px 18px !important;
    cursor: pointer !important;
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    font-weight: 500 !important;
}

.pvtDropdown li:hover,
.pvtAttrDropdown li:hover {
    background: #4f46e5 !important;
    transform: none !important;
}

/* ============================================================================
   LABELS Y TEXTOS
   ============================================================================ */
.pvtRenderers,
.pvtAggregator {
    margin-bottom: 14px !important;
}

.pvtRenderers label,
.pvtAggregator label,
.pvtAxisContainer label {
    color: #a1a1aa !important;
    font-size: 11px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    margin-bottom: 6px !important;
    display: block !important;
    font-weight: 600 !important;
}

/* VALORES NUMÉRICOS */
.pvtVal,
td.pvtVal {
    color: #ffffff !important;
    font-weight: 600 !important;
    text-align: right !important;
}

/* ============================================================================
   PLOTLY DARK MODE
   ============================================================================ */
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

.js-plotly-plot text,
.js-plotly-plot .xtick text,
.js-plotly-plot .ytick text,
.js-plotly-plot .gtitle {
    fill: #ffffff !important;
}

/* ============================================================================
   SCROLLBAR
   ============================================================================ */
.pvtTable::-webkit-scrollbar,
.pvtCheckContainer::-webkit-scrollbar,
.pivot-container::-webkit-scrollbar {
    width: 12px !important;
    height: 12px !important;
}

.pvtTable::-webkit-scrollbar-track,
.pvtCheckContainer::-webkit-scrollbar-track {
    background: #27272a !important;
    border-radius: 6px !important;
}

.pvtTable::-webkit-scrollbar-thumb,
.pvtCheckContainer::-webkit-scrollbar-thumb {
    background: #6366f1 !important;
    border-radius: 6px !important;
}

.pvtTable::-webkit-scrollbar-thumb:hover {
    background: #818cf8 !important;
}
`;

/**
 * Componente de Análisis Avanzado con DOS Pivot Tables Independientes
 * - Tab 1: VULNERABILIDADES (Campos técnicos de Pentest)
 * - Tab 2: HALLAZGOS (Campos normativos de Auditoría/GRC)
 */
export function PivotAnalysis({ 
  vulnerabilidadesData = [], 
  hallazgosData = [], 
  pivotState, 
  onPivotStateChange, 
  loading = false 
}) {
  const [activeModule, setActiveModule] = useState("vulnerabilidades");
  const [layoutMode, setLayoutMode] = useState(LAYOUT_TYPES.SPLIT);
  
  // Estados separados para cada módulo
  const [vulnTableState, setVulnTableState] = useState({
    rows: ["nivel_riesgo"],
    cols: ["estatus"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Table"
  });
  
  const [vulnChartState, setVulnChartState] = useState({
    rows: ["nivel_riesgo"],
    cols: ["estatus"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Stacked Bar Chart"
  });
  
  const [hallTableState, setHallTableState] = useState({
    rows: ["nivel_riesgo"],
    cols: ["estado"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Table"
  });
  
  const [hallChartState, setHallChartState] = useState({
    rows: ["nivel_riesgo"],
    cols: ["estado"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Stacked Bar Chart"
  });

  // Inyectar CSS agresivo
  useEffect(() => {
    const styleId = "pivot-forced-dark-mode";
    let style = document.getElementById(styleId);
    if (style) style.remove();
    
    style = document.createElement("style");
    style.id = styleId;
    style.textContent = FORCED_DARK_MODE_CSS;
    document.head.appendChild(style);
    
    return () => {
      const s = document.getElementById(styleId);
      if (s) s.remove();
    };
  }, []);

  // Exportar CSV
  const handleExportCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map(row => headers.map(h => `"${row[h] || ""}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      toast.success("Datos exportados a CSV");
    } catch (error) {
      toast.error("Error al exportar datos");
    }
  };

  // Sincronizar cambios
  const handleVulnTableChange = (s) => {
    setVulnTableState(s);
    setVulnChartState(prev => ({ ...prev, rows: s.rows, cols: s.cols, aggregatorName: s.aggregatorName, vals: s.vals }));
  };
  
  const handleVulnChartChange = (s) => {
    setVulnChartState(s);
    setVulnTableState(prev => ({ ...prev, rows: s.rows, cols: s.cols, aggregatorName: s.aggregatorName, vals: s.vals }));
  };
  
  const handleHallTableChange = (s) => {
    setHallTableState(s);
    setHallChartState(prev => ({ ...prev, rows: s.rows, cols: s.cols, aggregatorName: s.aggregatorName, vals: s.vals }));
  };
  
  const handleHallChartChange = (s) => {
    setHallChartState(s);
    setHallTableState(prev => ({ ...prev, rows: s.rows, cols: s.cols, aggregatorName: s.aggregatorName, vals: s.vals }));
  };

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
              <CardTitle className="text-lg text-white">Análisis Avanzado - Pivot Tables</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs de módulos independientes */}
          <Tabs value={activeModule} onValueChange={setActiveModule} className="w-full">
            <TabsList className="bg-zinc-800 border border-zinc-700 p-1 w-full grid grid-cols-2">
              <TabsTrigger 
                value="vulnerabilidades"
                className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-zinc-400 flex items-center gap-2"
                data-testid="module-vulnerabilidades"
              >
                <Target className="w-4 h-4" />
                <span className="font-semibold">PIVOT VULNERABILIDADES</span>
                <Badge className="bg-red-900/50 text-red-200 ml-1">{vulnerabilidadesData.length}</Badge>
              </TabsTrigger>
              <TabsTrigger 
                value="hallazgos"
                className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-zinc-400 flex items-center gap-2"
                data-testid="module-hallazgos"
              >
                <ClipboardList className="w-4 h-4" />
                <span className="font-semibold">PIVOT HALLAZGOS</span>
                <Badge className="bg-orange-900/50 text-orange-200 ml-1">{hallazgosData.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Selector de Layout */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800">
            <span className="text-sm text-zinc-400 font-medium flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Vista:
            </span>
            <Button
              variant={layoutMode === LAYOUT_TYPES.SPLIT ? "default" : "outline"}
              size="sm"
              onClick={() => setLayoutMode(LAYOUT_TYPES.SPLIT)}
              className={layoutMode === LAYOUT_TYPES.SPLIT 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
            >
              <Columns className="w-4 h-4 mr-2" />
              Paralelo
            </Button>
            <Button
              variant={layoutMode === LAYOUT_TYPES.TABLE_ONLY ? "default" : "outline"}
              size="sm"
              onClick={() => setLayoutMode(LAYOUT_TYPES.TABLE_ONLY)}
              className={layoutMode === LAYOUT_TYPES.TABLE_ONLY 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
            >
              <Table2 className="w-4 h-4 mr-2" />
              Solo Tabla
            </Button>
            <Button
              variant={layoutMode === LAYOUT_TYPES.CHART_ONLY ? "default" : "outline"}
              size="sm"
              onClick={() => setLayoutMode(LAYOUT_TYPES.CHART_ONLY)}
              className={layoutMode === LAYOUT_TYPES.CHART_ONLY 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Solo Gráfico
            </Button>
            
            <div className="flex-grow" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV(
                activeModule === "vulnerabilidades" ? vulnerabilidadesData : hallazgosData,
                activeModule === "vulnerabilidades" ? "pivot_vulnerabilidades" : "pivot_hallazgos"
              )}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">Escala de Riesgo:</span>
            {Object.entries(RISK_COLORS).map(([nivel, color]) => (
              <div key={nivel} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-400">{nivel}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============================================================
          MÓDULO DE VULNERABILIDADES (PENTEST)
          Campos: codigo, vulnerabilidad, severidad, nivel_riesgo, estatus,
                  responsable, institucion, aplicacion, informe_pentest, 
                  proveedor, dominio, mes_deteccion, resultado_retest, veces_retest
          ============================================================ */}
      {activeModule === "vulnerabilidades" && (
        <div className={`grid gap-4 ${layoutMode === LAYOUT_TYPES.SPLIT ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.TABLE_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-red-500">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    <CardTitle className="text-sm text-white">Tabla - Vulnerabilidades Pentest</CardTitle>
                    <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                      {vulnerabilidadesData.length} registros
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                {vulnerabilidadesData.length > 0 ? (
                  <div className="pivot-container">
                    <PivotTableUI
                      data={vulnerabilidadesData}
                      onChange={handleVulnTableChange}
                      renderers={TableRenderers}
                      {...vulnTableState}
                      rendererName="Table"
                      unusedOrientationCutoff={Infinity}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No hay datos de vulnerabilidades</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.CHART_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-red-500">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-red-400" />
                  <CardTitle className="text-sm text-white">Gráfico - Vulnerabilidades Pentest</CardTitle>
                  <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                    Sincronizado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                {vulnerabilidadesData.length > 0 ? (
                  <div className="pivot-container">
                    <PivotTableUI
                      data={vulnerabilidadesData}
                      onChange={handleVulnChartChange}
                      renderers={PlotlyRenderers}
                      {...vulnChartState}
                      unusedOrientationCutoff={Infinity}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No hay datos para graficar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ============================================================
          MÓDULO DE HALLAZGOS (AUDITORÍA/GRC)
          Campos: codigo, brecha, nivel_riesgo, estado, responsable,
                  dominio, control, mes_deteccion, probabilidad, impacto, riesgo_inherente
          ============================================================ */}
      {activeModule === "hallazgos" && (
        <div className={`grid gap-4 ${layoutMode === LAYOUT_TYPES.SPLIT ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.TABLE_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-orange-500">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <CardTitle className="text-sm text-white">Tabla - Hallazgos Auditoría</CardTitle>
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                      {hallazgosData.length} registros
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                {hallazgosData.length > 0 ? (
                  <div className="pivot-container">
                    <PivotTableUI
                      data={hallazgosData}
                      onChange={handleHallTableChange}
                      renderers={TableRenderers}
                      {...hallTableState}
                      rendererName="Table"
                      unusedOrientationCutoff={Infinity}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No hay datos de hallazgos</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(layoutMode === LAYOUT_TYPES.SPLIT || layoutMode === LAYOUT_TYPES.CHART_ONLY) && (
            <Card className="bg-zinc-900/50 border-zinc-800 border-l-4 border-l-orange-500">
              <CardHeader className="pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-orange-400" />
                  <CardTitle className="text-sm text-white">Gráfico - Hallazgos Auditoría</CardTitle>
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                    Sincronizado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto">
                {hallazgosData.length > 0 ? (
                  <div className="pivot-container">
                    <PivotTableUI
                      data={hallazgosData}
                      onChange={handleHallChartChange}
                      renderers={PlotlyRenderers}
                      {...hallChartState}
                      unusedOrientationCutoff={Infinity}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No hay datos para graficar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default PivotAnalysis;
