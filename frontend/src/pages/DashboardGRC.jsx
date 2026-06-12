import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Shield, 
  Activity, 
  TrendingUp, 
  Filter, 
  Save, 
  Trash2, 
  ChevronDown, 
  RefreshCw,
  Info,
  X,
  Eye,
  Globe,
  Lock
} from "lucide-react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============ CONSTANTS ============
const SEVERITY_COLORS = {
  Critica: "#dc2626",
  Alta: "#ea580c",
  Media: "#ca8a04",
  Baja: "#2563eb",
};

// Colores estáticos para la Matriz de Riesgo 4x4
// Basado en metodología clásica: Verde (bajo), Amarillo (medio), Naranja (alto), Rojo (crítico)
const MATRIX_COLORS = {
  // Probabilidad (row) x Impacto (col) -> [prob][imp]
  // 1=Bajo, 2=Medio, 3=Medio-Alto, 4=Alto
  "1-1": "#22c55e", "1-2": "#84cc16", "1-3": "#eab308", "1-4": "#f97316",
  "2-1": "#84cc16", "2-2": "#eab308", "2-3": "#f97316", "2-4": "#ef4444",
  "3-1": "#eab308", "3-2": "#f97316", "3-3": "#ef4444", "3-4": "#dc2626",
  "4-1": "#f97316", "4-2": "#ef4444", "4-3": "#dc2626", "4-4": "#7f1d1d",
};

const RISK_LEVEL_LABELS = {
  "1": "Bajo",
  "2": "Medio", 
  "3": "Medio-Alto",
  "4": "Alto"
};

// Colores rígidos para Mapa de Calor GRC por nivel_riesgo
// Basado en puntuación de la celda (probabilidad * impacto)
const HEATMAP_CELL_COLORS = {
  // Puntuación 12-16: Crítico (rojo)
  "4-4": { bg: "bg-red-600", text: "text-white" },     // 16
  "4-3": { bg: "bg-red-500", text: "text-white" },     // 12
  "3-4": { bg: "bg-red-500", text: "text-white" },     // 12
  // Puntuación 8-11: Alto (naranja/rojo claro)
  "4-2": { bg: "bg-orange-600", text: "text-white" },  // 8
  "2-4": { bg: "bg-orange-600", text: "text-white" },  // 8
  "3-3": { bg: "bg-orange-500", text: "text-white" },  // 9
  "4-1": { bg: "bg-orange-400", text: "text-white" },  // 4 -> pero es prob alta
  "1-4": { bg: "bg-orange-400", text: "text-white" },  // 4 -> pero es imp alto
  // Puntuación 4-7: Medio (amarillo)
  "3-2": { bg: "bg-yellow-500", text: "text-zinc-900" }, // 6
  "2-3": { bg: "bg-yellow-500", text: "text-zinc-900" }, // 6
  "3-1": { bg: "bg-yellow-400", text: "text-zinc-900" }, // 3 -> prob medio-alta
  "1-3": { bg: "bg-yellow-400", text: "text-zinc-900" }, // 3 -> imp medio-alto
  "2-2": { bg: "bg-yellow-400", text: "text-zinc-900" }, // 4
  // Puntuación 1-3: Bajo (verde)
  "2-1": { bg: "bg-emerald-400", text: "text-white" }, // 2
  "1-2": { bg: "bg-emerald-400", text: "text-white" }, // 2
  "1-1": { bg: "bg-emerald-500", text: "text-white" }, // 1
};

// Labels para los ejes de la matriz
const PROBABILIDAD_LABELS = {
  "4": "Alta",
  "3": "Media-Alta",
  "2": "Media", 
  "1": "Baja"
};

const IMPACTO_LABELS = {
  "4": "Crítico",
  "3": "Alto",
  "2": "Medio",
  "1": "Bajo"
};

