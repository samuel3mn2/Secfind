import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Clock,
  CalendarClock,
  CheckCircle2,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ClipboardCheck,
  History,
  FileText,
  CalendarX,
  Save,
  User,
  MessageSquare,
  ArrowRightLeft,
  TestTube2,
  Ban,
  CheckCheck,
  XCircle,
  Search,
  Archive,
  ListChecks,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

const RiesgoBadge = ({ value }) => {
  const getColor = () => {
    if (value >= 15) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (value >= 8) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (value >= 4) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-green-500/20 text-green-400 border-green-500/30";
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getColor()}`}>
      {value}
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

// Badge de alerta para fechas vencidas
const AlertaVencidaBadge = ({ estado }) => {
  if (estado !== "vencida") return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs font-bold animate-pulse">
      <AlertTriangle className="w-3 h-3" />
      ⚠️ VENCIDA
    </span>
  );
};

// Componente Timeline para historial de impedimentos
const TimelineImpedimentos = ({ historial, veces_cambiada_fecha, fechaCompromisoActual }) => {
  if (!historial || historial.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay registros de seguimiento aún</p>
      </div>
    );
  }

  const getResultadoColor = (resultado) => {
    const r = resultado?.toLowerCase() || "";
    if (r === "corregido") return "bg-green-500";
    if (r === "impedimento") return "bg-red-500";
    if (r === "vulnerable") return "bg-orange-500";
    if (r === "pendiente") return "bg-yellow-500";
    if (r === "desestimado") return "bg-zinc-500";
    return "bg-blue-500";
  };

  const getResultadoBadgeClass = (resultado) => {
    const r = resultado?.toLowerCase() || "";
    if (r === "corregido") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (r === "impedimento") return "bg-red-500/20 text-red-400 border-red-500/30";
    if (r === "vulnerable") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    if (r === "pendiente") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (r === "desestimado") return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  // Determinar el tipo de registro basado en resultado y cambio de fecha
  const getTipoRegistro = (entry, index) => {
    const resultado = entry.resultado_retest?.toLowerCase() || "";
    const tieneNuevaFecha = entry.fecha_compromiso_asignada != null;
    
    // Para determinar si hubo cambio de fecha, comparamos con la entrada anterior
    // o con la fecha actual de la vulnerabilidad si es la primera entrada
    let fechaCambio = false;
    if (tieneNuevaFecha) {
      if (index < historial.length - 1) {
        // Comparar con la entrada siguiente (más antigua, ya que está ordenado desc)
        const entradaAnterior = historial[index + 1];
        fechaCambio = entry.fecha_compromiso_asignada !== entradaAnterior?.fecha_compromiso_asignada;
      } else {
        // Es la primera entrada cronológicamente
        fechaCambio = true;
      }
    }

    switch (resultado) {
      case "corregido":
        return {
          tipo: "Validación Técnica",
          subtipo: "Remediación exitosa",
          icon: CheckCheck,
          class: "bg-green-500/10 text-green-400 border-green-500/30"
        };
      case "desestimado":
        return {
          tipo: "Validación Técnica",
          subtipo: "Falso positivo / Riesgo aceptado",
          icon: XCircle,
          class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
        };
      case "vulnerable":
        return {
          tipo: "Validación Técnica",
          subtipo: "Vulnerabilidad persiste",
          icon: TestTube2,
          class: "bg-orange-500/10 text-orange-400 border-orange-500/30"
        };
      case "impedimento":
        return {
          tipo: "Bloqueo Operativo",
          subtipo: tieneNuevaFecha ? "Con reprogramación" : "Sin reprogramación",
          icon: Ban,
          class: "bg-red-500/10 text-red-400 border-red-500/30"
        };
      case "pendiente":
        if (tieneNuevaFecha && fechaCambio) {
          return {
            tipo: "Prórroga Administrativa",
            subtipo: "Reprogramación de fecha",
            icon: ArrowRightLeft,
            class: "bg-purple-500/10 text-purple-400 border-purple-500/30"
          };
        } else {
          return {
            tipo: "Retest Técnico",
            subtipo: "Validación sin cambio de fecha",
            icon: TestTube2,
            class: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
          };
        }
      default:
        return {
          tipo: "Registro",
          subtipo: "",
          icon: FileText,
          class: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
          <History className="w-4 h-4" />
          Bitácora de Seguimientos ({historial.length})
        </h4>
        {veces_cambiada_fecha > 0 && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400">
            <CalendarX className="w-3 h-3 mr-1" />
            Fecha reprogramada {veces_cambiada_fecha}x
          </Badge>
        )}
      </div>

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-2 p-2 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
        <span className="text-xs text-zinc-500 mr-2">Tipos:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <TestTube2 className="w-3 h-3" /> Retest Técnico
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30">
          <ArrowRightLeft className="w-3 h-3" /> Prórroga Admin.
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30">
          <CheckCheck className="w-3 h-3" /> Remediación
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30">
          <Ban className="w-3 h-3" /> Bloqueo
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Línea vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-zinc-700" />

        {historial.map((entry, index) => {
          const tipoInfo = getTipoRegistro(entry, index);
          const TipoIcon = tipoInfo.icon;
          
          return (
            <div key={entry.id_accion || index} className="relative pl-10 pb-6 last:pb-0">
              {/* Punto del timeline */}
              <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getResultadoColor(entry.resultado_retest)} ring-4 ring-zinc-900`} />
              
              {/* Contenido */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                {/* Header de la entrada */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Badge de resultado */}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getResultadoBadgeClass(entry.resultado_retest)}`}>
                    {entry.resultado_retest}
                  </span>
                  
                  {/* Badge de TIPO DE REGISTRO */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${tipoInfo.class}`}>
                    <TipoIcon className="w-3 h-3" />
                    {tipoInfo.tipo}
                  </span>
                  
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.fecha_registro_nota ? 
                      format(new Date(entry.fecha_registro_nota), "dd MMM yyyy, HH:mm", { locale: es }) : 
                      "Sin fecha"}
                  </span>
                </div>

                {/* Subtipo y fecha */}
                <div className="flex flex-wrap items-center gap-3 mb-2 text-xs">
                  {tipoInfo.subtipo && (
                    <span className="text-zinc-500 italic">{tipoInfo.subtipo}</span>
                  )}
                  {entry.fecha_compromiso_asignada && (
                    <span className="text-cyan-400 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Nueva fecha: {entry.fecha_compromiso_asignada}
                    </span>
                  )}
                </div>

                {/* Usuario */}
                <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {entry.usuario_registro || "Sistema"}
                </div>

                {/* Notas de impedimento */}
                {entry.notas_impedimento && (
                  <div className="mt-2 p-3 bg-zinc-900/50 rounded border-l-2 border-amber-500/50">
                    <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      Notas / Impedimento:
                    </p>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{entry.notas_impedimento}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function SeguimientoRiesgos() {
  const { isAdmin, canView } = useAuth();
  const [activeTab, setActiveTab] = useState("vulnerabilidades");
  
  // Vulnerabilidades state
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [resumenVulns, setResumenVulns] = useState(null);
  
  // Hallazgos state
  const [hallazgos, setHallazgos] = useState([]);
  const [resumenHallazgos, setResumenHallazgos] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  
  // Shared filters
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterResponsable, setFilterResponsable] = useState([]);
  const [filterMes, setFilterMes] = useState("");
  const [filterAño, setFilterAño] = useState("");
  const [filterTipoFecha, setFilterTipoFecha] = useState("todas");
  
  // Vuln-specific filters
  const [filterSeveridad, setFilterSeveridad] = useState([]);
  const [filterInstitucion, setFilterInstitucion] = useState([]);
  const [filterInforme, setFilterInforme] = useState([]);
  const [filterAplicacion, setFilterAplicacion] = useState([]);
  
  // Vista de seguimiento (4 pestañas)
  const [vistaActiva, setVistaActiva] = useState("activas_con_fecha"); // activas_con_fecha | en_analisis | en_retest | historico
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Modal state
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [viewingType, setViewingType] = useState("vulnerabilidad");
  
  // Seguimiento/Bitácora state
  const [historialSeguimiento, setHistorialSeguimiento] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [showSeguimientoForm, setShowSeguimientoForm] = useState(false);
  const [seguimientoForm, setSeguimientoForm] = useState({
    resultado_retest: "",
    fecha_compromiso_asignada: "",
    fecha_cierre: "",
    notas_impedimento: "",
    aplicacion_especifica: ""  // "" = General (todas las apps)
  });
  const [savingSeguimiento, setSavingSeguimiento] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const canViewModule = isAdmin || canView("vulnerabilidades");

  // Year and month options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
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

  // Fetch historial de seguimiento para una vulnerabilidad
  const fetchHistorialSeguimiento = async (vulnId) => {
    setLoadingHistorial(true);
    try {
      const response = await axios.get(`${API}/seguimiento/${vulnId}/historial`);
      setHistorialSeguimiento(response.data.historial || []);
      // Actualizar también los contadores en viewingItem
      if (viewingItem && viewingItem.id === vulnId) {
        setViewingItem(prev => ({
          ...prev,
          veces_cambiada_fecha: response.data.veces_cambiada_fecha || 0,
          veces_en_retest: response.data.veces_en_retest || 0
        }));
      }
    } catch (error) {
      console.error("Error fetching historial:", error);
      setHistorialSeguimiento([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Registrar seguimiento
  const handleRegistrarSeguimiento = async () => {
    if (!seguimientoForm.resultado_retest) {
      toast.error("Selecciona un resultado de retest");
      return;
    }
    
    setSavingSeguimiento(true);
    try {
      // Preparar payload - enviar null en lugar de "" para aplicacion_especifica si es general
      const payload = {
        ...seguimientoForm,
        aplicacion_especifica: seguimientoForm.aplicacion_especifica || null
      };
      const response = await axios.post(`${API}/seguimiento/${viewingItem.id}/registrar`, payload);
      toast.success("Seguimiento registrado exitosamente");
      
      // Actualizar viewingItem con los nuevos datos
      setViewingItem(response.data.vulnerabilidad);
      
      // Recargar historial
      await fetchHistorialSeguimiento(viewingItem.id);
      
      // Recargar lista de vulnerabilidades
      fetchVulnerabilidades();
      
      // Limpiar formulario
      setSeguimientoForm({
        resultado_retest: "",
        fecha_compromiso_asignada: "",
        fecha_cierre: "",
        notas_impedimento: "",
        aplicacion_especifica: ""
      });
      setShowSeguimientoForm(false);
      
      // Cambiar a pestaña de bitácora
      setActiveDetailTab("bitacora");
    } catch (error) {
      console.error("Error registrando seguimiento:", error);
      toast.error(error.response?.data?.detail || "Error al registrar seguimiento");
    } finally {
      setSavingSeguimiento(false);
    }
  };

  // Al abrir el modal de vista, cargar historial
  const handleViewVulnerabilidad = (vuln) => {
    setViewingItem(vuln);
    setViewingType("vulnerabilidad");
    setShowViewModal(true);
    setActiveDetailTab("info");
    setHistorialSeguimiento([]);
    fetchHistorialSeguimiento(vuln.id);
  };

  // Fetch Vulnerabilidades
  const fetchVulnerabilidades = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      
      // Enviar la vista activa (4 tabs)
      params.append("vista", vistaActiva);
      
      // Solo aplicar filtros de fecha si estamos en "activas_con_fecha"
      if (vistaActiva === "activas_con_fecha") {
        if (filterEstado && filterEstado !== "all") params.append("filtro", filterEstado);
        if (filterMes && filterMes !== "all") params.append("mes", filterMes);
        if (filterAño && filterAño !== "all") params.append("año_compromiso", filterAño);
        if (filterTipoFecha) params.append("tipo_fecha", filterTipoFecha);
      }
      
      // Filtros comunes
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      
      // Búsqueda por código o nombre
      if (debouncedSearch && debouncedSearch.trim()) {
        params.append("busqueda", debouncedSearch.trim());
      }

      const response = await axios.get(`${API}/seguimiento-riesgos?${params.toString()}`);
      setVulnerabilidades(response.data);
    } catch (error) {
      console.error("Error fetching vulnerabilidades:", error);
      toast.error("Error al cargar vulnerabilidades");
    }
  }, [filterEstado, filterSeveridad, filterInstitucion, filterInforme, filterAplicacion, filterResponsable, filterMes, filterAño, filterTipoFecha, vistaActiva, debouncedSearch]);

  const fetchResumenVulns = async () => {
    try {
      const response = await axios.get(`${API}/seguimiento-riesgos/resumen`);
      setResumenVulns(response.data);
    } catch (error) {
      console.error("Error fetching resumen vulns:", error);
    }
  };

  // Fetch Hallazgos
  const fetchHallazgos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterEstado && filterEstado !== "all") params.append("filtro", filterEstado);
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      if (filterMes && filterMes !== "all") params.append("mes", filterMes);
      if (filterAño && filterAño !== "all") params.append("año_compromiso", filterAño);
      if (filterTipoFecha) params.append("tipo_fecha", filterTipoFecha);

      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hallazgos-auditoria/seguimiento?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHallazgos(response.data);
    } catch (error) {
      console.error("Error fetching hallazgos:", error);
      toast.error("Error al cargar hallazgos");
    }
  }, [filterEstado, filterResponsable, filterMes, filterAño, filterTipoFecha]);

  const fetchResumenHallazgos = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hallazgos-auditoria/seguimiento/resumen`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResumenHallazgos(response.data);
    } catch (error) {
      console.error("Error fetching resumen hallazgos:", error);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset página al cambiar búsqueda o vista
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, vistaActiva]);

  // Carga inicial (solo una vez)
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchVulnerabilidades(),
      fetchResumenVulns(),
      fetchHallazgos(),
      fetchResumenHallazgos()
    ]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo carga inicial
  
  // Efecto separado para búsqueda y filtros (sin recargar resúmenes)
  useEffect(() => {
    // No ejecutar en la carga inicial
    if (debouncedSearch !== undefined) {
      fetchVulnerabilidades();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterEstado, filterSeveridad, filterInstitucion, filterInforme, filterAplicacion, filterResponsable, filterMes, filterAño, filterTipoFecha, vistaActiva]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterEstado]);

  const handleView = (item, type) => {
    setViewingItem(item);
    setViewingType(type);
    setShowViewModal(true);
    setActiveDetailTab("info");
    setHistorialSeguimiento([]);
    
    // Si es vulnerabilidad, cargar historial de seguimiento
    if (type === "vulnerabilidad" && item.id) {
      fetchHistorialSeguimiento(item.id);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    Promise.all([
      fetchVulnerabilidades(),
      fetchResumenVulns(),
      fetchHallazgos(),
      fetchResumenHallazgos()
    ]).finally(() => setLoading(false));
  };

  const clearFilters = () => {
    setFilterEstado("all");
    setFilterSeveridad([]);
    setFilterInstitucion([]);
    setFilterInforme([]);
    setFilterAplicacion([]);
    setFilterResponsable([]);
    setFilterMes("");
    setFilterAño("");
    setFilterTipoFecha("todas");
  };

  // Get current data based on active tab
  const currentData = activeTab === "vulnerabilidades" ? vulnerabilidades : hallazgos;
  const currentResumen = activeTab === "vulnerabilidades" ? resumenVulns : resumenHallazgos;
  
  const paginatedData = currentData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(currentData.length / itemsPerPage);

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
            Control y seguimiento de remediaciones pendientes
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
          <TabsTrigger 
            value="vulnerabilidades" 
            className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex items-center gap-2"
            data-testid="tab-vulnerabilidades"
          >
            <ShieldAlert className="w-4 h-4" />
            Vulnerabilidades
            {resumenVulns && (
              <Badge variant="outline" className="ml-1 bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">
                {resumenVulns.total_pendientes}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="hallazgos" 
            className="data-[state=active]:bg-teal-600 data-[state=active]:text-white flex items-center gap-2"
            data-testid="tab-hallazgos"
          >
            <ClipboardCheck className="w-4 h-4" />
            Hallazgos de Auditoría
            {resumenHallazgos && (
              <Badge variant="outline" className="ml-1 bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">
                {resumenHallazgos.total_pendientes}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* KPI Cards - Solo mostrar en vista "Activas con Fecha" */}
        {currentResumen && vistaActiva === "activas_con_fecha" && (
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
                    <p className="text-2xl font-bold text-red-500">{currentResumen.vencidas}</p>
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
                    <p className="text-2xl font-bold text-orange-500">{currentResumen.criticas_7_dias}</p>
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
                    <p className="text-2xl font-bold text-yellow-500">{currentResumen.proximas_30_dias}</p>
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
                    <p className="text-2xl font-bold text-indigo-500">{currentResumen.total_pendientes}</p>
                    <p className="text-xs text-zinc-500">Total Pendientes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 4 Pestañas de Vista y Barra de Búsqueda */}
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* 4 Tabs de Vista del Ciclo de Vida */}
              <div className="flex flex-wrap items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-700">
                <button
                  onClick={() => {
                    setVistaActiva("activas_con_fecha");
                    setSearchQuery("");
                    setFilterEstado("all");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    vistaActiva === "activas_con_fecha" 
                      ? "bg-indigo-600 text-white shadow-lg" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="tab-activas-con-fecha"
                >
                  <CalendarClock className="w-4 h-4" />
                  Activas con Fecha
                </button>
                <button
                  onClick={() => {
                    setVistaActiva("en_analisis");
                    setSearchQuery("");
                    setFilterEstado("all");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    vistaActiva === "en_analisis" 
                      ? "bg-amber-600 text-white shadow-lg" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="tab-en-analisis"
                >
                  <Clock className="w-4 h-4" />
                  En Análisis
                </button>
                <button
                  onClick={() => {
                    setVistaActiva("en_retest");
                    setSearchQuery("");
                    setFilterEstado("all");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    vistaActiva === "en_retest" 
                      ? "bg-cyan-600 text-white shadow-lg" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="tab-en-retest"
                >
                  <TestTube2 className="w-4 h-4" />
                  En Retest
                </button>
                <button
                  onClick={() => {
                    setVistaActiva("historico");
                    setSearchQuery("");
                    setFilterEstado("all");
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    vistaActiva === "historico" 
                      ? "bg-emerald-600 text-white shadow-lg" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="tab-historico"
                >
                  <Archive className="w-4 h-4" />
                  Histórico Cerrado
                </button>
              </div>

              {/* Barra de Búsqueda */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por código o nombre de vulnerabilidad..."
                  className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  data-testid="search-vulnerabilidades"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Indicador de vista activa */}
            <div className="mt-3 p-2 rounded-lg flex items-center gap-2 text-sm" style={{
              backgroundColor: vistaActiva === "activas_con_fecha" ? "rgba(99, 102, 241, 0.1)" :
                              vistaActiva === "en_analisis" ? "rgba(245, 158, 11, 0.1)" :
                              vistaActiva === "en_retest" ? "rgba(6, 182, 212, 0.1)" :
                              "rgba(16, 185, 129, 0.1)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: vistaActiva === "activas_con_fecha" ? "rgba(99, 102, 241, 0.3)" :
                           vistaActiva === "en_analisis" ? "rgba(245, 158, 11, 0.3)" :
                           vistaActiva === "en_retest" ? "rgba(6, 182, 212, 0.3)" :
                           "rgba(16, 185, 129, 0.3)"
            }}>
              {vistaActiva === "activas_con_fecha" && (
                <p className="text-indigo-400 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4" />
                  <span><strong>Activas con Fecha:</strong> Vulnerabilidades abiertas con calendario activo</span>
                </p>
              )}
              {vistaActiva === "en_analisis" && (
                <p className="text-amber-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span><strong>En Análisis:</strong> Sin fecha asignada, último estado Vulnerable o Impedimento</span>
                </p>
              )}
              {vistaActiva === "en_retest" && (
                <p className="text-cyan-400 flex items-center gap-2">
                  <TestTube2 className="w-4 h-4" />
                  <span><strong>En Retest:</strong> En proceso de validación técnica con proveedor</span>
                </p>
              )}
              {vistaActiva === "historico" && (
                <p className="text-emerald-400 flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  <span><strong>Histórico Cerrado:</strong> Vulnerabilidades Corregidas o Desestimadas</span>
                </p>
              )}
            </div>
            
            {/* Indicador de búsqueda activa */}
            {debouncedSearch && (
              <div className="mt-3 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between">
                <p className="text-sm text-cyan-400 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span>Buscando: <strong>&quot;{debouncedSearch}&quot;</strong> - {vulnerabilidades.length} resultado(s)</span>
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-cyan-400 hover:text-cyan-300 text-sm underline"
                >
                  Limpiar
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters - Solo mostrar filtros de fecha en vista "Activas con Fecha" */}
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              {/* Tipo Fecha Filter - Solo mostrar en vista "Activas con Fecha" */}
              {vistaActiva === "activas_con_fecha" && (
                <Select value={filterTipoFecha} onValueChange={setFilterTipoFecha}>
                  <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-700 text-white" data-testid="filter-tipo-fecha">
                    <SelectValue placeholder="Tipo fecha" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="con_fecha">Con fecha</SelectItem>
                    <SelectItem value="sin_fecha">Sin fecha</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Vulnerabilidades-specific filters */}
              {activeTab === "vulnerabilidades" && (
                <>
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
                </>
              )}

              <MultiSelectFilter
                options={options?.responsables?.map(r => r.nombre) || []}
                selected={filterResponsable}
                onChange={setFilterResponsable}
                placeholder="Responsable"
                searchPlaceholder="Buscar responsable..."
                allLabel="Todos los responsables"
                data-testid="filter-responsable"
              />

              {/* Month Filter - Solo mostrar en vista "Activas con Fecha" */}
              {vistaActiva === "activas_con_fecha" && (
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
              )}

              {/* Year Filter - Solo mostrar en vista "Activas con Fecha" */}
              {vistaActiva === "activas_con_fecha" && (
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
              )}

              {(filterEstado !== "all" || filterSeveridad.length > 0 || filterInstitucion.length > 0 || filterInforme.length > 0 || filterAplicacion.length > 0 || filterResponsable.length > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-zinc-400 hover:text-white"
                >
                  Limpiar filtros
                </Button>
              )}

              <div className="ml-auto text-sm text-zinc-500">
                {currentData.length} registros
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vulnerabilidades Tab Content */}
        <TabsContent value="vulnerabilidades" className="mt-0">
          <Card className="bg-[#18181b] border-[#27272a]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Estado</TableHead>
                      <TableHead className="text-zinc-400">F. Compromiso</TableHead>
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
                          No hay vulnerabilidades pendientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((vuln) => (
                        <TableRow
                          key={vuln.id}
                          className={`border-zinc-800 hover:bg-zinc-800/50 ${vuln.estado_seguimiento === "vencida" ? "bg-red-500/5" : ""}`}
                          data-testid={`vuln-row-${vuln.id}`}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {/* Badge principal según vista */}
                              {vistaActiva === "en_retest" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded text-cyan-400 text-xs font-bold">
                                  <TestTube2 className="w-3 h-3" />
                                  🧪 En Retest
                                </span>
                              )}
                              {vistaActiva === "en_analisis" && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded text-amber-400 text-xs font-bold">
                                  <Clock className="w-3 h-3" />
                                  ⏳ En Análisis
                                </span>
                              )}
                              {vistaActiva === "activas_con_fecha" && (
                                <>
                                  <StatusBadge 
                                    estado={vuln.estado_seguimiento} 
                                    diasRestantes={vuln.dias_restantes} 
                                  />
                                  {vuln.estado_seguimiento === "vencida" && (
                                    <AlertaVencidaBadge estado="vencida" />
                                  )}
                                </>
                              )}
                              {vistaActiva === "historico" && (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                  vuln.resultado_re_test === "Corregido" 
                                    ? "bg-green-500/20 border border-green-500/50 text-green-400"
                                    : "bg-zinc-500/20 border border-zinc-500/50 text-zinc-400"
                                }`}>
                                  {vuln.resultado_re_test === "Corregido" ? (
                                    <><CheckCircle2 className="w-3 h-3" /> Corregido</>
                                  ) : (
                                    <><XCircle className="w-3 h-3" /> Desestimado</>
                                  )}
                                </span>
                              )}
                              {/* Mostrar resultado_re_test como badge secundario si existe */}
                              {vistaActiva !== "historico" && vuln.resultado_re_test && (
                                <span className="text-[10px] text-zinc-500">
                                  Últ: {vuln.resultado_re_test}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-300 font-mono text-sm">
                            {vuln.fecha_compromiso || "-"}
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={vuln.severidad} />
                          </TableCell>
                          <TableCell className="text-zinc-300">{vuln.institucion || "-"}</TableCell>
                          <TableCell className="text-zinc-100">
                            <span className="whitespace-normal break-words line-clamp-2">
                              {vuln.vulnerabilidad || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-300">{vuln.responsable || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                              onClick={() => handleView(vuln, "vulnerabilidad")}
                              data-testid={`view-vuln-btn-${vuln.id}`}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hallazgos Tab Content */}
        <TabsContent value="hallazgos" className="mt-0">
          <Card className="bg-[#18181b] border-[#27272a]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Estado</TableHead>
                      <TableHead className="text-zinc-400">F. Compromiso</TableHead>
                      <TableHead className="text-zinc-400">Código</TableHead>
                      <TableHead className="text-zinc-400 min-w-[250px]">Brecha</TableHead>
                      <TableHead className="text-zinc-400">R.I.</TableHead>
                      <TableHead className="text-zinc-400">Responsable</TableHead>
                      <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                          No hay hallazgos de auditoría pendientes
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((hallazgo) => (
                        <TableRow
                          key={hallazgo.id}
                          className={`border-zinc-800 hover:bg-zinc-800/50 ${hallazgo.estado_seguimiento === "vencida" ? "bg-red-500/5" : ""}`}
                          data-testid={`hallazgo-row-${hallazgo.id}`}
                        >
                          <TableCell>
                            <StatusBadge 
                              estado={hallazgo.estado_seguimiento} 
                              diasRestantes={hallazgo.dias_restantes} 
                            />
                          </TableCell>
                          <TableCell>
                            {hallazgo.fecha_compromiso ? (
                              <div className="flex items-center gap-1">
                                <span className={`font-mono text-xs ${hallazgo.estado_seguimiento === "vencida" ? "text-red-400" : "text-zinc-300"}`}>
                                  {format(new Date(hallazgo.fecha_compromiso), "dd/MM/yyyy")}
                                </span>
                                {hallazgo.estado_seguimiento === "vencida" && (
                                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1">
                                    VENCIDO
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-500">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30 font-mono text-xs">
                              {hallazgo.codigo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-100">
                            <span className="whitespace-normal break-words line-clamp-2">
                              {hallazgo.brecha || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <RiesgoBadge value={hallazgo.riesgo_inherente} />
                          </TableCell>
                          <TableCell className="text-zinc-300">{hallazgo.responsable || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-teal-400 hover:bg-teal-500/10"
                              onClick={() => handleView(hallazgo, "hallazgo")}
                              data-testid={`view-hallazgo-btn-${hallazgo.id}`}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
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

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={(open) => {
        setShowViewModal(open);
        if (!open) {
          setShowSeguimientoForm(false);
          setSeguimientoForm({ resultado_retest: "", fecha_compromiso_asignada: "", fecha_cierre: "", notas_impedimento: "", aplicacion_especifica: "" });
        }
      }}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {viewingType === "vulnerabilidad" ? (
                <>
                  <ShieldAlert className="w-5 h-5 text-cyan-500" />
                  Detalle de Vulnerabilidad
                  {viewingItem?.estado_seguimiento === "vencida" && (
                    <AlertaVencidaBadge estado="vencida" />
                  )}
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-5 h-5 text-teal-500" />
                  Detalle de Hallazgo
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {viewingItem && viewingType === "vulnerabilidad" && (
              <div className="space-y-4">
                {/* Status Header */}
                <div className="flex flex-wrap gap-3 items-center">
                  <StatusBadge 
                    estado={viewingItem.estado_seguimiento} 
                    diasRestantes={viewingItem.dias_restantes} 
                  />
                  <SeverityBadge severity={viewingItem.severidad} />
                  <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                    {viewingItem.estatus}
                  </Badge>
                  {viewingItem.veces_cambiada_fecha > 0 && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                      <CalendarX className="w-3 h-3 mr-1" />
                      {viewingItem.veces_cambiada_fecha}x reprogramada
                    </Badge>
                  )}
                  {viewingItem.veces_en_retest > 0 && (
                    <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      {viewingItem.veces_en_retest}x retest
                    </Badge>
                  )}
                </div>

                {/* Tabs for Info/Bitácora */}
                <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                    <TabsTrigger value="info" className="data-[state=active]:bg-zinc-700">
                      <FileText className="w-4 h-4 mr-2" />
                      Información
                    </TabsTrigger>
                    <TabsTrigger value="bitacora" className="data-[state=active]:bg-zinc-700">
                      <History className="w-4 h-4 mr-2" />
                      Bitácora ({historialSeguimiento.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4 space-y-4">
                    {/* Grid Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Compromiso</p>
                        <p className={`font-mono text-lg ${viewingItem.estado_seguimiento === "vencida" ? "text-red-400" : "text-white"}`}>
                          {viewingItem.fecha_compromiso || "-"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Días Restantes</p>
                        <p className={`text-lg font-bold ${
                          viewingItem.dias_restantes < 0 ? "text-red-500" :
                          viewingItem.dias_restantes <= 7 ? "text-orange-500" :
                          viewingItem.dias_restantes <= 30 ? "text-yellow-500" : "text-green-500"
                        }`}>
                          {viewingItem.dias_restantes !== null ? viewingItem.dias_restantes : "-"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Institución</p>
                        <p className="text-white">{viewingItem.institucion || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Responsable</p>
                        <p className="text-white">{viewingItem.responsable || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Código</p>
                        <p className="text-cyan-400 font-mono">{viewingItem.codigo || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Resultado Retest</p>
                        <p className="text-white">{viewingItem.resultado_re_test || "-"}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Vulnerabilidad</p>
                      <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                        {viewingItem.vulnerabilidad || "-"}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Recomendaciones</p>
                      <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                        {viewingItem.recomendaciones || "-"}
                      </p>
                    </div>

                    {/* Formulario de Registro de Seguimiento */}
                    <div className="border-t border-zinc-700 pt-4">
                      {!showSeguimientoForm ? (
                        <Button
                          onClick={() => setShowSeguimientoForm(true)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700"
                          data-testid="btn-registrar-seguimiento"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Registrar Seguimiento / Impedimento
                        </Button>
                      ) : (
                        <div className="space-y-4 bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                          <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Nuevo Registro de Seguimiento
                          </h4>
                          
                          {/* Selector de Aplicación Específica - Solo si hay múltiples apps */}
                          {viewingItem?.aplicaciones?.length > 1 && (
                            <div className="space-y-2">
                              <Label className="text-cyan-400">
                                Aplicación (opcional)
                                <span className="text-zinc-500 ml-2 font-normal">- Deja vacío para aplicar a todas</span>
                              </Label>
                              <Select
                                value={seguimientoForm.aplicacion_especifica}
                                onValueChange={(value) => setSeguimientoForm(prev => ({ ...prev, aplicacion_especifica: value === "_general_" ? "" : value }))}
                              >
                                <SelectTrigger className="bg-zinc-900 border-zinc-700 border-cyan-500/30" data-testid="select-aplicacion-especifica">
                                  <SelectValue placeholder="General (todas las aplicaciones)" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                  <SelectItem value="_general_">General (todas las aplicaciones)</SelectItem>
                                  {viewingItem.aplicaciones.map((app) => (
                                    <SelectItem key={app} value={app}>{app}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-zinc-400">Resultado Retest *</Label>
                              <Select
                                value={seguimientoForm.resultado_retest}
                                onValueChange={(v) => {
                                  // Estados que fuerzan limpieza de fecha compromiso
                                  const estadosSinFechaCompromiso = ["Corregido", "Desestimado", "En Retest", "Nota de Seguimiento"];
                                  const estadosConFechaCierre = ["Corregido", "Desestimado"];
                                  const limpiarFechaCompromiso = estadosSinFechaCompromiso.includes(v);
                                  const mostrarFechaCierre = estadosConFechaCierre.includes(v);
                                  
                                  setSeguimientoForm(prev => ({ 
                                    ...prev, 
                                    resultado_retest: v,
                                    fecha_compromiso_asignada: limpiarFechaCompromiso ? "" : prev.fecha_compromiso_asignada,
                                    // Pre-llenar fecha de cierre con hoy si es Corregido/Desestimado
                                    fecha_cierre: mostrarFechaCierre ? (prev.fecha_cierre || new Date().toISOString().split('T')[0]) : ""
                                  }));
                                }}
                              >
                                <SelectTrigger className="bg-zinc-900 border-zinc-700" data-testid="select-resultado-retest">
                                  <SelectValue placeholder="Seleccionar resultado" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                  <SelectItem value="Corregido">Corregido - Remediación exitosa</SelectItem>
                                  <SelectItem value="Pendiente">Pendiente - Prórroga o retest fallido</SelectItem>
                                  <SelectItem value="Impedimento">Impedimento - Bloqueo operativo</SelectItem>
                                  <SelectItem value="Vulnerable">Vulnerable - Persiste tras validación</SelectItem>
                                  <SelectItem value="Desestimado">Desestimado - Falso positivo / Riesgo aceptado</SelectItem>
                                  <SelectItem value="En Retest">En Retest - En validación con proveedor</SelectItem>
                                  <SelectItem value="Nota de Seguimiento">Nota de Seguimiento - Comentario</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              {(() => {
                                const estadosSinFechaCompromiso = ["Corregido", "Desestimado", "En Retest", "Nota de Seguimiento"];
                                const estadosConFechaCierre = ["Corregido", "Desestimado"];
                                const deshabilitarFechaCompromiso = estadosSinFechaCompromiso.includes(seguimientoForm.resultado_retest);
                                const mostrarFechaCierre = estadosConFechaCierre.includes(seguimientoForm.resultado_retest);
                                
                                // Mostrar campo de Fecha de Cierre para Corregido/Desestimado
                                if (mostrarFechaCierre) {
                                  return (
                                    <>
                                      <Label className="text-green-400">
                                        Fecha de Cierre *
                                      </Label>
                                      <Input
                                        type="date"
                                        value={seguimientoForm.fecha_cierre}
                                        onChange={(e) => setSeguimientoForm(prev => ({ ...prev, fecha_cierre: e.target.value }))}
                                        className="bg-zinc-900 border-zinc-700 border-green-500/30"
                                        data-testid="input-fecha-cierre"
                                      />
                                      <p className="text-xs text-green-500/70">Se vinculará a la vulnerabilidad</p>
                                    </>
                                  );
                                }
                                
                                // Mostrar campo de Fecha Compromiso para otros estados
                                const mensajeEstado = seguimientoForm.resultado_retest === "En Retest"
                                  ? "(Se congela fecha - En validación)"
                                  : seguimientoForm.resultado_retest === "Nota de Seguimiento"
                                    ? "(No altera fecha)"
                                    : "";
                                return (
                                  <>
                                    <Label className={deshabilitarFechaCompromiso ? "text-zinc-600" : "text-zinc-400"}>
                                      Nueva Fecha Compromiso
                                      {deshabilitarFechaCompromiso && (
                                        <span className="text-xs text-zinc-500 ml-2">{mensajeEstado}</span>
                                      )}
                                    </Label>
                                    <Input
                                      type="date"
                                      value={seguimientoForm.fecha_compromiso_asignada}
                                      onChange={(e) => setSeguimientoForm(prev => ({ ...prev, fecha_compromiso_asignada: e.target.value }))}
                                      className={`bg-zinc-900 border-zinc-700 ${deshabilitarFechaCompromiso ? "opacity-50 cursor-not-allowed" : ""}`}
                                      disabled={deshabilitarFechaCompromiso}
                                      data-testid="input-fecha-compromiso"
                                    />
                                    {seguimientoForm.fecha_compromiso_asignada && 
                                     seguimientoForm.fecha_compromiso_asignada !== viewingItem.fecha_compromiso &&
                                     !deshabilitarFechaCompromiso && (
                                      <p className="text-xs text-amber-400">⚠️ Se incrementará el contador de reprogramaciones</p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-zinc-400">Notas / Detalle del Impedimento</Label>
                            <Textarea
                              value={seguimientoForm.notas_impedimento}
                              onChange={(e) => setSeguimientoForm(prev => ({ ...prev, notas_impedimento: e.target.value }))}
                              placeholder="Describe el impedimento, bloqueo o notas relevantes de esta interacción..."
                              className="bg-zinc-900 border-zinc-700 min-h-[100px]"
                              data-testid="textarea-notas-impedimento"
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleRegistrarSeguimiento}
                              disabled={savingSeguimiento || !seguimientoForm.resultado_retest}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid="btn-guardar-seguimiento"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {savingSeguimiento ? "Guardando..." : "Guardar Registro"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowSeguimientoForm(false);
                                setSeguimientoForm({ resultado_retest: "", fecha_compromiso_asignada: "", fecha_cierre: "", notas_impedimento: "", aplicacion_especifica: "" });
                              }}
                              className="border-zinc-600"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="bitacora" className="mt-4">
                    {loadingHistorial ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-zinc-500" />
                        <p className="text-zinc-500 mt-2">Cargando historial...</p>
                      </div>
                    ) : (
                      <TimelineImpedimentos 
                        historial={historialSeguimiento} 
                        veces_cambiada_fecha={viewingItem?.veces_cambiada_fecha || 0}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {viewingItem && viewingType === "hallazgo" && (
              <div className="space-y-4">
                {/* Status Header */}
                <div className="flex flex-wrap gap-3 items-center">
                  <StatusBadge 
                    estado={viewingItem.estado_seguimiento} 
                    diasRestantes={viewingItem.dias_restantes} 
                  />
                  <RiesgoBadge value={viewingItem.riesgo_inherente} />
                  <Badge variant="outline" className="border-zinc-600 text-zinc-300">
                    {viewingItem.estado}
                  </Badge>
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Código</p>
                    <p className="text-teal-400 font-mono text-lg">{viewingItem.codigo}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Riesgo Inherente</p>
                    <p className="text-lg font-bold text-white">{viewingItem.riesgo_inherente}</p>
                    <p className="text-xs text-zinc-500">Prob: {viewingItem.probabilidad} × Imp: {viewingItem.impacto}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Hallazgo</p>
                    <p className="text-white font-mono">{viewingItem.fecha_hallazgo ? format(new Date(viewingItem.fecha_hallazgo), "dd/MM/yyyy") : "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Compromiso</p>
                    <p className={`font-mono ${viewingItem.estado_seguimiento === "vencida" ? "text-red-400" : "text-white"}`}>
                      {viewingItem.fecha_compromiso ? format(new Date(viewingItem.fecha_compromiso), "dd/MM/yyyy") : "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Responsable</p>
                    <p className="text-white">{viewingItem.responsable || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Riesgo Asociado</p>
                    <p className="text-white">{viewingItem.nombre_riesgo || "-"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide">Brecha / Descripción</p>
                  <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                    {viewingItem.brecha || "-"}
                  </p>
                </div>

                {viewingItem.observaciones && (
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Observaciones</p>
                    <p className="text-white whitespace-pre-wrap bg-zinc-800/50 p-3 rounded-lg">
                      {viewingItem.observaciones}
                    </p>
                  </div>
                )}
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
