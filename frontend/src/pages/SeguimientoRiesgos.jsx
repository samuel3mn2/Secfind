import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  AlertTriangle,
  Clock,
  CalendarClock,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SeverityBadge = ({ severity }) => {
  const classes = {
    Critica: "bg-red-500/20 text-red-400 border-red-500/30",
    Alta: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Media: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Baja: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${classes[severity] || "bg-zinc-700 text-zinc-300"}`}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ estado, diasRestantes }) => {
  const getConfig = () => {
    switch (estado) {
      case "vencida":
        return { 
          class: "bg-red-500/20 text-red-400 border-red-500/30", 
          label: `Vencida (${Math.abs(diasRestantes)} días)`,
          icon: AlertTriangle
        };
      case "critico":
        return { 
          class: "bg-orange-500/20 text-orange-400 border-orange-500/30", 
          label: `${diasRestantes} días`,
          icon: Clock
        };
      case "proximo":
        return { 
          class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", 
          label: `${diasRestantes} días`,
          icon: CalendarClock
        };
      case "ok":
        return { 
          class: "bg-green-500/20 text-green-400 border-green-500/30", 
          label: `${diasRestantes} días`,
          icon: CheckCircle2
        };
      default:
        return { 
          class: "bg-zinc-700 text-zinc-300", 
          label: "Sin fecha",
          icon: Clock
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 w-fit ${config.class}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

export default function SeguimientoRiesgos() {
  const { isAdmin, canView } = useAuth();
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterSeveridad, setFilterSeveridad] = useState([]);
  const [filterInstitucion, setFilterInstitucion] = useState([]);
  const [filterInforme, setFilterInforme] = useState([]);
  const [filterAplicacion, setFilterAplicacion] = useState([]);
  const [filterMes, setFilterMes] = useState("");
  const [filterAño, setFilterAño] = useState("");
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingVuln, setViewingVuln] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const canViewModule = isAdmin || canView("vulnerabilidades");

  // Generate year options (current year - 2 to current year + 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  
  // Month options
  const monthOptions = [
    { value: "01", label: "Enero" },
    { value: "02", label: "Febrero" },
    { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Mayo" },
    { value: "06", label: "Junio" },
    { value: "07", label: "Julio" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchResumen = async () => {
    try {
      const response = await axios.get(`${API}/seguimiento-riesgos/resumen`);
      setResumen(response.data);
    } catch (error) {
      console.error("Error fetching resumen:", error);
    }
  };

  const fetchVulnerabilidades = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterEstado && filterEstado !== "all") params.append("filtro", filterEstado);
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterMes && filterMes !== "all") params.append("mes", filterMes);
      if (filterAño && filterAño !== "all") params.append("año_compromiso", filterAño);

      const response = await axios.get(`${API}/seguimiento-riesgos?${params.toString()}`);
      setVulnerabilidades(response.data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching vulnerabilidades:", error);
      toast.error("Error al cargar el seguimiento de riesgos");
    } finally {
      setLoading(false);
    }
  }, [filterEstado, filterSeveridad, filterInstitucion, filterInforme, filterAplicacion, filterMes, filterAño]);

  useEffect(() => {
    fetchOptions();
    fetchResumen();
  }, []);

  useEffect(() => {
    fetchVulnerabilidades();
  }, [fetchVulnerabilidades]);

  const handleView = (vuln) => {
    setViewingVuln(vuln);
    setShowViewModal(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchResumen();
    fetchVulnerabilidades();
  };

  const paginatedData = vulnerabilidades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(vulnerabilidades.length / itemsPerPage);

  if (!canViewModule) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="text-center text-zinc-500 py-12">
          No tiene permisos para ver este módulo
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-zinc-800 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="seguimiento-riesgos-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Seguimiento de Riesgos
          </h1>
          <p className="text-zinc-500 mt-1">
            Vulnerabilidades con fecha de compromiso pendiente
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          data-testid="refresh-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      {resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className={`bg-[#18181b] border-[#27272a] cursor-pointer transition-all hover:border-red-500/50 ${filterEstado === "vencidas" ? "border-red-500" : ""}`}
            onClick={() => setFilterEstado(filterEstado === "vencidas" ? "all" : "vencidas")}
            data-testid="kpi-vencidas"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{resumen.vencidas}</p>
                  <p className="text-xs text-zinc-500">Vencidas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-[#18181b] border-[#27272a] cursor-pointer transition-all hover:border-orange-500/50 ${filterEstado === "critico" ? "border-orange-500" : ""}`}
            onClick={() => setFilterEstado(filterEstado === "critico" ? "all" : "critico")}
            data-testid="kpi-criticas"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{resumen.criticas_7_dias}</p>
                  <p className="text-xs text-zinc-500">Próximos 7 días</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-[#18181b] border-[#27272a] cursor-pointer transition-all hover:border-yellow-500/50 ${filterEstado === "proximas" ? "border-yellow-500" : ""}`}
            onClick={() => setFilterEstado(filterEstado === "proximas" ? "all" : "proximas")}
            data-testid="kpi-proximas"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <CalendarClock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{resumen.proximas_30_dias}</p>
                  <p className="text-xs text-zinc-500">Próximos 30 días</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-[#18181b] border-[#27272a] cursor-pointer transition-all hover:border-indigo-500/50 ${filterEstado === "all" ? "border-indigo-500" : ""}`}
            onClick={() => setFilterEstado("all")}
            data-testid="kpi-total"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-500">{resumen.total_pendientes}</p>
                  <p className="text-xs text-zinc-500">Total Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <MultiSelectFilter
              options={options?.severidades || []}
              selected={filterSeveridad}
              onChange={setFilterSeveridad}
              placeholder="Severidad"
              searchPlaceholder="Buscar severidad..."
              allLabel="Todas las severidades"
              data-testid="filter-severidad"
            />

            <MultiSelectFilter
              options={options?.instituciones || []}
              selected={filterInstitucion}
              onChange={setFilterInstitucion}
              placeholder="Institución"
              searchPlaceholder="Buscar institución..."
              allLabel="Todas las instituciones"
              data-testid="filter-institucion"
            />

            <MultiSelectFilter
              options={options?.aplicaciones || []}
              selected={filterAplicacion}
              onChange={setFilterAplicacion}
              placeholder="Aplicación"
              searchPlaceholder="Buscar aplicación..."
              allLabel="Todas las aplicaciones"
              data-testid="filter-aplicacion"
            />

            <MultiSelectFilter
              options={options?.informes_pentest || []}
              selected={filterInforme}
              onChange={setFilterInforme}
              placeholder="Informe"
              searchPlaceholder="Buscar informe..."
              allLabel="Todos los informes"
              data-testid="filter-informe"
            />

            {/* Month Filter */}
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger className="w-[140px] bg-zinc-900 border-zinc-700 text-white" data-testid="filter-mes">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">Todos los meses</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Filter */}
            <Select value={filterAño} onValueChange={setFilterAño}>
              <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-700 text-white" data-testid="filter-año">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">Todos los años</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filterEstado !== "all" || filterSeveridad || filterInstitucion.length > 0 || filterInforme.length > 0 || filterAplicacion.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterEstado("all");
                  setFilterSeveridad("");
                  setFilterInstitucion([]);
                  setFilterInforme([]);
                  setFilterAplicacion([]);
                }}
                className="text-zinc-400 hover:text-white"
              >
                Limpiar filtros
              </Button>
            )}

            <div className="ml-auto text-sm text-zinc-500">
              {vulnerabilidades.length} registros
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-700 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Estado</TableHead>
                  <TableHead className="text-zinc-400">Fecha Compromiso</TableHead>
                  <TableHead className="text-zinc-400">Severidad</TableHead>
                  <TableHead className="text-zinc-400">Institución</TableHead>
                  <TableHead className="text-zinc-400 min-w-[250px]">Vulnerabilidad</TableHead>
                  <TableHead className="text-zinc-400">Responsable</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                      No hay vulnerabilidades con fecha de compromiso pendiente
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((vuln) => (
                    <TableRow
                      key={vuln.id}
                      className={`border-zinc-800 hover:bg-zinc-800/50 ${vuln.estado_seguimiento === "vencida" ? "bg-red-500/5" : ""}`}
                      data-testid={`riesgo-row-${vuln.id}`}
                    >
                      <TableCell>
                        <StatusBadge 
                          estado={vuln.estado_seguimiento} 
                          diasRestantes={vuln.dias_restantes} 
                        />
                      </TableCell>
                      <TableCell className="text-zinc-300 font-mono text-sm">
                        {vuln.fecha_compromiso || "-"}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={vuln.severidad} />
                      </TableCell>
                      <TableCell className="text-zinc-300">{vuln.institucion || "-"}</TableCell>
                      <TableCell className="text-zinc-100">
                        <span className="whitespace-normal break-words">
                          {vuln.vulnerabilidad || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-300">{vuln.responsable || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                          onClick={() => handleView(vuln)}
                          data-testid={`view-riesgo-btn-${vuln.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
              <p className="text-sm text-zinc-500">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="border-zinc-700 text-zinc-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="border-zinc-700 text-zinc-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-500" />
              Detalle de Riesgo
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {viewingVuln && (
              <div className="space-y-4">
                {/* Status Header */}
                <div className="flex flex-wrap gap-3 items-center">
                  <StatusBadge 
                    estado={viewingVuln.estado_seguimiento} 
                    diasRestantes={viewingVuln.dias_restantes} 
                  />
                  <SeverityBadge severity={viewingVuln.severidad} />
                  <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                    {viewingVuln.estatus}
                  </Badge>
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Compromiso</p>
                    <p className="text-white font-mono text-lg">{viewingVuln.fecha_compromiso || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Días Restantes</p>
                    <p className={`text-lg font-bold ${
                      viewingVuln.dias_restantes < 0 ? "text-red-500" :
                      viewingVuln.dias_restantes <= 7 ? "text-orange-500" :
                      viewingVuln.dias_restantes <= 30 ? "text-yellow-500" : "text-green-500"
                    }`}>
                      {viewingVuln.dias_restantes !== null ? viewingVuln.dias_restantes : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Hallazgo</p>
                    <p className="text-white font-mono">{viewingVuln.fecha_hallazgo || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Institución</p>
                    <p className="text-white">{viewingVuln.institucion || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Responsable</p>
                    <p className="text-white">{viewingVuln.responsable || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Proveedor</p>
                    <p className="text-white">{viewingVuln.proveedor || "-"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Informe Pentest</p>
                  <p className="text-white">{viewingVuln.nombre_informe_pentest || "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Vulnerabilidad</p>
                  <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                    {viewingVuln.vulnerabilidad || "-"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Riesgo Asociado</p>
                  <p className="text-white">{viewingVuln.riesgo_asociado || "-"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Descripción del Riesgo</p>
                  <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                    {viewingVuln.descripcion_riesgo || "-"}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Recomendaciones</p>
                  <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                    {viewingVuln.recomendaciones || "-"}
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowViewModal(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
