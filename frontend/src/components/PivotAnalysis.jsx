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
import { RefreshCw, Download, BarChart3, Table2, Info, Filter, FileText, Shield, AlertTriangle } from "lucide-react";
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

// Estilos personalizados para dark mode con ALTO CONTRASTE
const darkModeStyles = `
  /* ========================================
     PIVOT TABLE - DARK MODE HIGH CONTRAST
     ======================================== */
  
  .pvtUi {
    background: transparent !important;
    color: #f4f4f5 !important;
    font-family: inherit !important;
  }
  
  /* Selectores principales */
  .pvtUi select, .pvtUi input {
    background: #3f3f46 !important;
    color: #ffffff !important;
    border: 1px solid #52525b !important;
    border-radius: 6px !important;
    padding: 6px 10px !important;
    font-weight: 500 !important;
  }
  
  .pvtUi select:hover, .pvtUi input:hover {
    border-color: #6366f1 !important;
  }
  
  .pvtUi select:focus, .pvtUi input:focus {
    border-color: #818cf8 !important;
    outline: none !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3) !important;
  }
  
  /* Tabla de resultados */
  .pvtTable {
    background: #18181b !important;
    color: #f4f4f5 !important;
    border-collapse: collapse !important;
    border-radius: 8px !important;
    overflow: hidden !important;
  }
  
  .pvtTable th, .pvtTable td {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    padding: 8px 12px !important;
    color: #f4f4f5 !important;
    font-weight: 500 !important;
  }
  
  .pvtTable th {
    background: #3f3f46 !important;
    font-weight: 600 !important;
    color: #ffffff !important;
  }
  
  .pvtTable tbody tr:hover td {
    background: #353538 !important;
  }
  
  /* Contenedores de arrastre - ALTA VISIBILIDAD */
  .pvtAxisContainer, .pvtVals {
    background: #27272a !important;
    border: 2px solid #52525b !important;
    border-radius: 8px !important;
    padding: 12px !important;
    min-height: 60px !important;
  }
  
  .pvtAxisContainer:hover, .pvtVals:hover {
    border-color: #6366f1 !important;
  }
  
  /* Elementos arrastrables - BADGES CON ALTO CONTRASTE */
  .pvtAxisContainer li, .pvtAxis li {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
    border: 1px solid #818cf8 !important;
    border-radius: 6px !important;
    color: #ffffff !important;
    padding: 6px 12px !important;
    margin: 4px !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    cursor: grab !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
    transition: all 0.2s ease !important;
  }
  
  .pvtAxisContainer li:hover, .pvtAxis li:hover {
    background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4) !important;
  }
  
  .pvtAxisContainer li:active, .pvtAxis li:active {
    cursor: grabbing !important;
  }
  
  /* Atributos/campos en la zona de drag */
  .pvtAttr {
    background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
    color: #ffffff !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-weight: 600 !important;
    border: 1px solid #818cf8 !important;
  }
  
  /* Triángulo de ordenamiento */
  .pvtTriangle {
    color: #ffffff !important;
    border-color: #ffffff transparent transparent !important;
  }
  
  /* Filtros dropdown */
  .pvtFilterBox {
    background: #27272a !important;
    border: 2px solid #52525b !important;
    border-radius: 8px !important;
    color: #f4f4f5 !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
  }
  
  .pvtFilterBox input {
    background: #3f3f46 !important;
    color: #ffffff !important;
    border: 1px solid #52525b !important;
    border-radius: 4px !important;
    padding: 6px 10px !important;
  }
  
  .pvtFilterBox button {
    background: #4f46e5 !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: 4px !important;
    padding: 6px 12px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
  }
  
  .pvtFilterBox button:hover {
    background: #6366f1 !important;
  }
  
  .pvtCheckContainer {
    background: #27272a !important;
    color: #f4f4f5 !important;
    max-height: 250px !important;
    overflow-y: auto !important;
  }
  
  .pvtCheckContainer label {
    color: #f4f4f5 !important;
    display: flex !important;
    align-items: center !important;
    padding: 4px 8px !important;
    cursor: pointer !important;
  }
  
  .pvtCheckContainer label:hover {
    background: #3f3f46 !important;
  }
  
  /* Selectores de renderer y aggregator */
  .pvtRenderers, .pvtAggregator {
    margin-bottom: 12px !important;
  }
  
  .pvtRenderers select, .pvtAggregator select {
    min-width: 160px !important;
  }
  
  /* Labels de columnas y filas */
  .pvtColLabel, .pvtRowLabel {
    font-weight: 600 !important;
    color: #ffffff !important;
  }
  
  /* Totales */
  .pvtTotal, .pvtGrandTotal {
    background: #1e1e21 !important;
    font-weight: 700 !important;
    color: #a5b4fc !important;
  }
  
  /* Dropdown de atributos */
  .pvtDropdown {
    background: #27272a !important;
    color: #f4f4f5 !important;
    border: 1px solid #52525b !important;
    border-radius: 4px !important;
  }
  
  /* Rows/Cols labels area */
  .pvtRows, .pvtCols {
    background: #1e1e21 !important;
    border-radius: 6px !important;
    padding: 8px !important;
    margin: 4px !important;
  }
  
  /* Unused area label */
  .pvtUnused {
    background: #1e1e21 !important;
    border: 2px dashed #52525b !important;
    border-radius: 8px !important;
    min-height: 80px !important;
  }
  
  /* Plotly dark mode */
  .js-plotly-plot .plotly .modebar {
    background: transparent !important;
  }
  
  .js-plotly-plot .plotly .modebar-btn path {
    fill: #a1a1aa !important;
  }
  
  .js-plotly-plot .plotly .modebar-btn:hover path {
    fill: #ffffff !important;
  }
  
  /* Scrollbar personalizado */
  .pvtTable::-webkit-scrollbar,
  .pvtCheckContainer::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }
  
  .pvtTable::-webkit-scrollbar-track,
  .pvtCheckContainer::-webkit-scrollbar-track {
    background: #27272a !important;
    border-radius: 4px !important;
  }
  
  .pvtTable::-webkit-scrollbar-thumb,
  .pvtCheckContainer::-webkit-scrollbar-thumb {
    background: #52525b !important;
    border-radius: 4px !important;
  }
  
  .pvtTable::-webkit-scrollbar-thumb:hover,
  .pvtCheckContainer::-webkit-scrollbar-thumb:hover {
    background: #71717a !important;
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
 * 
 * @param {Array} data - Datos unificados de vulnerabilidades y hallazgos
 * @param {Object} pivotState - Estado inicial de la tabla pivote
 * @param {Function} onPivotStateChange - Callback cuando cambia la configuración
 * @param {boolean} loading - Estado de carga
 */
export function PivotAnalysis({ data = [], pivotState, onPivotStateChange, loading = false }) {
  // Segmentación de datos
  const [activeSegment, setActiveSegment] = useState(SEGMENT_TYPES.ALL);
  
  // Estados separados para tabla y gráfico
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
    plotlyOptions: { width: 600, height: 400 },
    plotlyConfig: {}
  });

  // Actualizar estados cuando cambia el prop
  useEffect(() => {
    if (pivotState) {
      setTableState(prev => ({ ...prev, ...pivotState, rendererName: "Table" }));
      setChartState(prev => ({ ...prev, ...pivotState, rendererName: pivotState.rendererName || "Stacked Bar Chart" }));
    }
  }, [pivotState]);

  // Transformar datos para la tabla pivote
  const pivotData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(item => {
      // Extraer mes de detección
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

  // Filtrar datos según segmentación activa
  const filteredPivotData = useMemo(() => {
    if (activeSegment === SEGMENT_TYPES.ALL) {
      return pivotData;
    } else if (activeSegment === SEGMENT_TYPES.VULNERABILITIES) {
      return pivotData.filter(item => item.tipo_registro === "Vulnerabilidad");
    } else if (activeSegment === SEGMENT_TYPES.FINDINGS) {
      return pivotData.filter(item => item.tipo_registro === "Hallazgo");
    }
    return pivotData;
  }, [pivotData, activeSegment]);

  // Contadores para badges
  const counts = useMemo(() => ({
    all: pivotData.length,
    vulnerabilities: pivotData.filter(item => item.tipo_registro === "Vulnerabilidad").length,
    findings: pivotData.filter(item => item.tipo_registro === "Hallazgo").length
  }), [pivotData]);

  // Sincronizar cambios entre tabla y gráfico
  const handleTableChange = (newState) => {
    setTableState(newState);
    // Sincronizar filas, columnas y aggregator con el gráfico
    setChartState(prev => ({
      ...prev,
      rows: newState.rows,
      cols: newState.cols,
      aggregatorName: newState.aggregatorName,
      vals: newState.vals,
      sorters: newState.sorters
    }));
    
    // Notificar cambio al padre
    if (onPivotStateChange) {
      const configToSave = {
        rows: newState.rows || [],
        cols: newState.cols || [],
        aggregatorName: newState.aggregatorName || "Count",
        vals: newState.vals || [],
        rendererName: chartState.rendererName || "Stacked Bar Chart",
        sorters: newState.sorters || {},
        rowOrder: newState.rowOrder || "key_a_to_z",
        colOrder: newState.colOrder || "key_a_to_z"
      };
      onPivotStateChange(configToSave);
    }
  };

  const handleChartChange = (newState) => {
    setChartState(newState);
    // Sincronizar filas, columnas y aggregator con la tabla
    setTableState(prev => ({
      ...prev,
      rows: newState.rows,
      cols: newState.cols,
      aggregatorName: newState.aggregatorName,
      vals: newState.vals,
      sorters: newState.sorters
    }));
    
    // Notificar cambio al padre
    if (onPivotStateChange) {
      const configToSave = {
        rows: newState.rows || [],
        cols: newState.cols || [],
        aggregatorName: newState.aggregatorName || "Count",
        vals: newState.vals || [],
        rendererName: newState.rendererName || "Stacked Bar Chart",
        sorters: newState.sorters || {},
        rowOrder: newState.rowOrder || "key_a_to_z",
        colOrder: newState.colOrder || "key_a_to_z"
      };
      onPivotStateChange(configToSave);
    }
  };

  // Exportar a CSV
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

  // Inyectar estilos dark mode
  useEffect(() => {
    const styleId = "pivot-dark-mode-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = darkModeStyles;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) style.remove();
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
      {/* Header con info y acciones */}
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
          {/* Segmentación de datos - NUEVO */}
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
                Solo Vulnerabilidades (Pentest)
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
                Solo Hallazgos (Auditoría)
                <Badge className="ml-2 bg-orange-900/50 text-orange-200">{counts.findings}</Badge>
              </Button>
            </div>
          </div>

          {/* Leyenda de nivel de riesgo */}
          <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
            <span className="text-sm text-zinc-500">Escala de Riesgo:</span>
            {Object.entries(RISK_COLORS).map(([nivel, color]) => (
              <div key={nivel} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-zinc-400">{nivel}</span>
              </div>
            ))}
          </div>

          {/* Instrucciones colapsables */}
          <details className="bg-zinc-800/50 rounded-lg border border-zinc-700">
            <summary className="cursor-pointer p-3 flex items-center gap-2 text-sm text-zinc-300 hover:bg-zinc-800/70 rounded-lg">
              <Info className="w-4 h-4 text-amber-400" />
              <span className="font-medium">Cómo usar la tabla pivote</span>
            </summary>
            <div className="px-3 pb-3 text-sm text-zinc-400">
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Arrastra los campos a <span className="text-indigo-400 font-medium">filas</span> o <span className="text-indigo-400 font-medium">columnas</span> para agrupar</li>
                <li>Usa los botones de segmentación para analizar Vulnerabilidades o Hallazgos por separado</li>
                <li>La tabla y el gráfico se actualizan en <span className="text-green-400 font-medium">tiempo real</span></li>
                <li>La configuración se guarda automáticamente con la vista</li>
              </ul>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Vista Split: Tabla + Gráfico en paralelo */}
      {filteredPivotData.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Tabla Pivote */}
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardHeader className="pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-emerald-400" />
                <CardTitle className="text-sm text-white">Tabla de Datos</CardTitle>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                  {filteredPivotData.length} registros
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 overflow-x-auto">
              <div className="pivot-container-table">
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

          {/* Gráfico Pivote */}
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardHeader className="pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <CardTitle className="text-sm text-white">Visualización Gráfica</CardTitle>
                <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                  Sincronizado
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 overflow-x-auto">
              <div className="pivot-container-chart">
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
        </div>
      ) : (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Table2 className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No hay datos disponibles para el análisis</p>
              <p className="text-sm mt-1">Ajusta los filtros globales o selecciona informes en el dashboard</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PivotAnalysis;
