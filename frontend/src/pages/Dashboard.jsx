import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
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

const INSTITUTION_COLORS = ["#6366f1", "#06b6d4", "#f97316", "#22c55e", "#ef4444"];

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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
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
    <div className="p-6 md:p-8 lg:p-12 space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Dashboard de Vulnerabilidades
        </h1>
        <p className="text-zinc-500">
          Vista general del estado de seguridad
        </p>
      </div>

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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
