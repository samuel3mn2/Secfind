import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter, X, ExternalLink, PlayCircle, RefreshCw, FileText, Download } from "lucide-react";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SEVERITY_COLORS = {
  Critica: "#ef4444",
  Alta: "#f97316",
  Media: "#eab308",
  Baja: "#3b82f6",
};

const STATUS_COLORS = {
  "En Proceso": "#f97316",
  Cerrado: "#22c55e",
  Pendiente: "#eab308",
  "Para Re Test": "#3b82f6",
  Corregido: "#22c55e",
  Desestimado: "#71717a",
};

const INSTITUTION_COLORS = ["#6366f1", "#06b6d4", "#f97316", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899"];

const TREND_COLORS = {
  total: "#6366f1",
  criticas: "#ef4444",
  corregidas: "#22c55e",
  pendientes: "#eab308",
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium">{label || payload[0].name}</p>
        <p className="text-zinc-400 text-sm">{payload[0].value} vulnerabilidades</p>
      </div>
    );
  }
  return null;
};

const TrendTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SeverityBadge = ({ severity }) => {
  const classes = {
    Critica: "bg-red-500/15 text-red-500 border-red-500/30",
    Alta: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    Media: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    Baja: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${classes[severity] || ""}`}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const getClass = (s) => {
    if (["Cerrado", "Corregido"].includes(s)) return "bg-green-500/15 text-green-500 border-green-500/30";
    if (["Pendiente", "En Proceso"].includes(s)) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
    if (s === "Para Re Test") return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getClass(status)}`}>
      {status}
    </span>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tendencias, setTendencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  const [tipoTendencia, setTipoTendencia] = useState("mensual");
  
  // Filters
  const [filterAño, setFilterAño] = useState("");
  const [filterInstitucion, setFilterInstitucion] = useState("");
  const [filterInforme, setFilterInforme] = useState([]);
  const [filterSeveridad, setFilterSeveridad] = useState([]);
  const [filterProveedor, setFilterProveedor] = useState("");

  // KPI Detail Modal
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [kpiType, setKpiType] = useState("");
  const [kpiTitle, setKpiTitle] = useState("");
  const [kpiData, setKpiData] = useState([]);
  const [loadingKpi, setLoadingKpi] = useState(false);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  // Vista Comité Report Options
  const [showVistaComiteOptions, setShowVistaComiteOptions] = useState(false);
  const [vcSelectedInformes, setVcSelectedInformes] = useState([]);
  const [vcSelectedSeveridades, setVcSelectedSeveridades] = useState(["Critica", "Alta", "Media", "Baja"]);

  useEffect(() => {
    fetchOptions();
    fetchTendencias();
  }, []);

  useEffect(() => {
    fetchTendencias();
  }, [tipoTendencia]);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchTendencias = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/tendencias?tipo=${tipoTendencia}`);
      setTendencias(response.data);
    } catch (error) {
      console.error("Error fetching tendencias:", error);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterAño && filterAño !== "all") params.append("año", filterAño);
      if (filterInstitucion && filterInstitucion !== "all") params.append("institucion", filterInstitucion);
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterProveedor && filterProveedor !== "all") params.append("proveedor", filterProveedor);
      
      const response = await axios.get(`${API}/dashboard/stats?${params.toString()}`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, [filterAño, filterInstitucion, filterInforme, filterSeveridad, filterProveedor]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleKpiClick = async (tipo, titulo) => {
    setKpiType(tipo);
    setKpiTitle(titulo);
    setShowKpiModal(true);
    setLoadingKpi(true);
    
    try {
      const params = new URLSearchParams();
      params.append("tipo", tipo);
      if (filterAño && filterAño !== "all") params.append("año", filterAño);
      if (filterInstitucion && filterInstitucion !== "all") params.append("institucion", filterInstitucion);
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterProveedor && filterProveedor !== "all") params.append("proveedor", filterProveedor);
      
      const response = await axios.get(`${API}/dashboard/kpi-detail?${params.toString()}`);
      setKpiData(response.data);
    } catch (error) {
      console.error("Error fetching KPI detail:", error);
      setKpiData([]);
    } finally {
      setLoadingKpi(false);
    }
  };

  const clearFilters = () => {
    setFilterAño("");
    setFilterInstitucion("");
    setFilterInforme([]);
    setFilterSeveridad([]);
    setFilterProveedor("");
  };

  const hasActiveFilters = filterAño || filterInstitucion || filterInforme.length > 0 || filterSeveridad.length > 0 || filterProveedor;

  const generateReport = async (type, customParams = {}) => {
    setGeneratingReport(true);
    try {
      let url = `${API}/reportes/${type}`;
      const params = new URLSearchParams();
      
      if (type === "ejecutivo") {
        if (filterAño) params.append("año", filterAño);
        if (filterInstitucion) params.append("institucion", filterInstitucion);
        if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
        if (params.toString()) url += `?${params.toString()}`;
      } else if (type.startsWith("institucion/")) {
        // URL already has institution
      } else if (type.startsWith("informe/")) {
        // URL already has informe
      } else if (type === "vista-comite") {
        // Use custom params for Vista Comité
        if (customParams.informes && customParams.informes.length > 0) {
          params.append("informes", customParams.informes.join(","));
        }
        if (customParams.severidades && customParams.severidades.length > 0) {
          params.append("severidades", customParams.severidades.join(","));
        }
        if (params.toString()) url += `?${params.toString()}`;
      }
      
      const response = await axios.get(url, { responseType: 'blob' });
      
      // Download the file
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from header or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'reporte.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(.+)/);
        if (match) filename = match[1];
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      setShowReportModal(false);
      setShowVistaComiteOptions(false);
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Error al generar el reporte");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleVistaComiteReport = () => {
    if (vcSelectedInformes.length === 0) {
      toast.error("Selecciona al menos un informe");
      return;
    }
    if (vcSelectedSeveridades.length === 0) {
      toast.error("Selecciona al menos una severidad");
      return;
    }
    generateReport("vista-comite", {
      informes: vcSelectedInformes,
      severidades: vcSelectedSeveridades
    });
  };

  const formatSeverityData = () => {
    if (!stats?.por_severidad) return [];
    return Object.entries(stats.por_severidad).map(([name, value]) => ({
      name,
      value,
      color: SEVERITY_COLORS[name] || "#71717a",
    }));
  };

  const formatStatusData = () => {
    if (!stats?.por_estatus) return [];
    return Object.entries(stats.por_estatus).map(([name, value]) => ({
      name,
      value,
      fill: STATUS_COLORS[name] || "#71717a",
    }));
  };

  const formatInstitutionData = () => {
    if (!stats?.por_institucion) return [];
    return Object.entries(stats.por_institucion).map(([name, value], index) => ({
      name,
      value,
      fill: INSTITUTION_COLORS[index % INSTITUTION_COLORS.length],
    }));
  };

  if (loading && !stats) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Dashboard de Vulnerabilidades
          </h1>
          <p className="text-zinc-500">
            Vista general del estado de seguridad
          </p>
        </div>
        <Button
          onClick={() => setShowReportModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          data-testid="generate-report-btn"
        >
          <FileText className="w-4 h-4 mr-2" />
          Generar Reporte PDF
        </Button>
      </div>

      {/* Filters Card */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-500" />
            Filtros del Dashboard
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="ml-auto text-zinc-400 hover:text-white"
                data-testid="clear-filters-btn"
              >
                <X className="w-4 h-4 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Año Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Año</label>
              <Select value={filterAño} onValueChange={setFilterAño}>
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="filter-año">
                  <SelectValue placeholder="Todos los años" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todos los años</SelectItem>
                  {options?.años?.map((año) => (
                    <SelectItem key={año} value={String(año)}>{año}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Institución Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Institución</label>
              <Select value={filterInstitucion} onValueChange={setFilterInstitucion}>
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="filter-institucion">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todas las instituciones</SelectItem>
                  {options?.instituciones?.map((inst) => (
                    <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Informe Pentest Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Informe Pentest</label>
              <MultiSelectFilter
                options={options?.informes_pentest || []}
                selected={filterInforme}
                onChange={setFilterInforme}
                placeholder="Todos los informes"
                searchPlaceholder="Buscar informe..."
                allLabel="Todos los informes"
                data-testid="filter-informe"
              />
            </div>

            {/* Severidad Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Severidad</label>
              <MultiSelectFilter
                options={options?.severidades || []}
                selected={filterSeveridad}
                onChange={setFilterSeveridad}
                placeholder="Todas las severidades"
                searchPlaceholder="Buscar severidad..."
                allLabel="Todas las severidades"
                data-testid="filter-severidad"
              />
            </div>

            {/* Proveedor Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Proveedor</label>
              <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="filter-proveedor">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {options?.proveedores?.map((prov) => (
                    <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-indigo-500/50 transition-colors" 
          data-testid="kpi-total"
          onClick={() => handleKpiClick("total", "Total Vulnerabilidades")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Total</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats?.total_vulnerabilidades || 0}
                </p>
                <p className="text-xs text-indigo-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-red-500/50 transition-colors" 
          data-testid="kpi-criticas"
          onClick={() => handleKpiClick("criticas_abiertas", "Críticas Abiertas")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Críticas Abiertas</p>
                <p className="text-2xl font-bold text-red-500 mt-1">
                  {stats?.criticas_abiertas || 0}
                </p>
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-orange-500/50 transition-colors" 
          data-testid="kpi-altas"
          onClick={() => handleKpiClick("altas_abiertas", "Altas Abiertas")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Altas Abiertas</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">
                  {stats?.altas_abiertas || 0}
                </p>
                <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-green-500/50 transition-colors" 
          data-testid="kpi-corregidas"
          onClick={() => handleKpiClick("corregidas", "Vulnerabilidades Corregidas")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Corregidas</p>
                <p className="text-2xl font-bold text-green-500 mt-1">
                  {stats?.vulnerabilidades_corregidas || 0}
                </p>
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-yellow-500/50 transition-colors" 
          data-testid="kpi-pendientes"
          onClick={() => handleKpiClick("pendientes", "Vulnerabilidades Pendientes")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-500 mt-1">
                  {stats?.pendientes || 0}
                </p>
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-orange-500/50 transition-colors" 
          data-testid="kpi-en-proceso"
          onClick={() => handleKpiClick("en_proceso", "En Proceso")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">En Proceso</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">
                  {stats?.en_proceso || 0}
                </p>
                <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-orange-500/10">
                <PlayCircle className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-blue-500/50 transition-colors" 
          data-testid="kpi-para-retest"
          onClick={() => handleKpiClick("para_retest", "Para Re Test")}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs font-medium">Para Re Test</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">
                  {stats?.para_retest || 0}
                </p>
                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Ver detalle
                </p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <RefreshCw className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tendencias Chart - NEW */}
      <Card className="bg-[#18181b] border-[#27272a]" data-testid="chart-tendencias">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Evolución de Vulnerabilidades
            </CardTitle>
            <Select value={tipoTendencia} onValueChange={setTipoTendencia}>
              <SelectTrigger className="w-[140px] bg-black/20 border-zinc-700 text-white" data-testid="tendencia-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {tendencias.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tendencias}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis 
                    dataKey="periodo" 
                    stroke="#71717a" 
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip content={<TrendTooltip />} />
                  <Legend 
                    formatter={(value) => <span className="text-zinc-400 text-sm">{value}</span>}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    name="Total"
                    stroke={TREND_COLORS.total} 
                    strokeWidth={2}
                    dot={{ fill: TREND_COLORS.total, strokeWidth: 0, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="criticas" 
                    name="Críticas"
                    stroke={TREND_COLORS.criticas} 
                    strokeWidth={2}
                    dot={{ fill: TREND_COLORS.criticas, strokeWidth: 0, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="corregidas" 
                    name="Corregidas"
                    stroke={TREND_COLORS.corregidas} 
                    strokeWidth={2}
                    dot={{ fill: TREND_COLORS.corregidas, strokeWidth: 0, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pendientes" 
                    name="Pendientes"
                    stroke={TREND_COLORS.pendientes} 
                    strokeWidth={2}
                    dot={{ fill: TREND_COLORS.pendientes, strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500">
                Sin datos de tendencias
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Pie Chart */}
        <Card className="bg-[#18181b] border-[#27272a]" data-testid="chart-severidad">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Por Severidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {formatSeverityData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formatSeverityData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {formatSeverityData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value) => <span className="text-zinc-400 text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  Sin datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Bar Chart */}
        <Card className="bg-[#18181b] border-[#27272a]" data-testid="chart-estatus">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
              Por Estatus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {formatStatusData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formatStatusData()} layout="vertical">
                    <XAxis type="number" stroke="#71717a" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#71717a"
                      fontSize={11}
                      width={90}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  Sin datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Institution Bar Chart */}
        <Card className="bg-[#18181b] border-[#27272a]" data-testid="chart-institucion">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Por Institución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {formatInstitutionData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formatInstitutionData()}>
                    <XAxis
                      dataKey="name"
                      stroke="#71717a"
                      fontSize={10}
                      tickLine={false}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#71717a" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  Sin datos para mostrar
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Detail Modal */}
      <Dialog open={showKpiModal} onOpenChange={setShowKpiModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {kpiType === "criticas_abiertas" && <AlertTriangle className="w-5 h-5 text-red-500" />}
              {kpiType === "altas_abiertas" && <AlertTriangle className="w-5 h-5 text-orange-500" />}
              {kpiType === "pendientes" && <Clock className="w-5 h-5 text-yellow-500" />}
              {kpiType === "corregidas" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {kpiType === "total" && <Shield className="w-5 h-5 text-indigo-500" />}
              {kpiTitle}
              <span className="text-zinc-500 text-base font-normal ml-2">
                ({kpiData.length} registros)
              </span>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh]">
            {loadingKpi ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            ) : kpiData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-zinc-500">
                No hay vulnerabilidades en esta categoría
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Fecha</TableHead>
                    <TableHead className="text-zinc-400">Institución</TableHead>
                    <TableHead className="text-zinc-400">Aplicación</TableHead>
                    <TableHead className="text-zinc-400 min-w-[250px]">Vulnerabilidad</TableHead>
                    <TableHead className="text-zinc-400">Severidad</TableHead>
                    <TableHead className="text-zinc-400">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiData.map((vuln, index) => (
                    <TableRow 
                      key={vuln.id || index} 
                      className={`border-zinc-800 hover:bg-white/5 ${vuln.severidad === "Critica" ? "border-l-2 border-l-red-500" : ""}`}
                    >
                      <TableCell className="text-zinc-300 font-mono text-xs">
                        {vuln.fecha_hallazgo || "-"}
                      </TableCell>
                      <TableCell className="text-zinc-300">{vuln.institucion || "-"}</TableCell>
                      <TableCell className="text-zinc-300">{vuln.aplicacion || "-"}</TableCell>
                      <TableCell className="text-zinc-100 text-sm">
                        {vuln.vulnerabilidad || "-"}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={vuln.severidad} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={vuln.estatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Report Generation Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Generar Reporte PDF
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-zinc-400">
              Selecciona el tipo de reporte que deseas generar:
            </p>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start border-zinc-700 text-white hover:bg-zinc-800"
                onClick={() => generateReport("ejecutivo")}
                disabled={generatingReport}
                data-testid="report-ejecutivo-btn"
              >
                <Download className="w-4 h-4 mr-3 text-indigo-400" />
                <div className="text-left">
                  <div className="font-medium">Reporte Ejecutivo</div>
                  <div className="text-xs text-zinc-500">KPIs y gráficos generales {hasActiveFilters && "(con filtros aplicados)"}</div>
                </div>
              </Button>

              {filterInstitucion && filterInstitucion !== "all" && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-zinc-700 text-white hover:bg-zinc-800"
                  onClick={() => generateReport(`institucion/${encodeURIComponent(filterInstitucion)}`)}
                  disabled={generatingReport}
                  data-testid="report-institucion-btn"
                >
                  <Download className="w-4 h-4 mr-3 text-cyan-400" />
                  <div className="text-left">
                    <div className="font-medium">Reporte por Institución</div>
                    <div className="text-xs text-zinc-500">{filterInstitucion}</div>
                  </div>
                </Button>
              )}

              {filterInforme.length === 1 && (
                <Button
                  variant="outline"
                  className="w-full justify-start border-zinc-700 text-white hover:bg-zinc-800"
                  onClick={() => generateReport(`informe/${encodeURIComponent(filterInforme[0])}`)}
                  disabled={generatingReport}
                  data-testid="report-informe-btn"
                >
                  <Download className="w-4 h-4 mr-3 text-orange-400" />
                  <div className="text-left">
                    <div className="font-medium">Reporte por Informe Pentest</div>
                    <div className="text-xs text-zinc-500 truncate max-w-[280px]">{filterInforme[0]}</div>
                  </div>
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start border-zinc-700 text-white hover:bg-zinc-800"
                onClick={() => {
                  setShowReportModal(false);
                  setShowVistaComiteOptions(true);
                  // Pre-select all informes
                  if (options?.informes_pentest) {
                    setVcSelectedInformes(options.informes_pentest);
                  }
                }}
                disabled={generatingReport}
                data-testid="report-comite-btn"
              >
                <Download className="w-4 h-4 mr-3 text-purple-400" />
                <div className="text-left">
                  <div className="font-medium">Reporte Vista Comité</div>
                  <div className="text-xs text-zinc-500">Selecciona informes y severidades</div>
                </div>
              </Button>
            </div>

            {generatingReport && (
              <div className="flex items-center justify-center gap-2 text-zinc-400 py-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generando reporte...
              </div>
            )}

            <p className="text-xs text-zinc-500 pt-2">
              Tip: Aplica filtros en el dashboard para generar reportes específicos por institución o informe.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vista Comité Report Options Modal */}
      <Dialog open={showVistaComiteOptions} onOpenChange={setShowVistaComiteOptions}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Configurar Reporte Vista Comité
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Severidades Selection */}
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block">Severidades a incluir:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "Critica", label: "Crítico", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                  { value: "Alta", label: "Alto", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
                  { value: "Media", label: "Medio", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                  { value: "Baja", label: "Bajo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
                ].map(sev => (
                  <Badge
                    key={sev.value}
                    variant="outline"
                    className={`cursor-pointer transition-all ${
                      vcSelectedSeveridades.includes(sev.value) 
                        ? sev.color 
                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                    }`}
                    onClick={() => {
                      if (vcSelectedSeveridades.includes(sev.value)) {
                        setVcSelectedSeveridades(vcSelectedSeveridades.filter(s => s !== sev.value));
                      } else {
                        setVcSelectedSeveridades([...vcSelectedSeveridades, sev.value]);
                      }
                    }}
                  >
                    {sev.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Informes Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">Informes/Alcance a incluir:</label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                    onClick={() => setVcSelectedInformes(options?.informes_pentest || [])}
                  >
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-zinc-400 hover:text-zinc-300"
                    onClick={() => setVcSelectedInformes([])}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto border border-zinc-700 rounded-lg p-2 space-y-1">
                {options?.informes_pentest?.map(informe => (
                  <label
                    key={informe}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-zinc-800 ${
                      vcSelectedInformes.includes(informe) ? "bg-indigo-950/30" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={vcSelectedInformes.includes(informe)}
                      onChange={() => {
                        if (vcSelectedInformes.includes(informe)) {
                          setVcSelectedInformes(vcSelectedInformes.filter(i => i !== informe));
                        } else {
                          setVcSelectedInformes([...vcSelectedInformes, informe]);
                        }
                      }}
                      className="rounded border-zinc-600 flex-shrink-0"
                    />
                    <span className="text-sm text-zinc-300">{informe}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {vcSelectedInformes.length} de {options?.informes_pentest?.length || 0} informes seleccionados
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => setShowVistaComiteOptions(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleVistaComiteReport}
                disabled={generatingReport || vcSelectedInformes.length === 0 || vcSelectedSeveridades.length === 0}
              >
                {generatingReport ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generar PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
