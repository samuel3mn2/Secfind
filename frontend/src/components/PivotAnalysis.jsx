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
import { RefreshCw, Download, BarChart3, Table2, Info } from "lucide-react";
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

// Estilos personalizados para dark mode
const darkModeStyles = `
  .pvtUi {
    background: transparent !important;
    color: #e4e4e7 !important;
  }
  .pvtUi select, .pvtUi input {
    background: #27272a !important;
    color: #e4e4e7 !important;
    border: 1px solid #3f3f46 !important;
    border-radius: 4px !important;
    padding: 4px 8px !important;
  }
  .pvtTable {
    background: #18181b !important;
    color: #e4e4e7 !important;
    border-collapse: collapse !important;
  }
  .pvtTable th, .pvtTable td {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    padding: 6px 10px !important;
    color: #e4e4e7 !important;
  }
  .pvtTable th {
    background: #3f3f46 !important;
    font-weight: 600 !important;
  }
  .pvtAxisContainer, .pvtVals {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    border-radius: 6px !important;
    padding: 8px !important;
  }
  .pvtAxisContainer li {
    background: #3f3f46 !important;
    border: 1px solid #52525b !important;
    border-radius: 4px !important;
    color: #e4e4e7 !important;
    padding: 4px 8px !important;
    margin: 2px !important;
  }
  .pvtAxisContainer li:hover {
    background: #52525b !important;
  }
  .pvtFilterBox {
    background: #27272a !important;
    border: 1px solid #3f3f46 !important;
    border-radius: 6px !important;
    color: #e4e4e7 !important;
  }
  .pvtFilterBox input, .pvtFilterBox button {
    background: #3f3f46 !important;
    color: #e4e4e7 !important;
    border: 1px solid #52525b !important;
  }
  .pvtDropdown {
    background: #27272a !important;
    color: #e4e4e7 !important;
  }
  .pvtCheckContainer {
    background: #27272a !important;
    color: #e4e4e7 !important;
  }
  .pvtCheckContainer label {
    color: #e4e4e7 !important;
  }
  .pvtRenderers, .pvtAggregator {
    margin-bottom: 8px !important;
  }
  .pvtAttr {
    background: #4f46e5 !important;
    color: white !important;
    border-radius: 4px !important;
    padding: 4px 8px !important;
  }
  .pvtTriangle {
    color: #a1a1aa !important;
  }
  .pvtColLabel, .pvtRowLabel {
    font-weight: 500 !important;
  }
  .pvtTotal, .pvtGrandTotal {
    background: #1f2937 !important;
    font-weight: 600 !important;
  }
  /* Plotly dark mode */
  .js-plotly-plot .plotly .modebar {
    background: transparent !important;
  }
  .js-plotly-plot .plotly .modebar-btn path {
    fill: #a1a1aa !important;
  }
`;

/**
 * Componente de Análisis Avanzado con Tabla Pivote
 * 
 * @param {Array} data - Datos unificados de vulnerabilidades y hallazgos
 * @param {Object} pivotState - Estado inicial de la tabla pivote
 * @param {Function} onPivotStateChange - Callback cuando cambia la configuración
 * @param {boolean} loading - Estado de carga
 */
export function PivotAnalysis({ data = [], pivotState, onPivotStateChange, loading = false }) {
  // Estado local de la tabla pivote
  const [localPivotState, setLocalPivotState] = useState(pivotState || {
    rows: ["tipo_registro"],
    cols: ["nivel_riesgo"],
    aggregatorName: "Count",
    vals: [],
    rendererName: "Stacked Bar Chart",
    sorters: {},
    plotlyOptions: {
      width: 900,
      height: 400
    },
    plotlyConfig: {}
  });

  // Actualizar estado local cuando cambia el prop
  useEffect(() => {
    if (pivotState) {
      setLocalPivotState(pivotState);
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

  // Manejar cambio en la tabla pivote
  const handlePivotChange = (newState) => {
    setLocalPivotState(newState);
    if (onPivotStateChange) {
      // Extraer solo la configuración relevante para guardar
      const configToSave = {
        rows: newState.rows || [],
        cols: newState.cols || [],
        aggregatorName: newState.aggregatorName || "Count",
        vals: newState.vals || [],
        rendererName: newState.rendererName || "Table",
        sorters: newState.sorters || {},
        rowOrder: newState.rowOrder || "key_a_to_z",
        colOrder: newState.colOrder || "key_a_to_z"
      };
      onPivotStateChange(configToSave);
    }
  };

  // Renderers disponibles (tabla + gráficos)
  const renderers = useMemo(() => ({
    ...TableRenderers,
    ...PlotlyRenderers
  }), []);

  // Exportar a CSV
  const handleExportCSV = () => {
    try {
      const headers = Object.keys(pivotData[0] || {});
      const csvContent = [
        headers.join(","),
        ...pivotData.map(row => headers.map(h => `"${row[h] || ""}"`).join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `analisis_pivote_${new Date().toISOString().split("T")[0]}.csv`;
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              <CardTitle className="text-lg text-white">Análisis Avanzado - Tabla Pivote</CardTitle>
              <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {pivotData.length} registros
              </Badge>
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
        <CardContent>
          {/* Instrucciones */}
          <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 border border-zinc-700">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-zinc-400">
                <p className="font-medium text-zinc-300 mb-1">Cómo usar la tabla pivote:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Arrastra los campos a <span className="text-indigo-400">filas</span> o <span className="text-indigo-400">columnas</span> para agrupar</li>
                  <li>Cambia el <span className="text-indigo-400">tipo de visualización</span> (tabla, barras, líneas, etc.)</li>
                  <li>Usa el campo <span className="text-indigo-400">tipo_registro</span> para separar Vulnerabilidades y Hallazgos</li>
                  <li>La configuración se guarda automáticamente con la vista</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Leyenda de nivel de riesgo */}
          <div className="flex items-center gap-4 mb-4">
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
        </CardContent>
      </Card>

      {/* Tabla Pivote */}
      <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
        <CardContent className="p-4">
          {pivotData.length > 0 ? (
            <div className="pivot-container overflow-x-auto">
              <PivotTableUI
                data={pivotData}
                onChange={handlePivotChange}
                renderers={renderers}
                {...localPivotState}
                unusedOrientationCutoff={Infinity}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Table2 className="w-12 h-12 mb-3 opacity-50" />
              <p>No hay datos disponibles para el análisis</p>
              <p className="text-sm mt-1">Ajusta los filtros o selecciona informes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PivotAnalysis;
