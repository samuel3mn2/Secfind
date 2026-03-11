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
import { Shield, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter, X, ExternalLink, PlayCircle, RefreshCw } from "lucide-react";
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
  const [filterInforme, setFilterInforme] = useState("");
  const [filterSeveridad, setFilterSeveridad] = useState("");
  const [filterProveedor, setFilterProveedor] = useState("");

  // KPI Detail Modal
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [kpiType, setKpiType] = useState("");
  const [kpiTitle, setKpiTitle] = useState("");
  const [kpiData, setKpiData] = useState([]);
  const [loadingKpi, setLoadingKpi] = useState(false);

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
      if (filterInforme && filterInforme !== "all") params.append("informe_pentest", filterInforme);
      if (filterSeveridad && filterSeveridad !== "all") params.append("severidad", filterSeveridad);
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
      if (filterInforme && filterInforme !== "all") params.append("informe_pentest", filterInforme);
      if (filterSeveridad && filterSeveridad !== "all") params.append("severidad", filterSeveridad);
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
    setFilterInforme("");
    setFilterSeveridad("");
    setFilterProveedor("");
  };

  const hasActiveFilters = filterAño || filterInstitucion || filterInforme || filterSeveridad || filterProveedor;

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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Dashboard de Vulnerabilidades
        </h1>
        <p className="text-zinc-500">
          Vista general del estado de seguridad
        </p>
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
              <Select value={filterInforme} onValueChange={setFilterInforme}>
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="filter-informe">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[300px]">
                  <SelectItem value="all">Todos los informes</SelectItem>
                  {options?.informes_pentest?.map((informe) => (
                    <SelectItem key={informe} value={informe} className="text-xs">
                      {informe.length > 40 ? `${informe.substring(0, 40)}...` : informe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Severidad Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Severidad</label>
              <Select value={filterSeveridad} onValueChange={setFilterSeveridad}>
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="filter-severidad">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todas las severidades</SelectItem>
                  {options?.severidades?.map((sev) => (
                    <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card 
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-indigo-500/50 transition-colors" 
          data-testid="kpi-total"
          onClick={() => handleKpiClick("total", "Total Vulnerabilidades")}
        >
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
          className="bg-[#18181b] border-[#27272a] kpi-card cursor-pointer hover:border-green-500/50 transition-colors" 
          data-testid="kpi-corregidas"
          onClick={() => handleKpiClick("corregidas", "Vulnerabilidades Corregidas")}
        >
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
          <CardContent className="p-4">
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
    </div>
  );
}