// ============ COMPONENTS ============

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.fill || entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Tooltip for Top Dominios chart (needs full domain name from payload)
const DominiosTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const fullName = payload[0]?.payload?.fullName || label;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium mb-2">{fullName}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.fill }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const KPICard = ({ title, value, subtitle, icon: Icon, color = "indigo", trend, onClick }) => {
  const colorClasses = {
    indigo: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400",
    red: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400",
    orange: "from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400",
    yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400",
    green: "from-green-500/20 to-green-600/10 border-green-500/30 text-green-400",
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400",
  };

  return (
    <Card 
      className={`bg-gradient-to-br ${colorClasses[color]} border cursor-pointer hover:scale-[1.02] transition-transform`}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            {subtitle && <p className="text-zinc-500 text-xs mt-1">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-black/20`}>
            <Icon className={`w-5 h-5 ${colorClasses[color].split(' ').pop()}`} />
          </div>
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className={`w-3 h-3 ${trend > 0 ? 'text-red-400' : 'text-green-400'}`} />
            <span className={`text-xs ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {trend > 0 ? '+' : ''}{trend}% vs mes anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Mapa de Calor GRC Unificado - Matriz Bidimensional (Probabilidad × Impacto)
const UnifiedRiskHeatmap = ({ data, onCellClick }) => {
  const celdas = data?.celdas || [];
  const totales = data?.totales || { vulnerabilidades: 0, hallazgos: 0, combinado: 0 };

  // Crear mapa de celdas para acceso rápido
  const cellDataMap = {};
  celdas.forEach(cell => {
    const key = `${cell.probabilidad}-${cell.impacto}`;
    cellDataMap[key] = cell;
  });

  return (
    <div className="space-y-3">
      {/* Header con totales */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">IMPACTO →</span>
        </div>
        <div className="text-xs text-zinc-500 flex gap-4">
          <span>Vulns: <span className="text-red-400 font-medium">{totales.vulnerabilidades}</span></span>
          <span>Hallazgos: <span className="text-orange-400 font-medium">{totales.hallazgos}</span></span>
          <span>Total: <span className="text-white font-medium">{totales.combinado}</span></span>
        </div>
      </div>
      
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col justify-center mr-2">
          <span className="text-xs text-zinc-500 font-medium writing-vertical transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>
            ← PROBABILIDAD
          </span>
        </div>
        
        {/* Matrix 4x4 */}
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {/* Header row - Impacto labels */}
            <div className="h-8"></div>
            {[1, 2, 3, 4].map(imp => (
              <div key={`header-${imp}`} className="h-8 flex items-center justify-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-zinc-400 font-medium">{IMPACTO_LABELS[imp]?.charAt(0)}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-800 text-white border-zinc-700">
                      {IMPACTO_LABELS[imp]}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
            
            {/* Matrix rows (4 to 1, top to bottom = alta a baja probabilidad) */}
            {[4, 3, 2, 1].map(prob => (
              <React.Fragment key={`row-${prob}`}>
                {/* Row label - Probabilidad */}
                <div className="h-16 flex items-center justify-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-zinc-400 font-medium">{PROBABILIDAD_LABELS[prob]?.charAt(0)}</span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="bg-zinc-800 text-white border-zinc-700">
                        {PROBABILIDAD_LABELS[prob]}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Cells */}
                {[1, 2, 3, 4].map(imp => {
                  const key = `${prob}-${imp}`;
                  const cellData = cellDataMap[key] || { count_vulns: 0, count_hallazgos: 0, count_total: 0 };
                  const colorConfig = HEATMAP_CELL_COLORS[key] || { bg: "bg-zinc-700", text: "text-white" };
                  const countTotal = cellData.count_total || 0;
                  const countVulns = cellData.count_vulns || 0;
                  const countHalls = cellData.count_hallazgos || 0;
                  
                  return (
                    <TooltipProvider key={key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`h-16 rounded-md flex flex-col items-center justify-center transition-all hover:scale-105 hover:ring-2 hover:ring-white/30 ${colorConfig.bg}`}
                            onClick={() => countTotal > 0 && onCellClick && onCellClick(cellData)}
                            data-testid={`heatmap-cell-${prob}-${imp}`}
                            disabled={countTotal === 0}
                          >
                            {countTotal > 0 ? (
                              <>
                                <span className={`font-bold text-lg drop-shadow-md ${colorConfig.text}`}>
                                  {countTotal}
                                </span>
                                <div className="flex gap-1 text-[10px]">
                                  {countVulns > 0 && <span className={`${colorConfig.text} opacity-80`}>V:{countVulns}</span>}
                                  {countHalls > 0 && <span className={`${colorConfig.text} opacity-80`}>H:{countHalls}</span>}
                                </div>
                              </>
                            ) : (
                              <span className={`text-sm opacity-30 ${colorConfig.text}`}>-</span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700">
                          <div className="text-sm">
                            <p className="font-medium">{PROBABILIDAD_LABELS[prob]} × {IMPACTO_LABELS[imp]}</p>
                            <p className="text-zinc-400">Vulnerabilidades: {countVulns}</p>
                            <p className="text-zinc-400">Hallazgos: {countHalls}</p>
                            {countTotal > 0 && <p className="text-zinc-500 text-xs mt-1">Click para ver detalles</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span className="text-xs text-zinc-500">Bajo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span className="text-xs text-zinc-500">Medio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500"></div>
          <span className="text-xs text-zinc-500">Alto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span className="text-xs text-zinc-500">Crítico</span>
        </div>
        <span className="text-zinc-600 mx-2">|</span>
        <span className="text-xs text-zinc-500">V = Vulnerabilidad, H = Hallazgo</span>
      </div>
    </div>
  );
};

// Matriz de Riesgo 4x4 (solo para Hallazgos - legacy)
const RiskMatrix = ({ data, onCellClick }) => {
  // Crear mapa de celdas con datos
  const cellDataMap = {};
  data?.celdas?.forEach(cell => {
    const key = `${cell.probabilidad}-${cell.impacto}`;
    cellDataMap[key] = cell;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">IMPACTO →</span>
        </div>
        <div className="text-xs text-zinc-500">
          Total: <span className="text-white font-medium">{data?.total_hallazgos || 0}</span> hallazgos
        </div>
      </div>
      
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col justify-center mr-2">
          <span className="text-xs text-zinc-500 font-medium writing-vertical transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>
            ← PROBABILIDAD
          </span>
        </div>
        
        {/* Matrix 4x4 */}
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-1">
            {/* Header row */}
            <div className="h-8"></div>
            {[1, 2, 3, 4].map(imp => (
              <div key={`header-${imp}`} className="h-8 flex items-center justify-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-zinc-400 font-medium">{RISK_LEVEL_LABELS[imp]?.charAt(0) || imp}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-800 text-white border-zinc-700">
                      {RISK_LEVEL_LABELS[imp]}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))}
            
            {/* Matrix rows (4 to 1, top to bottom) */}
            {[4, 3, 2, 1].map(prob => (
              <React.Fragment key={`row-${prob}`}>
                <div className="h-16 flex items-center justify-center">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="text-xs text-zinc-400 font-medium">{RISK_LEVEL_LABELS[prob]?.charAt(0) || prob}</span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="bg-zinc-800 text-white border-zinc-700">
                        {RISK_LEVEL_LABELS[prob]}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {[1, 2, 3, 4].map(imp => {
                  const key = `${prob}-${imp}`;
                  const cellData = cellDataMap[key];
                  const count = cellData?.count || 0;
                  const riesgoTotal = cellData?.riesgo_total || 0;
                  
                  return (
                    <TooltipProvider key={key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="h-16 rounded-md flex items-center justify-center transition-all hover:scale-105 hover:ring-2 hover:ring-white/30"
                            style={{ backgroundColor: MATRIX_COLORS[key] }}
                            onClick={() => count > 0 && onCellClick && onCellClick(cellData)}
                            data-testid={`matrix-cell-${prob}-${imp}`}
                          >
                            {count > 0 && (
                              <span className="text-white font-bold text-lg drop-shadow-md">
                                {count}
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 text-white border-zinc-700">
                          <div className="text-sm">
                            <p className="font-medium">{RISK_LEVEL_LABELS[prob]} × {RISK_LEVEL_LABELS[imp]}</p>
                            <p className="text-zinc-400">Hallazgos: {count}</p>
                            {count > 0 && <p className="text-zinc-400">Riesgo Total: {riesgoTotal}</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></div>
          <span className="text-xs text-zinc-500">Bajo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }}></div>
          <span className="text-xs text-zinc-500">Medio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></div>
          <span className="text-xs text-zinc-500">Alto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }}></div>
          <span className="text-xs text-zinc-500">Crítico</span>
        </div>
      </div>
    </div>
  );
};

// Panel de Severidad (Bar Chart)
const SeverityPanel = ({ data, onBarClick }) => {
  const chartData = data?.por_severidad?.map(item => ({
    name: item.severidad,
    value: item.count,
    fill: SEVERITY_COLORS[item.severidad] || '#6b7280'
  })) || [];

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
          <XAxis type="number" stroke="#71717a" fontSize={12} />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke="#71717a" 
            fontSize={12}
            width={70}
            tick={{ fill: '#a1a1aa' }}
          />
          <RechartsTooltip content={<CustomBarTooltip />} />
          <Bar 
            dataKey="value" 
            radius={[0, 4, 4, 0]}
            onClick={(data) => onBarClick && onBarClick(data)}
            cursor="pointer"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Top Dominios (Stacked Bar Chart)
const TopDominiosChart = ({ data }) => {
  const chartData = data?.map(item => ({
    name: item.dominio?.length > 15 ? item.dominio.substring(0, 15) + '...' : item.dominio,
    fullName: item.dominio,
    Criticas: item.vuln_criticas || 0,
    Altas: item.vuln_altas || 0,
    Medias: item.vuln_medias || 0,
    Bajas: item.vuln_bajas || 0,
    Hallazgos: item.hallazgos || 0,
  })) || [];

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 20, bottom: 60 }}>
          <XAxis 
            dataKey="name" 
            stroke="#71717a" 
            fontSize={11}
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fill: '#a1a1aa' }}
          />
          <YAxis stroke="#71717a" fontSize={12} />
          <RechartsTooltip content={<DominiosTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="Criticas" stackId="vulns" fill={SEVERITY_COLORS.Critica} name="Críticas" />
          <Bar dataKey="Altas" stackId="vulns" fill={SEVERITY_COLORS.Alta} name="Altas" />
          <Bar dataKey="Medias" stackId="vulns" fill={SEVERITY_COLORS.Media} name="Medias" />
          <Bar dataKey="Bajas" stackId="vulns" fill={SEVERITY_COLORS.Baja} name="Bajas" />
          <Bar dataKey="Hallazgos" fill="#8b5cf6" name="Hallazgos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============ MAIN COMPONENT ============
export default function DashboardGRC() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  
  // Groups of reports
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupos, setSelectedGrupos] = useState([]);
  const [gruposPopoverOpen, setGruposPopoverOpen] = useState(false);
  const [grupoSearch, setGrupoSearch] = useState("");
  
  // Filters
  const [selectedInformes, setSelectedInformes] = useState([]);
  const [selectedDominios, setSelectedDominios] = useState([]);
  const [selectedResponsables, setSelectedResponsables] = useState([]);
  const [selectedEstadosVuln, setSelectedEstadosVuln] = useState([]);
  const [selectedEstadosHall, setSelectedEstadosHall] = useState([]);
  
  // Saved Views
  const [vistas, setVistas] = useState([]);
  const [selectedVista, setSelectedVista] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [saveViewPublic, setSaveViewPublic] = useState(false);
  const [savingView, setSavingView] = useState(false);
  
  // Detail modals
  const [showMatrixDetail, setShowMatrixDetail] = useState(false);
  const [matrixDetailData, setMatrixDetailData] = useState(null);
  const [showSeverityDetail, setShowSeverityDetail] = useState(false);
  const [severityDetailData, setSeverityDetailData] = useState(null);
  const [showHeatmapDetail, setShowHeatmapDetail] = useState(false);
  const [heatmapDetailData, setHeatmapDetailData] = useState(null);
  
  // Ref to track if initial load is done
  const isInitialMount = useRef(true);

  // Handler for popover open change - clears search on close
  const handleGruposPopoverChange = (open) => {
    setGruposPopoverOpen(open);
    if (!open) setGrupoSearch("");
  };

  // Filter grupos by search
  const filteredGrupos = React.useMemo(() => {
    if (!grupoSearch.trim()) return grupos;
    const searchLower = grupoSearch.toLowerCase().trim();
    return grupos.filter(g => g.nombre.toLowerCase().includes(searchLower));
  }, [grupos, grupoSearch]);

  // Get all informes from selected grupos
  const informesFromGrupos = React.useMemo(() => {
    return selectedGrupos.flatMap(grupoId => {
      const grupo = grupos.find(g => g.id === grupoId);
      return grupo?.informes || [];
    });
  }, [selectedGrupos, grupos]);

  // Available informes for additional selection (excluding those already in selected grupos)
  const informesDisponibles = React.useMemo(() => {
    const allInformes = filterOptions?.informes || [];
    if (informesFromGrupos.length === 0) return allInformes;
    return allInformes.filter(inf => !informesFromGrupos.includes(inf));
  }, [filterOptions?.informes, informesFromGrupos]);

  // Combined informes (from grupos + individual selection)
  const combinedInformes = React.useMemo(() => {
    const all = [...new Set([...informesFromGrupos, ...selectedInformes])];
    return all;
  }, [informesFromGrupos, selectedInformes]);

  // Build query params from filters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (combinedInformes.length > 0) params.set('informes', combinedInformes.join(','));
    if (selectedDominios.length > 0) params.set('dominios', selectedDominios.join(','));
    if (selectedResponsables.length > 0) params.set('responsables', selectedResponsables.join(','));
    if (selectedEstadosVuln.length > 0) params.set('estados_vuln', selectedEstadosVuln.join(','));
    if (selectedEstadosHall.length > 0) params.set('estados_hall', selectedEstadosHall.join(','));
    return params.toString();
  }, [combinedInformes, selectedDominios, selectedResponsables, selectedEstadosVuln, selectedEstadosHall]);

  // Refresh function for manual refresh
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      const queryString = buildQueryParams();
      const url = `${API}/dashboard/data${queryString ? `?${queryString}` : ''}`;
      const res = await axios.get(url);
      setDashboardData(res.data);
      setFilterOptions(res.data.opciones_filtros);
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
      toast.error("Error al actualizar datos");
    } finally {
      setRefreshing(false);
    }
  }, [buildQueryParams]);

  // Fetch saved views
  const fetchVistas = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/dashboard/vistas`);
      setVistas(res.data);
    } catch (error) {
      console.error("Error fetching vistas:", error);
    }
  }, []);

  // Initial load and refetch on filter changes
  useEffect(() => {
    const loadData = async () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        setLoading(true);
        try {
          const [dataRes, vistasRes, gruposRes] = await Promise.all([
            axios.get(`${API}/dashboard/data`),
            axios.get(`${API}/dashboard/vistas`),
            axios.get(`${API}/config/grupos-informes`)
          ]);
          setDashboardData(dataRes.data);
          setFilterOptions(dataRes.data.opciones_filtros);
          setVistas(vistasRes.data);
          setGrupos(gruposRes.data || []);
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
          toast.error("Error al cargar datos del dashboard");
        } finally {
          setLoading(false);
        }
      } else {
        // Subsequent fetches (on filter change)
        setRefreshing(true);
        try {
          const queryString = buildQueryParams();
          const url = `${API}/dashboard/data${queryString ? `?${queryString}` : ''}`;
          const res = await axios.get(url);
          setDashboardData(res.data);
          setFilterOptions(res.data.opciones_filtros);
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
          toast.error("Error al cargar datos del dashboard");
        } finally {
          setRefreshing(false);
        }
      }
    };
    loadData();
  }, [buildQueryParams]);

  // Apply saved view
  const applyVista = (vista) => {
    if (!vista) {
      // Clear all filters
      setSelectedInformes([]);
      setSelectedDominios([]);
      setSelectedResponsables([]);
      setSelectedEstadosVuln([]);
      setSelectedEstadosHall([]);
      setSelectedVista(null);
      return;
    }
    
    setSelectedVista(vista);
    setSelectedInformes(vista.informes_seleccionados || []);
    setSelectedDominios(vista.filtros?.dominios || []);
    setSelectedResponsables(vista.filtros?.responsables || []);
    setSelectedEstadosVuln(vista.filtros?.estados_vulnerabilidad || []);
    setSelectedEstadosHall(vista.filtros?.estados_hallazgo || []);
  };

  // Save view
  const handleSaveView = async () => {
    if (!saveViewName.trim()) {
      toast.error("El nombre de la vista es requerido");
      return;
    }
    
    setSavingView(true);
    try {
      const payload = {
        ...(selectedVista?.id ? { id: selectedVista.id } : {}),
        nombre: saveViewName.trim(),
        es_publica: saveViewPublic,
        informes_seleccionados: selectedInformes,
        filtros: {
          dominios: selectedDominios,
          responsables: selectedResponsables,
          estados_vulnerabilidad: selectedEstadosVuln,
          estados_hallazgo: selectedEstadosHall,
        }
      };
      
      await axios.post(`${API}/dashboard/vistas`, payload);
      toast.success(selectedVista?.id ? "Vista actualizada" : "Vista guardada");
      setShowSaveModal(false);
      setSaveViewName("");
      setSaveViewPublic(false);
      fetchVistas();
    } catch (error) {
      const msg = error.response?.data?.detail || "Error al guardar vista";
      toast.error(msg);
    } finally {
      setSavingView(false);
    }
  };

  // Delete view
  const handleDeleteView = async (vistaId) => {
    if (!window.confirm("¿Eliminar esta vista?")) return;
    
    try {
      await axios.delete(`${API}/dashboard/vistas/${vistaId}`);
      toast.success("Vista eliminada");
      if (selectedVista?.id === vistaId) {
        setSelectedVista(null);
      }
      fetchVistas();
    } catch (error) {
      toast.error("Error al eliminar vista");
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedGrupos([]);
    setSelectedInformes([]);
    setSelectedDominios([]);
    setSelectedResponsables([]);
    setSelectedEstadosVuln([]);
    setSelectedEstadosHall([]);
    setSelectedVista(null);
  };

  const hasActiveFilters = selectedGrupos.length > 0 || selectedInformes.length > 0 || selectedDominios.length > 0 || 
    selectedResponsables.length > 0 || selectedEstadosVuln.length > 0 || selectedEstadosHall.length > 0;

  // Grupo toggle handler
  const handleGrupoToggle = (grupoId) => {
    const isRemoving = selectedGrupos.includes(grupoId);
    if (isRemoving) {
      setSelectedGrupos(prev => prev.filter(g => g !== grupoId));
    } else {
      // Adding grupo - also remove its informes from individual selection
      const grupo = grupos.find(g => g.id === grupoId);
      const grupoInformes = grupo?.informes || [];
      setSelectedGrupos(prev => [...prev, grupoId]);
      setSelectedInformes(prev => prev.filter(inf => !grupoInformes.includes(inf)));
    }
  };

  const handleSelectAllGrupos = () => {
    if (selectedGrupos.length === grupos.length) {
      setSelectedGrupos([]);
    } else {
      const allGrupoIds = grupos.map(g => g.id);
      setSelectedGrupos(allGrupoIds);
      // Clean up informes that will now be covered by grupos
      const allInformesFromAllGrupos = grupos.flatMap(g => g.informes || []);
      setSelectedInformes(prev => prev.filter(inf => !allInformesFromAllGrupos.includes(inf)));
    }
  };

  // Handle matrix cell click
  const handleMatrixCellClick = (cellData) => {
    setMatrixDetailData(cellData);
    setShowMatrixDetail(true);
  };

  // Handle severity bar click
  const handleSeverityBarClick = (barData) => {
    const severidad = barData.name;
    const severityData = dashboardData?.panel_severidad?.por_severidad?.find(s => s.severidad === severidad);
    if (severityData) {
      setSeverityDetailData(severityData);
      setShowSeverityDetail(true);
    }
  };

  // Handle heatmap GRC cell click
  const handleHeatmapCellClick = (cellData) => {
    setHeatmapDetailData(cellData);
    setShowHeatmapDetail(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="text-zinc-400 mt-4">Cargando Dashboard GRC...</p>
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="dashboard-grc">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
            Dashboard de Mando GRC
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Vista unificada de Vulnerabilidades y Hallazgos de Auditoría
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Saved Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Eye className="w-4 h-4 mr-2" />
                {selectedVista ? selectedVista.nombre : "Vistas Guardadas"}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-700" data-testid="vistas-dropdown">
              <DropdownMenuItem
                className="text-zinc-300 focus:text-white focus:bg-zinc-800 cursor-pointer"
                onClick={() => applyVista(null)}
              >
                <X className="w-4 h-4 mr-2" />
                Sin Vista (Limpiar)
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              {vistas.length === 0 ? (
                <div className="px-2 py-3 text-zinc-500 text-sm text-center">
                  No hay vistas guardadas
                </div>
              ) : (
                vistas.map(vista => (
                  <div key={vista.id} className="flex items-center justify-between px-2 py-1 hover:bg-zinc-800 rounded-sm">
                    <button
                      className="flex-1 flex items-center gap-2 text-left text-zinc-300 text-sm py-1"
                      onClick={() => applyVista(vista)}
                    >
                      {vista.es_publica ? <Globe className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-zinc-500" />}
                      <span className="truncate">{vista.nombre}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-500 hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); handleDeleteView(vista.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                className="text-indigo-400 focus:text-indigo-300 focus:bg-zinc-800 cursor-pointer"
                onClick={() => {
                  setSaveViewName(selectedVista?.nombre || "");
                  setSaveViewPublic(selectedVista?.es_publica || false);
                  setShowSaveModal(true);
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                {selectedVista ? "Actualizar Vista Actual" : "Guardar Vista Actual"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="outline"
            size="icon"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            onClick={refreshData}
            disabled={refreshing}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400 font-medium">Filtros Globales</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-500 hover:text-white h-6 px-2"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
          
          {/* First row: Groups + Individual Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {/* Grupos de Informes Selector */}
            {grupos.length > 0 && (
              <Popover open={gruposPopoverOpen} onOpenChange={handleGruposPopoverChange}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-between bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 w-full"
                    data-testid="filter-grupos"
                  >
                    <span className="truncate text-sm">
                      {selectedGrupos.length === 0 
                        ? "Seleccionar Grupos" 
                        : selectedGrupos.length === grupos.length 
                          ? "Todos los grupos" 
                          : `${selectedGrupos.length} grupo(s)`}
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      {selectedGrupos.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 bg-purple-600 text-white text-xs">
                          {selectedGrupos.length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0 bg-zinc-900 border-zinc-700" align="start">
                  {/* Search */}
                  <div className="flex items-center border-b border-zinc-700 px-3">
                    <Filter className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
                    <input
                      placeholder="Buscar grupo..."
                      value={grupoSearch}
                      onChange={(e) => setGrupoSearch(e.target.value)}
                      className="flex h-10 w-full bg-transparent py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
                      autoFocus
                    />
                  </div>
                  {/* Select All */}
                  <div 
                    className="flex items-center gap-2 p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800"
                    onClick={handleSelectAllGrupos}
                  >
                    <Checkbox checked={selectedGrupos.length === grupos.length && grupos.length > 0} className="border-zinc-600" />
                    <span className="text-sm font-medium text-zinc-300">Todos los grupos</span>
                  </div>
                  {/* Groups List */}
                  <ScrollArea className="h-[200px]">
                    <div className="p-2 space-y-1">
                      {filteredGrupos.map(grupo => (
                        <div
                          key={grupo.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            selectedGrupos.includes(grupo.id) ? "bg-purple-950/50" : "hover:bg-zinc-800"
                          }`}
                          onClick={() => handleGrupoToggle(grupo.id)}
                        >
                          <Checkbox checked={selectedGrupos.includes(grupo.id)} className="border-zinc-600" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-zinc-300 block truncate">{grupo.nombre}</span>
                            <span className="text-xs text-zinc-500">{grupo.informes?.length || 0} informes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Individual Informes - exclude those already in selected grupos */}
            <MultiSelectFilter
              options={informesDisponibles}
              selected={selectedInformes}
              onChange={setSelectedInformes}
              placeholder={grupos.length > 0 ? "Informes adicionales" : "Todos los informes"}
              className="w-full"
              data-testid="filter-informes"
            />
          </div>
          
          {/* Show combined informes count if both grupos and individual are selected */}
          {(selectedGrupos.length > 0 || selectedInformes.length > 0) && (
            <div className="text-xs text-zinc-500 mb-3 flex items-center gap-2">
              <Info className="w-3 h-3" />
              <span>
                {combinedInformes.length} informe(s) seleccionados en total
                {selectedGrupos.length > 0 && ` (${informesFromGrupos.length} de grupos)`}
              </span>
            </div>
          )}
          
          {/* Second row: Other filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <MultiSelectFilter
              options={filterOptions?.dominios || []}
              selected={selectedDominios}
              onChange={setSelectedDominios}
              placeholder="Todos los dominios"
              className="w-full"
              data-testid="filter-dominios"
            />
            <MultiSelectFilter
              options={filterOptions?.responsables || []}
              selected={selectedResponsables}
              onChange={setSelectedResponsables}
              placeholder="Responsables"
              className="w-full"
              data-testid="filter-responsables"
            />
            <MultiSelectFilter
              options={filterOptions?.estados_vulnerabilidad || []}
              selected={selectedEstadosVuln}
              onChange={setSelectedEstadosVuln}
              placeholder="Estado Vuln."
              className="w-full"
              data-testid="filter-estados-vuln"
            />
            <MultiSelectFilter
              options={filterOptions?.estados_hallazgo || []}
              selected={selectedEstadosHall}
              onChange={setSelectedEstadosHall}
              placeholder="Estado Hallazgo"
              className="w-full"
              data-testid="filter-estados-hall"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Vulnerabilidades Activas"
          value={kpis.vulnerabilidades_activas || 0}
          subtitle={`${kpis.desglose_severidad?.Critica || 0} críticas`}
          icon={Shield}
          color="red"
        />
        <KPICard
          title="Hallazgos Abiertos"
          value={kpis.hallazgos_abiertos || 0}
          subtitle={`Riesgo máx: ${kpis.riesgo_max_hallazgos || 0}/16`}
          icon={AlertTriangle}
          color="orange"
        />
        <KPICard
          title="Índice de Exposición"
          value={`${kpis.indice_exposicion || 0}%`}
          subtitle="Score ponderado"
          icon={Activity}
          color={kpis.indice_exposicion > 70 ? "red" : kpis.indice_exposicion > 40 ? "orange" : "green"}
        />
        <KPICard
          title="Riesgo Promedio"
          value={kpis.riesgo_promedio_hallazgos || 0}
          subtitle={`Máx posible: 16 | Actual máx: ${kpis.riesgo_max_hallazgos || 0}`}
          icon={TrendingUp}
          color={kpis.riesgo_promedio_hallazgos > 12 ? "red" : kpis.riesgo_promedio_hallazgos > 8 ? "orange" : "indigo"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Matrix */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Matriz de Riesgo 4×4
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-zinc-500" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-xs">
                    Hallazgos de Auditoría agrupados por Probabilidad × Impacto.
                    Escala: Bajo, Medio, Medio-Alto, Alto.
                    Click en una celda para ver detalles.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskMatrix 
              data={dashboardData?.matriz_4x4} 
              onCellClick={handleMatrixCellClick}
            />
          </CardContent>
        </Card>

        {/* Severity Panel */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              Panel de Severidad - Vulnerabilidades
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-zinc-500" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-xs">
                    Vulnerabilidades activas agrupadas por severidad.
                    Click en una barra para ver detalles.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SeverityPanel 
              data={dashboardData?.panel_severidad}
              onBarClick={handleSeverityBarClick}
            />
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {['Critica', 'Alta', 'Media', 'Baja'].map(sev => (
                <div key={sev} className="bg-zinc-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-white">
                    {dashboardData?.panel_severidad?.resumen?.[sev] || 0}
                  </div>
                  <div className="text-xs" style={{ color: SEVERITY_COLORS[sev] }}>{sev}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Dominios */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            Top 5 Dominios - Carga Combinada
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-zinc-500" />
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-xs">
                  Dominios con mayor carga combinada de vulnerabilidades (por severidad) y hallazgos de auditoría.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopDominiosChart data={dashboardData?.top_dominios} />
        </CardContent>
      </Card>

      {/* Mapa de Calor GRC - Matriz Unificada Probabilidad × Impacto */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            Mapa de Calor GRC Unificado
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-zinc-500" />
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-800 text-white border-zinc-700 max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">Matriz Bidimensional (Probabilidad × Impacto)</p>
                    <p className="text-zinc-400 text-xs">• Vulnerabilidades: Probabilidad siempre Alta (fila 3-4)</p>
                    <p className="text-zinc-400 text-xs">• Hallazgos: Probabilidad e Impacto dinámicos</p>
                    <p className="text-zinc-400 text-xs">• V = Vulnerabilidad, H = Hallazgo</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UnifiedRiskHeatmap 
            data={dashboardData?.mapa_calor_grc} 
            onCellClick={handleHeatmapCellClick}
          />
        </CardContent>
      </Card>

      {/* Save View Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-indigo-400" />
              {selectedVista ? "Actualizar Vista" : "Guardar Vista"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre de la Vista</Label>
              <Input
                value={saveViewName}
                onChange={(e) => setSaveViewName(e.target.value)}
                placeholder="Mi vista personalizada"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="save-view-name-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="public-view"
                checked={saveViewPublic}
                onCheckedChange={setSaveViewPublic}
                className="border-zinc-600"
              />
              <Label htmlFor="public-view" className="text-zinc-300 text-sm cursor-pointer">
                Vista pública (visible para todos los usuarios)
              </Label>
            </div>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Filtros que se guardarán:</p>
              <ul className="list-disc list-inside pl-2">
                {selectedInformes.length > 0 && <li>{selectedInformes.length} informes</li>}
                {selectedDominios.length > 0 && <li>{selectedDominios.length} dominios</li>}
                {selectedResponsables.length > 0 && <li>{selectedResponsables.length} responsables</li>}
                {selectedEstadosVuln.length > 0 && <li>Estados vuln: {selectedEstadosVuln.join(', ')}</li>}
                {selectedEstadosHall.length > 0 && <li>Estados hall: {selectedEstadosHall.join(', ')}</li>}
                {!hasActiveFilters && <li className="text-zinc-600">Sin filtros activos</li>}
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveModal(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveView}
              disabled={savingView}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="confirm-save-view-btn"
            >
              {savingView ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Matrix Detail Modal */}
      <Dialog open={showMatrixDetail} onOpenChange={setShowMatrixDetail}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Hallazgos - {RISK_LEVEL_LABELS[matrixDetailData?.probabilidad]} × {RISK_LEVEL_LABELS[matrixDetailData?.impacto]}
              <Badge variant="outline" className="ml-2 border-zinc-600">
                {matrixDetailData?.count || 0} hallazgos
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {matrixDetailData?.hallazgos?.map((h, idx) => (
                <div key={h.id || idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-indigo-400 font-mono text-xs">{h.codigo}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            h.estado === 'Cerrado' ? 'border-green-500/50 text-green-400' :
                            h.estado === 'En Proceso' ? 'border-yellow-500/50 text-yellow-400' :
                            'border-zinc-600 text-zinc-400'
                          }`}
                        >
                          {h.estado}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2">{h.brecha}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span>Riesgo: <span className="text-white">{h.riesgo_inherente}</span></span>
                        {h.responsable && <span>Resp: <span className="text-zinc-300">{h.responsable}</span></span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!matrixDetailData?.hallazgos || matrixDetailData.hallazgos.length === 0) && (
                <p className="text-zinc-500 text-center py-8">No hay hallazgos en esta celda</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Severity Detail Modal */}
      <Dialog open={showSeverityDetail} onOpenChange={setShowSeverityDetail}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" style={{ color: SEVERITY_COLORS[severityDetailData?.severidad] }} />
              Vulnerabilidades {severityDetailData?.severidad}
              <Badge variant="outline" className="ml-2 border-zinc-600">
                {severityDetailData?.count || 0} vulnerabilidades
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {severityDetailData?.vulnerabilidades?.map((v, idx) => (
                <div key={v.id || idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {v.codigo && <span className="text-indigo-400 font-mono text-xs">{v.codigo}</span>}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            ['Cerrado', 'Corregido'].includes(v.estatus) ? 'border-green-500/50 text-green-400' :
                            v.estatus === 'En Proceso' ? 'border-yellow-500/50 text-yellow-400' :
                            'border-zinc-600 text-zinc-400'
                          }`}
                        >
                          {v.estatus}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2">{v.vulnerabilidad}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        {v.institucion && <span>Inst: <span className="text-zinc-300">{v.institucion}</span></span>}
                        {v.aplicaciones?.length > 0 && <span>Apps: <span className="text-zinc-300">{v.aplicaciones.join(', ')}</span></span>}
                        {v.responsable && <span>Resp: <span className="text-zinc-300">{v.responsable}</span></span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!severityDetailData?.vulnerabilidades || severityDetailData.vulnerabilidades.length === 0) && (
                <p className="text-zinc-500 text-center py-8">No hay vulnerabilidades de esta severidad</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Heatmap GRC Detail Modal - Unified View */}
      <Dialog open={showHeatmapDetail} onOpenChange={setShowHeatmapDetail}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div 
                className={`w-5 h-5 rounded ${HEATMAP_CELL_COLORS[`${heatmapDetailData?.probabilidad}-${heatmapDetailData?.impacto}`]?.bg || 'bg-zinc-600'}`}
              ></div>
              {PROBABILIDAD_LABELS[heatmapDetailData?.probabilidad]} × {IMPACTO_LABELS[heatmapDetailData?.impacto]}
              <Badge variant="outline" className="ml-2 border-zinc-600">
                {heatmapDetailData?.count_total || 0} items
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {/* Resumen */}
          <div className="flex gap-4 text-sm mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-zinc-400">Vulnerabilidades:</span>
              <span className="text-white font-medium">{heatmapDetailData?.count_vulns || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-zinc-400">Hallazgos:</span>
              <span className="text-white font-medium">{heatmapDetailData?.count_hallazgos || 0}</span>
            </div>
          </div>
          
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pr-4">
              {heatmapDetailData?.items?.map((item, idx) => (
                <div key={item.id || idx} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Tipo badge */}
                        <Badge 
                          className={`text-xs ${
                            item.tipo === 'vulnerabilidad' 
                              ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                              : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          }`}
                        >
                          {item.tipo === 'vulnerabilidad' ? 'VULN' : 'HALL'}
                        </Badge>
                        {item.codigo && <span className="text-indigo-400 font-mono text-xs">{item.codigo}</span>}
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            ['Cerrado', 'Corregido'].includes(item.estatus || item.estado) ? 'border-green-500/50 text-green-400' :
                            (item.estatus || item.estado) === 'En Proceso' ? 'border-yellow-500/50 text-yellow-400' :
                            'border-zinc-600 text-zinc-400'
                          }`}
                        >
                          {item.estatus || item.estado}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2">{item.descripcion}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500 flex-wrap">
                        {item.tipo === 'vulnerabilidad' && item.severidad && (
                          <span>Severidad: <span className="text-zinc-300">{item.severidad}</span></span>
                        )}
                        {item.tipo === 'vulnerabilidad' && item.nivel_riesgo && (
                          <span>Nivel Riesgo: <span className="text-zinc-300">{item.nivel_riesgo}</span></span>
                        )}
                        {item.tipo === 'hallazgo' && item.riesgo_inherente && (
                          <span>Riesgo: <span className="text-zinc-300">{item.riesgo_inherente}</span></span>
                        )}
                        {item.responsable && <span>Resp: <span className="text-zinc-300">{item.responsable}</span></span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!heatmapDetailData?.items || heatmapDetailData.items.length === 0) && (
                <p className="text-zinc-500 text-center py-8">No hay items en esta celda</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
