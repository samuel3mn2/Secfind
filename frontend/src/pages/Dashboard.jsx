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
import { Shield, AlertTriangle, CheckCircle2, Clock, TrendingUp, Filter, X } from "lucide-react";
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  
  // Filters
  const [filterAño, setFilterAño] = useState("");
  const [filterInstitucion, setFilterInstitucion] = useState("");
  const [filterInforme, setFilterInforme] = useState("");
  const [filterSeveridad, setFilterSeveridad] = useState("");
  const [filterProveedor, setFilterProveedor] = useState("");

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#18181b] border-[#27272a] kpi-card" data-testid="kpi-total">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Total Vulnerabilidades</p>
                <p className="text-3xl font-bold text-white mt-2">
                  {stats?.total_vulnerabilidades || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-indigo-500/10">
                <Shield className="w-6 h-6 text-indigo-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a] kpi-card" data-testid="kpi-criticas">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Criticas Abiertas</p>
                <p className="text-3xl font-bold text-red-500 mt-2">
                  {stats?.criticas_abiertas || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a] kpi-card" data-testid="kpi-corregidas">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Corregidas</p>
                <p className="text-3xl font-bold text-green-500 mt-2">
                  {stats?.vulnerabilidades_corregidas || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a] kpi-card" data-testid="kpi-pendientes">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Pendientes</p>
                <p className="text-3xl font-bold text-yellow-500 mt-2">
                  {stats?.pendientes || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              Por Institucion
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
    </div>
  );
}
