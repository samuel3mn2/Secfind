import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  Plus,
  Search,
  Upload,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  ChevronsUpDown,
  Check,
  FileText,
  CheckSquare,
  Square,
  Layers,
  Columns,
  Settings2,
  AlertTriangle,
  Shield,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import ImportarPDF from "@/pages/ImportarPDF";
import BulkEntryModal from "@/components/BulkEntryModal";
import { TimelineSeguimiento } from "@/components/TimelineSeguimiento";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";
import { ConfirmChangesModal } from "@/components/ConfirmChangesModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SeverityBadge = ({ severity }) => {
  const classes = {
    Critica: "severity-critical",
    Alta: "severity-alta",
    Media: "severity-media",
    Baja: "severity-baja",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${classes[severity] || ""}`}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const getClass = (s) => {
    const normalized = s?.toLowerCase().replace(/\s+/g, "-");
    if (["cerrado", "corregido"].includes(normalized)) return "status-cerrado";
    if (["pendiente", "en-proceso"].includes(normalized)) return "status-pendiente";
    if (normalized === "para-re-test") return "status-para-re-test";
    if (normalized === "desestimado") return "status-desestimado";
    return "status-pendiente";
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getClass(status)}`}>
      {status}
    </span>
  );
};

// Opciones de Nivel de Riesgo Corporativo GRC
const NIVEL_RIESGO_OPTIONS = ["Alto", "Medio Alto", "Medio", "Bajo"];

// Colores para el badge de Nivel de Riesgo
const getNivelRiesgoClass = (nivel) => {
  switch (nivel) {
    case "Alto":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "Medio Alto":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Medio":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Bajo":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
};

// NivelRiesgoBadge component
const NivelRiesgoBadge = ({ nivel }) => {
  if (!nivel) return <span className="text-zinc-500 text-xs">-</span>;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getNivelRiesgoClass(nivel)}`}>
      {nivel}
    </span>
  );
};

// Available columns configuration
const ALL_COLUMNS = [
  { id: "codigo", label: "Código", default: true },
  { id: "fecha_hallazgo", label: "Fecha", default: true },
  { id: "institucion", label: "Institución", default: true },
  { id: "aplicaciones", label: "Aplicaciones", default: true },
  { id: "vulnerabilidad", label: "Vulnerabilidad", default: true },
  { id: "descripcion_riesgo", label: "Descripción del Riesgo", default: false },
  { id: "recomendaciones", label: "Recomendaciones", default: false },
  { id: "severidad", label: "Severidad", default: true },
  { id: "nivel_riesgo", label: "Nivel Riesgo", default: true },
  { id: "estatus", label: "Estatus", default: true },
  { id: "responsable", label: "Responsable", default: true },
  { id: "fecha_compromiso", label: "Fecha Compromiso", default: false },
  { id: "dominio", label: "Dominio", default: false },
  { id: "control_asociado", label: "Control Asociado", default: false },
  { id: "riesgo_catalogo", label: "Riesgo Catálogo", default: false },
  { id: "resultado_re_test", label: "Resultado Retest", default: false },
  { id: "veces_en_retest", label: "Veces Retest", default: false },
  { id: "nombre_informe_pentest", label: "Informe Pentest", default: false },
  { id: "proveedor", label: "Proveedor", default: false },
];

// Get default visible columns
const getDefaultColumns = () => ALL_COLUMNS.filter(c => c.default).map(c => c.id);

// Load saved columns from localStorage
const loadSavedColumns = () => {
  try {
    const saved = localStorage.getItem("vuln_visible_columns");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate that all saved columns exist
      return parsed.filter(id => ALL_COLUMNS.some(c => c.id === id));
    }
  } catch (e) {
    console.error("Error loading saved columns:", e);
  }
  return getDefaultColumns();
};

// Multi-select component for applications
const MultiSelectApps = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (app) => {
    if (selected.includes(app)) {
      onChange(selected.filter((s) => s !== app));
    } else {
      onChange([...selected, app]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-black/20 border-zinc-700 text-white hover:bg-zinc-800"
        >
          {selected.length > 0 ? (
            <span className="flex gap-1 flex-wrap">
              {selected.length <= 3 ? (
                selected.map((app) => (
                  <Badge key={app} variant="secondary" className="bg-indigo-500/20 text-indigo-300 text-xs">
                    {app}
                  </Badge>
                ))
              ) : (
                <span>{selected.length} aplicaciones seleccionadas</span>
              )}
            </span>
          ) : (
            <span className="text-zinc-500">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-zinc-900 border-zinc-700">
        <Command className="bg-zinc-900">
          <CommandInput placeholder="Buscar aplicación..." className="text-white" />
          <CommandList>
            <CommandEmpty className="text-zinc-500 text-sm py-4 text-center">No se encontraron aplicaciones</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-[200px]">
                {options.map((app) => (
                  <CommandItem
                    key={app}
                    onSelect={() => handleSelect(app)}
                    className="text-white cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(app)}
                      className="mr-2"
                    />
                    {app}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default function Vulnerabilidades() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [vulnerabilidades, setVulnerabilidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(null);
  const [search, setSearch] = useState("");
  const [filterSeveridad, setFilterSeveridad] = useState([]);
  const [filterEstatus, setFilterEstatus] = useState([]);
  const [filterInstitucion, setFilterInstitucion] = useState([]);
  const [filterAño, setFilterAño] = useState([]);
  const [filterAplicacion, setFilterAplicacion] = useState([]);
  const [filterInforme, setFilterInforme] = useState([]);
  const [filterResponsable, setFilterResponsable] = useState([]);
  const [filterDominio, setFilterDominio] = useState([]);
  const [filterControl, setFilterControl] = useState([]);
  const [filterNivelRiesgo, setFilterNivelRiesgo] = useState([]);
  const [filterProveedor, setFilterProveedor] = useState([]);
  const [filterResultadoRetest, setFilterResultadoRetest] = useState([]);
  const [filterCorreccionParcial, setFilterCorreccionParcial] = useState(false); // Filtro para mostrar solo correcciones parciales
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);
  const [viewingVuln, setViewingVuln] = useState(null);
  const [editingVuln, setEditingVuln] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [bitacoraRefreshKey, setBitacoraRefreshKey] = useState(0); // Key para forzar refresh de bitácora
  const itemsPerPage = 15;

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkAction, setBulkAction] = useState({ estatus: "", responsable: "", fecha_compromiso: "", incrementar_retest: "" });
  const [applyingBulk, setApplyingBulk] = useState(false);

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState(loadSavedColumns);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // GRC Data state
  const [dominios, setDominios] = useState([]);
  const [controles, setControles] = useState([]);
  const [catalogoRiesgos, setCatalogoRiesgos] = useState([]);
  const [selectedDominioId, setSelectedDominioId] = useState("");
  const [showRiskSearchModal, setShowRiskSearchModal] = useState(false);
  const [riskSearchTerm, setRiskSearchTerm] = useState("");
  
  // Duplicate detection state
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicatesFound, setDuplicatesFound] = useState([]);
  const [pendingFormData, setPendingFormData] = useState(null);
  
  // Tab de detalle de vulnerabilidad
  const [activeDetailTab, setActiveDetailTab] = useState("info");
  
  // Delete with justification modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Confirm changes modal (Diff)
  const [showConfirmChangesModal, setShowConfirmChangesModal] = useState(false);
  const [originalDataForDiff, setOriginalDataForDiff] = useState(null);
  const [savingChanges, setSavingChanges] = useState(false);
  
  // Import confirmation modal
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [pendingImportFormat, setPendingImportFormat] = useState(null);

  // ============ ESTADO PARA RESULTADOS POR APLICACIÓN ============
  const [showAppResultsSection, setShowAppResultsSection] = useState(false);
  const [appResultsData, setAppResultsData] = useState(null);
  const [loadingAppResults, setLoadingAppResults] = useState(false);
  const [editingAppResult, setEditingAppResult] = useState(null);
  const [showGlobalChangeWarning, setShowGlobalChangeWarning] = useState(false);
  const [pendingGlobalChange, setPendingGlobalChange] = useState(null);

  // Toggle column visibility
  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => {
      const newColumns = prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId];
      // Save to localStorage
      localStorage.setItem("vuln_visible_columns", JSON.stringify(newColumns));
      return newColumns;
    });
  };

  // Reset to default columns
  const resetColumns = () => {
    const defaults = getDefaultColumns();
    setVisibleColumns(defaults);
    localStorage.setItem("vuln_visible_columns", JSON.stringify(defaults));
  };

  // Check if column is visible
  const isColumnVisible = (columnId) => visibleColumns.includes(columnId);

  const [formData, setFormData] = useState({
    fecha_hallazgo: "",
    institucion: "",
    aplicaciones: [],
    vulnerabilidad: "",
    recomendaciones: "",
    severidad: "",
    nivel_riesgo: "",
    control_id: "",
    riesgo_id: "",
    descripcion_riesgo: "",
    responsable: "",
    fecha_compromiso: "",
    estatus: "",
    resultado_re_test: "",
    veces_en_retest: 0,
    nombre_informe_pentest: "",
    proveedor: "",
  });

  const canModify = isAdmin || canEdit("vulnerabilidades");
  const canRemove = isAdmin || canDelete("vulnerabilidades");
  const canAdd = isAdmin || canCreate("vulnerabilidades");

  // Filter controles based on selected dominio
  const filteredControles = useMemo(() => {
    if (!selectedDominioId) return []; // No mostrar controles si no hay dominio seleccionado
    return controles.filter(c => c.dominio_id === selectedDominioId);
  }, [controles, selectedDominioId]);

  // Filter riesgos for search modal
  const filteredRiesgos = useMemo(() => {
    if (!riskSearchTerm) return catalogoRiesgos;
    const term = riskSearchTerm.toLowerCase();
    return catalogoRiesgos.filter(r =>
      r.codigo_riesgo?.toLowerCase().includes(term) ||
      r.nombre_corto?.toLowerCase().includes(term) ||
      r.descripcion_completa?.toLowerCase().includes(term)
    );
  }, [catalogoRiesgos, riskSearchTerm]);

  // Get selected riesgo name
  const selectedRiesgoName = useMemo(() => {
    const r = catalogoRiesgos.find(r => r.id === formData.riesgo_id);
    return r ? `${r.codigo_riesgo} - ${r.nombre_corto}` : "";
  }, [catalogoRiesgos, formData.riesgo_id]);

  // Lookup maps for ConfirmChangesModal to resolve IDs to names
  const lookupMaps = useMemo(() => {
    const controlesMap = {};
    controles.forEach(c => {
      controlesMap[c.id] = `${c.codigo_control} - ${c.nombre_control || c.descripcion || ''}`.trim();
    });
    
    const riesgosMap = {};
    catalogoRiesgos.forEach(r => {
      riesgosMap[r.id] = `${r.codigo_riesgo} - ${r.nombre_corto}`;
    });
    
    const dominiosMap = {};
    dominios.forEach(d => {
      dominiosMap[d.id] = d.nombre_dominio;
    });
    
    return { controles: controlesMap, riesgos: riesgosMap, dominios: dominiosMap };
  }, [controles, catalogoRiesgos, dominios]);

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchGRCData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [dominiosRes, controlesRes, riesgosRes] = await Promise.all([
        axios.get(`${API}/config/dominios`, { headers }),
        axios.get(`${API}/config/controles`, { headers }),
        axios.get(`${API}/catalogo-riesgos/all`, { headers }),
      ]);

      setDominios(dominiosRes.data);
      setControles(controlesRes.data);
      setCatalogoRiesgos(riesgosRes.data);
    } catch (error) {
      console.error("Error fetching GRC data:", error);
    }
  }, []);

  const fetchVulnerabilidades = useCallback(async (resetPage = true) => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterEstatus.length > 0) filterEstatus.forEach(v => params.append("estatus", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterAño.length > 0) filterAño.forEach(v => params.append("año", v));
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      if (filterDominio.length > 0) filterDominio.forEach(v => params.append("dominio", v));
      if (filterControl.length > 0) filterControl.forEach(v => params.append("control", v));
      if (filterNivelRiesgo.length > 0) filterNivelRiesgo.forEach(v => params.append("nivel_riesgo", v));
      if (filterProveedor.length > 0) filterProveedor.forEach(v => params.append("proveedor", v));
      if (filterResultadoRetest.length > 0) filterResultadoRetest.forEach(v => params.append("resultado_retest", v));
      if (filterCorreccionParcial) params.append("correccion_parcial", "true");

      const response = await axios.get(`${API}/vulnerabilidades?${params.toString()}`);
      setVulnerabilidades(response.data);
      if (resetPage) {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error("Error fetching vulnerabilidades:", error);
      toast.error("Error al cargar vulnerabilidades");
    } finally {
      setLoading(false);
    }
  }, [search, filterSeveridad, filterEstatus, filterInstitucion, filterAño, filterAplicacion, filterInforme, filterResponsable, filterDominio, filterControl, filterNivelRiesgo, filterProveedor, filterResultadoRetest, filterCorreccionParcial]);

  useEffect(() => {
    fetchOptions();
    fetchGRCData();
  }, [fetchGRCData]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchVulnerabilidades();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchVulnerabilidades]);

  const handleView = (vuln) => {
    // Buscar la vulnerabilidad más reciente de la lista para tener datos actualizados
    const vulnActualizada = vulnerabilidades.find(v => v.id === vuln.id) || vuln;
    setViewingVuln(vulnActualizada);
    // Siempre incrementar el key al abrir el modal para garantizar datos frescos en la bitácora
    setBitacoraRefreshKey(prev => prev + 1);
    setShowViewModal(true);
    // Resetear estado de resultados por aplicación
    setShowAppResultsSection(false);
    setAppResultsData(null);
    setEditingAppResult(null);
  };

  // ============ FUNCIONES PARA RESULTADOS POR APLICACIÓN ============
  
  const fetchAppResults = async (vulnId) => {
    if (!vulnId) return;
    setLoadingAppResults(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/vulnerabilidades/${vulnId}/aplicaciones-resultados`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppResultsData(response.data);
    } catch (error) {
      console.error("Error al cargar resultados por aplicación:", error);
      toast.error("Error al cargar resultados por aplicación");
    } finally {
      setLoadingAppResults(false);
    }
  };

  const handleToggleAppResults = () => {
    if (!showAppResultsSection && viewingVuln) {
      fetchAppResults(viewingVuln.id);
    }
    setShowAppResultsSection(!showAppResultsSection);
  };

  const handleEditAppResult = (app) => {
    setEditingAppResult({
      aplicacion: app.aplicacion,
      resultado_re_test: app.resultado_re_test || "",
      fecha_correccion: app.fecha_correccion || "",
      notas: app.notas || ""
    });
  };

  const handleSaveAppResult = async () => {
    if (!editingAppResult || !viewingVuln) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${API}/vulnerabilidades/${viewingVuln.id}/aplicacion-resultado`,
        editingAppResult,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Resultado actualizado para ${editingAppResult.aplicacion}`);
      
      // Actualizar datos locales
      setAppResultsData(prev => ({
        ...prev,
        ...response.data.info_normalizacion,
        aplicaciones: response.data.info_normalizacion.aplicaciones,
        estatus_global: response.data.vulnerabilidad.estatus,
        fecha_cierre_global: response.data.vulnerabilidad.fecha_cierre
      }));
      
      // Actualizar la vulnerabilidad en la lista
      const vulnActualizada = response.data.vulnerabilidad;
      setVulnerabilidades(prev => prev.map(v => 
        v.id === vulnActualizada.id ? vulnActualizada : v
      ));
      setViewingVuln(vulnActualizada);
      
      // Cerrar editor y refrescar bitácora
      setEditingAppResult(null);
      setBitacoraRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error("Error al guardar resultado:", error);
      toast.error(error.response?.data?.detail || "Error al guardar resultado");
    }
  };

  const handleCancelEditAppResult = () => {
    setEditingAppResult(null);
  };

  // Verificar si hay resultados personalizados antes de cambiar el resultado global
  const checkForPersonalizedResults = async (vulnId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/vulnerabilidades/${vulnId}/verificar-resultados-personalizados`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error("Error al verificar resultados personalizados:", error);
      return null;
    }
  };

  const handleGlobalResultChange = async (newResult) => {
    if (!editingVuln) return;
    
    // Verificar si hay resultados personalizados
    const checkResult = await checkForPersonalizedResults(editingVuln.id);
    
    if (checkResult?.tiene_resultados_personalizados || checkResult?.hay_diferencias_entre_aplicaciones) {
      // Mostrar advertencia y guardar cambio pendiente
      setPendingGlobalChange({
        resultado: newResult,
        infoPersonalizados: checkResult
      });
      setShowGlobalChangeWarning(true);
    } else {
      // Sin resultados personalizados, aplicar cambio normalmente
      setFormData(prev => ({ ...prev, resultado_re_test: newResult }));
    }
  };

  const handleConfirmGlobalChange = async (sobrescribirTodos) => {
    if (!pendingGlobalChange || !editingVuln) return;
    
    try {
      if (sobrescribirTodos) {
        const token = localStorage.getItem("token");
        // Sincronizar a todas las aplicaciones
        await axios.put(
          `${API}/vulnerabilidades/${editingVuln.id}/sincronizar-resultado-global`,
          { 
            resultado_re_test: pendingGlobalChange.resultado,
            sobrescribir_personalizados: true
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Resultado aplicado a todas las aplicaciones");
      }
      
      // Actualizar formData
      setFormData(prev => ({ ...prev, resultado_re_test: pendingGlobalChange.resultado }));
      
    } catch (error) {
      console.error("Error al sincronizar resultado:", error);
      toast.error("Error al actualizar resultado global");
    } finally {
      setShowGlobalChangeWarning(false);
      setPendingGlobalChange(null);
    }
  };

  const handleCancelGlobalChange = () => {
    setShowGlobalChangeWarning(false);
    setPendingGlobalChange(null);
  };

  const handleOpenModal = (vuln = null) => {
    if (vuln) {
      // Guardar copia profunda de datos originales para comparación posterior
      setEditingVuln(JSON.parse(JSON.stringify(vuln)));
      // Find dominio_id from control if exists
      const control = controles.find(c => c.id === vuln.control_id);
      const dominioId = control?.dominio_id || "";
      setSelectedDominioId(dominioId);
      setFormData({ 
        ...vuln,
        aplicaciones: vuln.aplicaciones || [],
        control_id: vuln.control_id || "",
        riesgo_id: vuln.riesgo_id || "",
        dominio_id: dominioId,
      });
    } else {
      setEditingVuln(null);
      setSelectedDominioId("");
      setFormData({
        fecha_hallazgo: "",
        institucion: "",
        aplicaciones: [],
        vulnerabilidad: "",
        recomendaciones: "",
        severidad: "",
        nivel_riesgo: "",
        control_id: "",
        riesgo_id: "",
        dominio_id: "",
        descripcion_riesgo: "",
        responsable: "",
        fecha_compromiso: "",
        estatus: "",
        resultado_re_test: "",
        veces_en_retest: 0,
        nombre_informe_pentest: "",
        proveedor: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDominioId("");
    setEditingVuln(null);
  };

  // Check for duplicates before submitting
  const checkDuplicates = async (data, excludeId = null) => {
    try {
      const params = new URLSearchParams();
      params.append("vulnerabilidad", data.vulnerabilidad || "");
      params.append("aplicaciones", data.aplicaciones || "");
      params.append("institucion", data.institucion || "");
      if (excludeId) params.append("exclude_id", excludeId);
      
      const response = await axios.post(`${API}/vulnerabilidades/verificar-duplicado?${params}`);
      return response.data;
    } catch (error) {
      console.error("Error checking duplicates:", error);
      return { has_duplicates: false, duplicates: [] };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // For new records, check for duplicates first
    if (!editingVuln) {
      const duplicateCheck = await checkDuplicates(formData);
      if (duplicateCheck.has_duplicates) {
        setDuplicatesFound(duplicateCheck.duplicates);
        setPendingFormData(formData);
        setShowDuplicateWarning(true);
        return;
      }
    }
    
    await submitForm(formData, editingVuln?.id);
  };

  const submitForm = async (data, editId = null) => {
    try {
      if (editId) {
        await axios.put(`${API}/vulnerabilidades/${editId}`, data);
        toast.success("Vulnerabilidad actualizada exitosamente");
      } else {
        await axios.post(`${API}/vulnerabilidades`, data);
        toast.success("Vulnerabilidad creada exitosamente");
      }
      handleCloseModal();
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Error al guardar la vulnerabilidad");
    }
  };

  const handleConfirmDuplicate = async () => {
    // User confirmed to create despite duplicate warning
    if (pendingFormData) {
      await submitForm(pendingFormData);
    }
    setShowDuplicateWarning(false);
    setDuplicatesFound([]);
    setPendingFormData(null);
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateWarning(false);
    setDuplicatesFound([]);
    setPendingFormData(null);
  };

  // Nueva función para abrir el modal de eliminación con justificación
  const handleOpenDeleteModal = (vuln) => {
    setDeletingItem(vuln);
    setShowDeleteModal(true);
  };

  // Nueva función para confirmar eliminación con justificación
  const handleConfirmDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/vulnerabilidades/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Vulnerabilidad eliminada exitosamente");
      setShowDeleteModal(false);
      setDeletingItem(null);
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar la vulnerabilidad");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Función para abrir modal de confirmación de cambios (Diff)
  const handlePreSave = () => {
    // Guardar datos originales para comparación
    if (editingVuln) {
      // Find original dominio_id from control if exists
      const control = controles.find(c => c.id === editingVuln.control_id);
      const originalDominioId = control?.dominio_id || "";
      setOriginalDataForDiff({...editingVuln, dominio_id: originalDominioId});
    }
    setShowConfirmChangesModal(true);
  };

  // Función para confirmar y guardar cambios
  const handleConfirmSave = async () => {
    setSavingChanges(true);
    try {
      if (editingVuln) {
        await axios.put(`${API}/vulnerabilidades/${editingVuln.id}`, formData);
        toast.success("Vulnerabilidad actualizada exitosamente");
        // Incrementar key para forzar refresh de bitácora cuando se abra
        setBitacoraRefreshKey(prev => prev + 1);
      } else {
        await axios.post(`${API}/vulnerabilidades`, formData);
        toast.success("Vulnerabilidad creada exitosamente");
      }
      setShowConfirmChangesModal(false);
      setShowModal(false);
      setEditingVuln(null);
      setFormData({});
      // No resetear página al actualizar, sí al crear
      fetchVulnerabilidades(!editingVuln);
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(error.response?.data?.detail || "Error al guardar la vulnerabilidad");
    } finally {
      setSavingChanges(false);
    }
  };

  const handleExport = async (format) => {
    try {
      // Build query params with current filters
      const params = new URLSearchParams();
      
      // Add search filter
      if (search) params.append("search", search);
      
      // Add year filter (multi-select)
      if (filterAño.length > 0) filterAño.forEach(v => params.append("año", v));
      
      // Add multi-select filters
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterEstatus.length > 0) filterEstatus.forEach(v => params.append("estatus", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      if (filterDominio.length > 0) filterDominio.forEach(v => params.append("dominio", v));
      if (filterControl.length > 0) filterControl.forEach(v => params.append("control", v));
      if (filterNivelRiesgo.length > 0) filterNivelRiesgo.forEach(v => params.append("nivel_riesgo", v));
      if (filterProveedor.length > 0) filterProveedor.forEach(v => params.append("proveedor", v));
      
      // Add visible columns
      if (visibleColumns.length > 0) {
        params.append("columnas", visibleColumns.join(","));
      }
      
      const response = await axios.get(`${API}/export/${format}?${params.toString()}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `vulnerabilidades.${format === "csv" ? "csv" : "xlsx"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Exportado a ${format.toUpperCase()} exitosamente`);
    } catch (error) {
      console.error("Error exporting:", error);
      if (error.response?.status === 404) {
        toast.error("No hay datos para exportar con los filtros seleccionados");
      } else {
        toast.error("Error al exportar");
      }
    }
  };

  // Handler para mostrar confirmación antes de importar
  const handleImportClick = (e, format) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPendingImportFile(file);
    setPendingImportFormat(format);
    setShowImportConfirmModal(true);
    e.target.value = ""; // Reset input
  };

  // Handler real de importación (después de confirmación)
  const handleImport = async () => {
    if (!pendingImportFile || !pendingImportFormat) return;

    setUploading(true);
    setShowImportConfirmModal(false);
    const formDataUpload = new FormData();
    formDataUpload.append("file", pendingImportFile);

    try {
      const response = await axios.post(`${API}/import/${pendingImportFormat}`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(response.data.message);
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error(error.response?.data?.detail || "Error al importar archivo");
    } finally {
      setUploading(false);
      setPendingImportFile(null);
      setPendingImportFormat(null);
    }
  };
  
  // Cancelar importación
  const cancelImport = () => {
    setShowImportConfirmModal(false);
    setPendingImportFile(null);
    setPendingImportFormat(null);
  };

  // Helper to display applications
  const formatAplicaciones = (vuln) => {
    const apps = vuln.aplicaciones || [];
    if (apps.length === 0) return vuln.aplicacion || "-";
    return apps.join(" | ");
  };

  // Bulk selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedData.map(v => v.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    
    // Check if at least one field is set
    if (!bulkAction.estatus && bulkAction.responsable === undefined && bulkAction.fecha_compromiso === undefined && !bulkAction.incrementar_retest) {
      toast.error("Selecciona al menos un campo para actualizar");
      return;
    }
    
    setApplyingBulk(true);
    try {
      const payload = { ids: selectedIds };
      if (bulkAction.estatus) payload.estatus = bulkAction.estatus;
      if (bulkAction.responsable !== undefined && bulkAction.responsable !== "") payload.responsable = bulkAction.responsable;
      if (bulkAction.fecha_compromiso !== undefined && bulkAction.fecha_compromiso !== "") payload.fecha_compromiso = bulkAction.fecha_compromiso;
      if (bulkAction.incrementar_retest && parseInt(bulkAction.incrementar_retest) > 0) {
        payload.incrementar_retest = parseInt(bulkAction.incrementar_retest);
      }
      
      const response = await axios.post(`${API}/vulnerabilidades/bulk-update`, payload);
      toast.success(response.data.message);
      setShowBulkModal(false);
      setSelectedIds([]);
      setBulkAction({ estatus: "", responsable: "", fecha_compromiso: "", incrementar_retest: "" });
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error(error.response?.data?.detail || "Error al actualizar");
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    setApplyingBulk(true);
    try {
      const response = await axios.post(`${API}/vulnerabilidades/bulk-delete`, { ids: selectedIds });
      toast.success(response.data.message);
      setShowBulkDeleteConfirm(false);
      setSelectedIds([]);
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar");
    } finally {
      setApplyingBulk(false);
    }
  };

  const paginatedData = vulnerabilidades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(vulnerabilidades.length / itemsPerPage);

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-96 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="vulnerabilidades-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Gestión de Vulnerabilidades
          </h1>
          <p className="text-zinc-500 mt-1">
            {vulnerabilidades.length} registros encontrados
            {(filterSeveridad.length > 0 || filterEstatus.length > 0 || filterInstitucion.length > 0 || filterAplicacion.length > 0 || filterInforme.length > 0 || filterAño.length > 0 || filterDominio.length > 0 || filterControl.length > 0) && (
              <span className="ml-2 text-indigo-400">(filtrado)</span>
            )}
          </p>
          {(filterSeveridad.length > 0 || filterEstatus.length > 0) && (
            <p className="text-xs text-zinc-400 mt-0.5">
              {filterSeveridad.length > 0 && <span>Severidad: <span className="text-white">{filterSeveridad.join(", ")}</span></span>}
              {filterSeveridad.length > 0 && filterEstatus.length > 0 && <span className="mx-2">|</span>}
              {filterEstatus.length > 0 && <span>Estatus: <span className="text-white">{filterEstatus.join(", ")}</span></span>}
            </p>
          )}
        </div>
        {canAdd && (
          <div className="flex gap-2">
            <Button
              onClick={() => setShowBulkEntryModal(true)}
              variant="outline"
              className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
              data-testid="bulk-entry-btn"
            >
              <Layers className="w-4 h-4 mr-2" />
              Entrada Masiva
            </Button>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
              data-testid="add-vuln-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Vulnerabilidad
            </Button>
          </div>
        )}
      </div>

      {/* Filters & Actions */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search - Full width row */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
              <Input
                placeholder="Buscar por vulnerabilidad, aplicación, responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus:text-white w-full"
                style={{ color: 'white' }}
                data-testid="search-input"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-2">
              <MultiSelectFilter
                options={options?.años?.map(String) || []}
                selected={filterAño}
                onChange={setFilterAño}
                placeholder="Año"
                searchPlaceholder="Buscar año..."
                allLabel="Todos los años"
                data-testid="filter-año"
              />

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
                options={options?.estatus || []}
                selected={filterEstatus}
                onChange={setFilterEstatus}
                placeholder="Estatus"
                searchPlaceholder="Buscar estatus..."
                allLabel="Todos los estatus"
                data-testid="filter-estatus"
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

              <MultiSelectFilter
                options={options?.responsables?.map(r => r.nombre) || []}
                selected={filterResponsable}
                onChange={setFilterResponsable}
                placeholder="Responsable"
                searchPlaceholder="Buscar responsable..."
                allLabel="Todos los responsables"
                data-testid="filter-responsable"
              />

              <MultiSelectFilter
                options={dominios?.map(d => d.nombre_dominio) || []}
                selected={filterDominio}
                onChange={setFilterDominio}
                placeholder="Dominio"
                searchPlaceholder="Buscar dominio..."
                allLabel="Todos los dominios"
                data-testid="filter-dominio"
              />

              <MultiSelectFilter
                options={controles?.map(c => c.codigo_control) || []}
                selected={filterControl}
                onChange={setFilterControl}
                placeholder="Control"
                searchPlaceholder="Buscar control..."
                allLabel="Todos los controles"
                data-testid="filter-control"
              />

              <MultiSelectFilter
                options={NIVEL_RIESGO_OPTIONS}
                selected={filterNivelRiesgo}
                onChange={setFilterNivelRiesgo}
                placeholder="Nivel Riesgo"
                searchPlaceholder="Buscar nivel..."
                allLabel="Todos los niveles"
                data-testid="filter-nivel-riesgo"
              />

              <MultiSelectFilter
                options={options?.proveedores || []}
                selected={filterProveedor}
                onChange={setFilterProveedor}
                placeholder="Proveedor"
                searchPlaceholder="Buscar proveedor..."
                allLabel="Todos los proveedores"
                data-testid="filter-proveedor"
              />

              <MultiSelectFilter
                options={options?.resultado_retest || ["Corregido", "Pendiente", "Impedimento", "Vulnerable", "Desestimado", "En Retest", "Nota de Seguimiento"]}
                selected={filterResultadoRetest}
                onChange={setFilterResultadoRetest}
                placeholder="Resultado Retest"
                searchPlaceholder="Buscar resultado..."
                allLabel="Todos los resultados"
                data-testid="filter-resultado-retest"
              />

              {/* Filtro de Corrección Parcial */}
              <div className="flex items-center gap-2">
                <label 
                  htmlFor="filter-correccion-parcial"
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    filterCorreccionParcial 
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    id="filter-correccion-parcial"
                    checked={filterCorreccionParcial}
                    onChange={(e) => setFilterCorreccionParcial(e.target.checked)}
                    className="sr-only"
                    data-testid="filter-correccion-parcial"
                  />
                  <span className="text-sm whitespace-nowrap">
                    {filterCorreccionParcial ? "✓ " : ""}Corrección Parcial
                  </span>
                </label>
              </div>

              {/* Import/Export */}
              <div className="flex gap-2 ml-auto">
                {isAdmin && (
                  <>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleImportClick(e, "excel")}
                        disabled={uploading}
                      />
                      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" asChild>
                        <span data-testid="import-excel-btn">
                          <Upload className="w-4 h-4 mr-1" />
                          Excel
                        </span>
                      </Button>
                    </label>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => handleImportClick(e, "csv")}
                        disabled={uploading}
                      />
                      <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" asChild>
                        <span data-testid="import-csv-btn">
                          <Upload className="w-4 h-4 mr-1" />
                          CSV
                        </span>
                      </Button>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10"
                      onClick={() => setShowPdfImport(true)}
                      data-testid="import-pdf-btn"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={() => handleExport("excel")}
                  data-testid="export-excel-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Exportar
                </Button>

                {/* Column Selector */}
                <Popover open={showColumnSelector} onOpenChange={setShowColumnSelector}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      data-testid="column-selector-btn"
                    >
                      <Settings2 className="w-4 h-4 mr-1" />
                      Columnas
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0 bg-zinc-900 border-zinc-700" align="end">
                    <div className="p-3 border-b border-zinc-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Columnas visibles</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300"
                          onClick={resetColumns}
                        >
                          Restablecer
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="p-2 space-y-1">
                        {ALL_COLUMNS.map((col) => (
                          <div
                            key={col.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                            onClick={() => toggleColumn(col.id)}
                          >
                            <Checkbox
                              checked={isColumnVisible(col.id)}
                              onCheckedChange={() => toggleColumn(col.id)}
                              className="border-zinc-600"
                            />
                            <span className="text-sm text-zinc-300">{col.label}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <Card className="bg-indigo-950/50 border-indigo-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                <span className="text-indigo-300 font-medium">
                  {selectedIds.length} vulnerabilidad{selectedIds.length > 1 ? "es" : ""} seleccionada{selectedIds.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setShowBulkModal(true)}
                  data-testid="bulk-action-btn"
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  data-testid="bulk-delete-btn"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={clearSelection}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="vuln-table">
              <TableHeader>
                <TableRow className="border-zinc-700 hover:bg-transparent">
                  {canModify && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={paginatedData.length > 0 && selectedIds.length === paginatedData.length}
                        onCheckedChange={toggleSelectAll}
                        className="border-zinc-600"
                        data-testid="select-all-checkbox"
                      />
                    </TableHead>
                  )}
                  {isColumnVisible("codigo") && <TableHead className="text-zinc-400">Código</TableHead>}
                  {isColumnVisible("fecha_hallazgo") && <TableHead className="text-zinc-400">Fecha</TableHead>}
                  {isColumnVisible("institucion") && <TableHead className="text-zinc-400">Institución</TableHead>}
                  {isColumnVisible("aplicaciones") && <TableHead className="text-zinc-400">Aplicaciones</TableHead>}
                  {isColumnVisible("vulnerabilidad") && <TableHead className="text-zinc-400 min-w-[200px]">Vulnerabilidad</TableHead>}
                  {isColumnVisible("descripcion_riesgo") && <TableHead className="text-zinc-400 min-w-[180px]">Desc. Riesgo</TableHead>}
                  {isColumnVisible("recomendaciones") && <TableHead className="text-zinc-400 min-w-[200px]">Recomendaciones</TableHead>}
                  {isColumnVisible("severidad") && <TableHead className="text-zinc-400">Severidad</TableHead>}
                  {isColumnVisible("nivel_riesgo") && <TableHead className="text-zinc-400">Nivel Riesgo</TableHead>}
                  {isColumnVisible("estatus") && <TableHead className="text-zinc-400">Estatus</TableHead>}
                  {isColumnVisible("responsable") && <TableHead className="text-zinc-400">Responsable</TableHead>}
                  {isColumnVisible("fecha_compromiso") && <TableHead className="text-zinc-400">F. Compromiso</TableHead>}
                  {isColumnVisible("dominio") && <TableHead className="text-zinc-400">Dominio</TableHead>}
                  {isColumnVisible("control_asociado") && <TableHead className="text-zinc-400">Control</TableHead>}
                  {isColumnVisible("resultado_re_test") && <TableHead className="text-zinc-400">Res. Retest</TableHead>}
                  {isColumnVisible("veces_en_retest") && <TableHead className="text-zinc-400">Veces Retest</TableHead>}
                  {isColumnVisible("nombre_informe_pentest") && <TableHead className="text-zinc-400">Informe</TableHead>}
                  {isColumnVisible("proveedor") && <TableHead className="text-zinc-400">Proveedor</TableHead>}
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.length + (canModify ? 2 : 1)} className="text-center py-12 text-zinc-500">
                      No se encontraron vulnerabilidades
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((vuln) => (
                    <TableRow
                      key={vuln.id}
                      className={`border-zinc-800 table-row-hover ${vuln.severidad === "Critica" ? "critical-indicator" : ""} ${selectedIds.includes(vuln.id) ? "bg-indigo-950/30" : ""}`}
                      data-testid={`vuln-row-${vuln.id}`}
                    >
                      {canModify && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(vuln.id)}
                            onCheckedChange={() => toggleSelect(vuln.id)}
                            className="border-zinc-600"
                            data-testid={`select-checkbox-${vuln.id}`}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible("codigo") && (
                        <TableCell className="text-zinc-300 font-mono text-xs">
                          {vuln.codigo || "-"}
                        </TableCell>
                      )}
                      {isColumnVisible("fecha_hallazgo") && (
                        <TableCell className="text-zinc-300 font-mono text-xs">
                          {vuln.fecha_hallazgo || "-"}
                        </TableCell>
                      )}
                      {isColumnVisible("institucion") && (
                        <TableCell className="text-zinc-300">{vuln.institucion || "-"}</TableCell>
                      )}
                      {isColumnVisible("aplicaciones") && (
                        <TableCell className="text-zinc-300">
                          <span className="whitespace-normal break-words" title={formatAplicaciones(vuln)}>
                            {formatAplicaciones(vuln)}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("vulnerabilidad") && (
                        <TableCell className="text-zinc-100">
                          <span className="whitespace-normal break-words">
                            {vuln.vulnerabilidad || "-"}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("descripcion_riesgo") && (
                        <TableCell className="text-zinc-300">
                          <span className="whitespace-normal break-words text-sm">
                            {vuln.descripcion_riesgo || "-"}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("recomendaciones") && (
                        <TableCell className="text-zinc-300">
                          <span className="whitespace-normal break-words text-sm">
                            {vuln.recomendaciones || "-"}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("severidad") && (
                        <TableCell>
                          <SeverityBadge severity={vuln.severidad} />
                        </TableCell>
                      )}
                      {isColumnVisible("nivel_riesgo") && (
                        <TableCell>
                          <NivelRiesgoBadge nivel={vuln.nivel_riesgo} />
                        </TableCell>
                      )}
                      {isColumnVisible("estatus") && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusBadge status={vuln.estatus} />
                            {vuln.es_correccion_parcial && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5 cursor-help"
                                    >
                                      Parcial
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-zinc-800 border-zinc-700 max-w-xs">
                                    <p className="text-xs">
                                      <span className="text-amber-400 font-medium">Corrección Parcial:</span>{" "}
                                      {vuln.aplicaciones_corregidas || 0} de {vuln.aplicaciones_total || vuln.aplicaciones?.length || 0} apps corregidas
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isColumnVisible("responsable") && (
                        <TableCell className="text-zinc-300">{vuln.responsable || "-"}</TableCell>
                      )}
                      {isColumnVisible("fecha_compromiso") && (
                        <TableCell className="text-zinc-300 font-mono text-xs">{vuln.fecha_compromiso || "-"}</TableCell>
                      )}
                      {isColumnVisible("dominio") && (
                        <TableCell className="text-zinc-300 text-sm">{vuln.nombre_dominio || "-"}</TableCell>
                      )}
                      {isColumnVisible("control_asociado") && (
                        <TableCell className="text-zinc-300 text-sm">{vuln.codigo_control || "-"}</TableCell>
                      )}
                      {isColumnVisible("resultado_re_test") && (
                        <TableCell className="text-zinc-300">{vuln.resultado_re_test || "-"}</TableCell>
                      )}
                      {isColumnVisible("veces_en_retest") && (
                        <TableCell className="text-zinc-300 text-center">{vuln.veces_en_retest || 0}</TableCell>
                      )}
                      {isColumnVisible("nombre_informe_pentest") && (
                        <TableCell className="text-zinc-300">
                          <span className="whitespace-normal break-words" title={vuln.nombre_informe_pentest}>
                            {vuln.nombre_informe_pentest || "-"}
                          </span>
                        </TableCell>
                      )}
                      {isColumnVisible("proveedor") && (
                        <TableCell className="text-zinc-300">{vuln.proveedor || "-"}</TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                            onClick={() => handleView(vuln)}
                            data-testid={`view-btn-${vuln.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
                              onClick={() => handleOpenModal(vuln)}
                              data-testid={`edit-btn-${vuln.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => handleOpenDeleteModal(vuln)}
                              data-testid={`delete-btn-${vuln.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
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
              <div className="flex items-center gap-2">
                {/* First page button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="border-zinc-700 text-zinc-300"
                  title="Primera página"
                  data-testid="first-page-btn"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="border-zinc-700 text-zinc-300"
                  data-testid="prev-page-btn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {/* Page jump input */}
                <div className="flex items-center gap-1">
                  <span className="text-sm text-zinc-500">Ir a:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    className="w-16 h-8 bg-zinc-800 border-zinc-700 text-white text-center text-sm"
                    data-testid="page-jump-input"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="border-zinc-700 text-zinc-300"
                  data-testid="next-page-btn"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                {/* Last page button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="border-zinc-700 text-zinc-300"
                  title="Última página"
                  data-testid="last-page-btn"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={(open) => {
        setShowViewModal(open);
        if (!open) {
          setActiveDetailTab("info");
        }
      }}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="w-5 h-5 text-cyan-500" />
              Detalle de Vulnerabilidad
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {viewingVuln && (
              <div className="space-y-4">
                {/* Header Info */}
                <div className="flex flex-wrap gap-3 items-center">
                  <SeverityBadge severity={viewingVuln.severidad} />
                  <NivelRiesgoBadge nivel={viewingVuln.nivel_riesgo} />
                  <StatusBadge status={viewingVuln.estatus} />
                  {viewingVuln.es_correccion_parcial && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-help"
                          >
                            Corrección Parcial
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="bg-zinc-800 border-zinc-700 max-w-xs">
                          <p className="text-xs">
                            <span className="text-amber-400 font-medium">Corrección Parcial:</span>{" "}
                            {viewingVuln.aplicaciones_corregidas || 0} de {viewingVuln.aplicaciones_total || viewingVuln.aplicaciones?.length || 0} aplicaciones corregidas
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Tabs para Info/Bitácora */}
                <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                    <TabsTrigger value="info" className="data-[state=active]:bg-zinc-700">
                      <FileText className="w-4 h-4 mr-2" />
                      Información
                    </TabsTrigger>
                    <TabsTrigger value="bitacora" className="data-[state=active]:bg-zinc-700">
                      <History className="w-4 h-4 mr-2" />
                      Bitácora de Seguimiento
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="mt-4 space-y-4">
                    {/* Grid Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Hallazgo</p>
                        <p className="text-white font-mono">{viewingVuln.fecha_hallazgo || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Institución</p>
                        <p className="text-white">{viewingVuln.institucion || "-"}</p>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Aplicaciones</p>
                        <div className="flex flex-wrap gap-1">
                          {(viewingVuln.aplicaciones || []).length > 0 ? (
                            viewingVuln.aplicaciones.map((app) => (
                              <Badge key={app} variant="secondary" className="bg-indigo-500/20 text-indigo-300">
                                {app}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-white">{viewingVuln.aplicacion || "-"}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Responsable</p>
                        <p className="text-white">{viewingVuln.responsable || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Fecha Compromiso</p>
                        <p className="text-white font-mono">{viewingVuln.fecha_compromiso || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Resultado Re Test</p>
                        <p className="text-white">{viewingVuln.resultado_re_test || "-"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Veces en Retest</p>
                        <p className="text-white font-mono">{viewingVuln.veces_en_retest || 0}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Proveedor</p>
                        <p className="text-white">{viewingVuln.proveedor || "-"}</p>
                      </div>
                    </div>

                    {/* Full Width Fields */}
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

                    {/* GRC Section - Al final del formulario */}
                    {(viewingVuln.control_id || viewingVuln.riesgo_id) && (
                      <div className="p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                        <p className="text-xs text-cyan-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Vinculación GRC
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs text-zinc-500">Control Asociado</p>
                            <p className="text-white">
                              {(() => {
                                const control = controles.find(c => c.id === viewingVuln.control_id);
                                return control ? `${control.codigo_control || ""} ${control.nombre_control}` : "-";
                              })()}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-zinc-500">Riesgo del Catálogo</p>
                            <p className="text-white">
                              {(() => {
                                const riesgo = catalogoRiesgos.find(r => r.id === viewingVuln.riesgo_id);
                                return riesgo ? (
                                  <span className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                                      {riesgo.codigo_riesgo}
                                    </Badge>
                                    {riesgo.nombre_corto}
                                  </span>
                                ) : "-";
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ============ SECCIÓN RESULTADO POR APLICACIÓN ============ */}
                    {(viewingVuln.aplicaciones?.length > 1 || viewingVuln.aplicaciones_resultados?.length > 0) && (
                      <div className="border border-zinc-700 rounded-lg overflow-hidden">
                        {/* Header colapsable */}
                        <button
                          onClick={handleToggleAppResults}
                          className="w-full p-3 bg-zinc-800/50 flex items-center justify-between hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">Resultado por Aplicación</span>
                            <Badge variant="outline" className="text-xs bg-zinc-700/50 text-zinc-300 border-zinc-600">
                              {viewingVuln.aplicaciones?.length || 0} apps
                            </Badge>
                            {/* Indicador de corrección parcial */}
                            {appResultsData?.es_correccion_parcial && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs animate-pulse">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Corrección Parcial - {appResultsData.aplicaciones_corregidas} de {appResultsData.aplicaciones_total}
                              </Badge>
                            )}
                          </div>
                          {showAppResultsSection ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>

                        {/* Contenido expandible */}
                        {showAppResultsSection && (
                          <div className="p-3 space-y-3 bg-zinc-900/30">
                            {loadingAppResults ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                <span className="ml-2 text-zinc-400">Cargando resultados...</span>
                              </div>
                            ) : appResultsData ? (
                              <>
                                {/* Resumen */}
                                <div className="flex items-center gap-4 text-sm text-zinc-400 mb-2">
                                  <span>
                                    <span className="text-green-400 font-medium">{appResultsData.aplicaciones_corregidas}</span> corregidas
                                  </span>
                                  <span>•</span>
                                  <span>
                                    <span className="text-zinc-300 font-medium">{appResultsData.aplicaciones_total - appResultsData.aplicaciones_corregidas}</span> pendientes
                                  </span>
                                  {appResultsData.tiene_resultados_personalizados && (
                                    <>
                                      <span>•</span>
                                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30">
                                        Resultados Personalizados
                                      </Badge>
                                    </>
                                  )}
                                </div>

                                {/* Tabla de aplicaciones - Solo lectura en modo visualización */}
                                <div className="rounded-lg border border-zinc-700 overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-zinc-800/50 border-zinc-700">
                                        <TableHead className="text-zinc-400 text-xs">Aplicación</TableHead>
                                        <TableHead className="text-zinc-400 text-xs">Resultado Re-Test</TableHead>
                                        <TableHead className="text-zinc-400 text-xs">Fecha Corrección</TableHead>
                                        <TableHead className="text-zinc-400 text-xs">Notas</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {appResultsData.aplicaciones?.map((app) => (
                                        <TableRow key={app.aplicacion} className="border-zinc-700 hover:bg-zinc-800/30">
                                          <TableCell className="font-medium text-white">
                                            <div className="flex items-center gap-2">
                                              {app.aplicacion}
                                              {!app.es_personalizado && (
                                                <Badge variant="outline" className="text-xs bg-zinc-700/50 text-zinc-400 border-zinc-600">
                                                  heredado
                                                </Badge>
                                              )}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                              app.resultado_re_test === "Corregido" ? "bg-green-500/20 text-green-300" :
                                              app.resultado_re_test === "Vulnerable" ? "bg-red-500/20 text-red-300" :
                                              app.resultado_re_test === "Desestimado" ? "bg-gray-500/20 text-gray-300" :
                                              app.resultado_re_test === "Impedimento" ? "bg-orange-500/20 text-orange-300" :
                                              app.resultado_re_test === "En Retest" ? "bg-blue-500/20 text-blue-300" :
                                              "bg-zinc-500/20 text-zinc-300"
                                            }`}>
                                              {app.resultado_re_test || "Sin resultado"}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <span className="text-zinc-300 text-xs font-mono">
                                              {app.fecha_correccion || "-"}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <span className="text-zinc-400 text-xs truncate max-w-[200px] block" title={app.notas}>
                                              {app.notas || "-"}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Nota informativa */}
                                <p className="text-xs text-zinc-500 mt-2 flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  Los resultados marcados como &quot;heredado&quot; utilizan el resultado global. 
                                  Para modificar resultados por aplicación, use el botón &quot;Editar&quot; o el formulario de Seguimiento en la pestaña Bitácora.
                                </p>
                              </>
                            ) : (
                              <p className="text-center text-zinc-500 py-4">No hay datos disponibles</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="bitacora" className="mt-4">
                    {/* Timeline con formulario integrado para crear seguimiento */}
                    {/* Key incluye refreshKey para forzar refresh después de ediciones */}
                    <TimelineSeguimiento 
                      key={`timeline-${viewingVuln.id}-${bitacoraRefreshKey}`}
                      vulnId={viewingVuln.id} 
                      allowCreate={canModify}
                      currentFechaCompromiso={viewingVuln.fecha_compromiso}
                      aplicaciones={viewingVuln.aplicaciones || []}
                      onSeguimientoCreated={(updatedVuln) => {
                        setViewingVuln(updatedVuln);
                        fetchVulnerabilidades(false);
                        setBitacoraRefreshKey(prev => prev + 1);
                      }}
                    />
                  </TabsContent>
                </Tabs>
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
            {canModify && (
              <Button
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenModal(viewingVuln);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingVuln ? "Editar Vulnerabilidad" : "Nueva Vulnerabilidad"}
            </DialogTitle>
            <p className="text-sm text-zinc-500">
              Complete los campos del formulario para {editingVuln ? "actualizar" : "registrar"} la vulnerabilidad
            </p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <form id="vuln-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Código</Label>
                  <Input
                    type="text"
                    value={formData.codigo || ""}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white"
                    placeholder="Ej: VULN-001"
                    data-testid="input-codigo"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Fecha Hallazgo</Label>
                  <Input
                    type="date"
                    value={formData.fecha_hallazgo || ""}
                    onChange={(e) => setFormData({ ...formData, fecha_hallazgo: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-fecha-hallazgo"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Institución</Label>
                  <Select
                    value={formData.institucion || ""}
                    onValueChange={(v) => setFormData({ ...formData, institucion: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-institucion">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {options?.instituciones?.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-400">Aplicaciones</Label>
                  <MultiSelectApps
                    options={options?.aplicaciones || []}
                    selected={formData.aplicaciones || []}
                    onChange={(apps) => setFormData({ ...formData, aplicaciones: apps })}
                    placeholder="Seleccionar aplicaciones..."
                  />
                  {formData.aplicaciones?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.aplicaciones.map((app) => (
                        <Badge 
                          key={app} 
                          variant="secondary" 
                          className="bg-indigo-500/20 text-indigo-300 cursor-pointer hover:bg-red-500/20 hover:text-red-300"
                          onClick={() => setFormData({ 
                            ...formData, 
                            aplicaciones: formData.aplicaciones.filter(a => a !== app) 
                          })}
                        >
                          {app}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Severidad Técnica</Label>
                  <Select
                    value={formData.severidad || ""}
                    onValueChange={(v) => setFormData({ ...formData, severidad: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-severidad">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {options?.severidades?.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400 flex items-center gap-2">
                    Nivel de Riesgo Corporativo
                    <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">GRC</span>
                  </Label>
                  <Select
                    value={formData.nivel_riesgo || ""}
                    onValueChange={(v) => setFormData({ ...formData, nivel_riesgo: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-nivel-riesgo">
                      <SelectValue placeholder="Seleccionar nivel de riesgo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {NIVEL_RIESGO_OPTIONS.map((nivel) => (
                        <SelectItem key={nivel} value={nivel}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              nivel === "Alto" ? "bg-red-500" :
                              nivel === "Medio Alto" ? "bg-orange-500" :
                              nivel === "Medio" ? "bg-yellow-500" :
                              "bg-green-500"
                            }`}></span>
                            {nivel}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">
                    Estatus
                    {formData.resultado_re_test && !["Nota de Seguimiento", ""].includes(formData.resultado_re_test) && (
                      <span className="text-xs text-cyan-400 ml-2">(sincronizado con Resultado Re Test)</span>
                    )}
                  </Label>
                  <Select
                    value={formData.estatus || ""}
                    onValueChange={(v) => setFormData({ ...formData, estatus: v })}
                    disabled={formData.resultado_re_test && !["Nota de Seguimiento", ""].includes(formData.resultado_re_test)}
                  >
                    <SelectTrigger 
                      className={`bg-black/20 border-zinc-700 text-white ${
                        formData.resultado_re_test && !["Nota de Seguimiento", ""].includes(formData.resultado_re_test) 
                          ? "opacity-60" : ""
                      }`} 
                      data-testid="input-estatus"
                    >
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {options?.estatus?.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-400">Vulnerabilidad</Label>
                  <Textarea
                    value={formData.vulnerabilidad || ""}
                    onChange={(e) => setFormData({ ...formData, vulnerabilidad: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white min-h-[80px]"
                    data-testid="input-vulnerabilidad"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-400">Descripción del Riesgo</Label>
                  <Textarea
                    value={formData.descripcion_riesgo || ""}
                    onChange={(e) => setFormData({ ...formData, descripcion_riesgo: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white min-h-[60px]"
                    placeholder="Describa el impacto y contexto del riesgo para el negocio..."
                    data-testid="input-descripcion-riesgo"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-400">Recomendaciones</Label>
                  <Textarea
                    value={formData.recomendaciones || ""}
                    onChange={(e) => setFormData({ ...formData, recomendaciones: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white min-h-[80px]"
                    data-testid="input-recomendaciones"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Responsable</Label>
                  <SearchableSelect
                    value={formData.responsable || ""}
                    onChange={(value) => setFormData({ ...formData, responsable: value })}
                    options={(options?.responsables || []).map(r => ({
                      value: r.nombre,
                      label: r.nombre,
                      subtext: r.email || null
                    }))}
                    placeholder="Seleccionar responsable..."
                    searchPlaceholder="Buscar responsable..."
                    emptyText="No se encontraron responsables"
                    allowCreate={true}
                    onCreateNew={(name) => setFormData({ ...formData, responsable: name })}
                    data-testid="input-responsable"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Fecha Compromiso</Label>
                  <Input
                    type="date"
                    value={formData.fecha_compromiso || ""}
                    onChange={(e) => setFormData({ ...formData, fecha_compromiso: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-fecha-compromiso"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Resultado Re Test</Label>
                  <Select
                    value={formData.resultado_re_test || ""}
                    onValueChange={(v) => {
                      // Sincronizar estatus en tiempo real según resultado_re_test
                      const estatusCierre = ["Corregido", "Desestimado"];
                      const estatusPendiente = ["Vulnerable", "Impedimento", "En Retest", "Pendiente"];
                      
                      let nuevoEstatus = formData.estatus;
                      let nuevaFechaCierre = formData.fecha_cierre;
                      
                      if (estatusCierre.includes(v)) {
                        nuevoEstatus = "Cerrado";
                        // Pre-llenar fecha de cierre con hoy si está vacía
                        if (!nuevaFechaCierre) {
                          nuevaFechaCierre = new Date().toISOString().split('T')[0];
                        }
                      } else if (estatusPendiente.includes(v)) {
                        nuevoEstatus = "Pendiente";
                      }
                      // Si v está vacío o es "Nota de Seguimiento", mantener el estatus actual
                      
                      setFormData({ 
                        ...formData, 
                        resultado_re_test: v,
                        estatus: nuevoEstatus,
                        fecha_cierre: estatusCierre.includes(v) ? nuevaFechaCierre : formData.fecha_cierre
                      });
                    }}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-resultado-retest">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {options?.resultado_retest?.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500">
                    {formData.resultado_re_test ? 
                      (["Corregido", "Desestimado"].includes(formData.resultado_re_test) ? 
                        "⚡ Estatus se sincroniza a 'Cerrado'" : 
                        ["Vulnerable", "Impedimento", "En Retest", "Pendiente"].includes(formData.resultado_re_test) ?
                          "⚡ Estatus se sincroniza a 'Pendiente'" : 
                          "") : 
                      "Sin resultado = estatus libre"}
                  </p>
                </div>

                {/* Campo Fecha de Cierre - Solo visible cuando estatus = Cerrado o resultado = Corregido/Desestimado */}
                {(formData.estatus === "Cerrado" || ["Corregido", "Desestimado"].includes(formData.resultado_re_test)) && (
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Fecha de Cierre</Label>
                    <Input
                      type="date"
                      value={formData.fecha_cierre || ""}
                      onChange={(e) => setFormData({ ...formData, fecha_cierre: e.target.value })}
                      className="bg-black/20 border-zinc-700 text-white"
                      data-testid="input-fecha-cierre"
                    />
                    <p className="text-xs text-zinc-500">Se establece automáticamente al cerrar</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-zinc-400">Veces en Retest</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.veces_en_retest || 0}
                    onChange={(e) => setFormData({ ...formData, veces_en_retest: parseInt(e.target.value) || 0 })}
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-veces-retest"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Proveedor</Label>
                  <Select
                    value={formData.proveedor || ""}
                    onValueChange={(v) => setFormData({ ...formData, proveedor: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-proveedor">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {options?.proveedores?.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Nombre Informe Pentest</Label>
                  <SearchableSelect
                    options={options?.informes_pentest || []}
                    value={formData.nombre_informe_pentest || ""}
                    onChange={(v) => setFormData({ ...formData, nombre_informe_pentest: v })}
                    placeholder="Seleccionar informe..."
                    searchPlaceholder="Buscar informe..."
                    emptyText="No se encontraron informes"
                    data-testid="input-nombre-informe"
                  />
                </div>

                {/* GRC Section - Dominio → Control Cascading - Al final del formulario */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm font-medium text-cyan-500">Vinculación GRC</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Dominio</Label>
                      <Select
                        value={selectedDominioId || ""}
                        onValueChange={(v) => {
                          setSelectedDominioId(v);
                          setFormData({ ...formData, control_id: "", dominio_id: v });
                        }}
                      >
                        <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-dominio">
                          <SelectValue placeholder="Seleccionar dominio..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          {dominios.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.nombre_dominio}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Control Asociado</Label>
                      <Select
                        value={formData.control_id || "_none"}
                        onValueChange={(v) => setFormData({ ...formData, control_id: v === "_none" ? "" : v })}
                        disabled={!selectedDominioId}
                      >
                        <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-control">
                          <SelectValue placeholder={selectedDominioId ? "Seleccionar control..." : "Primero seleccione un dominio"} />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                          <SelectItem value="_none" className="text-zinc-400">Sin control</SelectItem>
                          {filteredControles.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.codigo_control ? `${c.codigo_control} - ` : ""}{c.nombre_control}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Riesgo del Catálogo - Al final del formulario */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <Label className="text-zinc-400">Riesgo del Catálogo</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={selectedRiesgoName}
                      readOnly
                      placeholder="Buscar y seleccionar riesgo del catálogo..."
                      className="bg-black/20 border-zinc-700 text-white flex-1 cursor-pointer"
                      onClick={() => setShowRiskSearchModal(true)}
                      data-testid="input-riesgo-catalogo"
                    />
                    {formData.riesgo_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ ...formData, riesgo_id: "" })}
                        className="text-zinc-400 hover:text-white shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRiskSearchModal(true)}
                      className="border-zinc-700 text-zinc-300 shrink-0"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  className="border-zinc-700 text-zinc-300"
                  data-testid="cancel-btn"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    // Para edición, mostrar modal de confirmación con Diff
                    if (editingVuln) {
                      setOriginalDataForDiff({...editingVuln});
                      setShowConfirmChangesModal(true);
                    } else {
                      // Para creación, submit directo
                      document.getElementById('vuln-form')?.requestSubmit();
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="save-btn"
                >
                  {editingVuln ? "Guardar Cambios" : "Crear Vulnerabilidad"}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation with Justification */}
      <DeleteWithJustificationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        itemName={deletingItem?.vulnerabilidad}
        itemType="la vulnerabilidad"
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />

      {/* Confirm Changes Modal (Diff) */}
      <ConfirmChangesModal
        open={showConfirmChangesModal}
        onOpenChange={setShowConfirmChangesModal}
        originalData={originalDataForDiff}
        editedData={formData}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmChangesModal(false)}
        loading={savingChanges}
        entityType="la vulnerabilidad"
        lookupMaps={lookupMaps}
      />

      {/* PDF Import Modal */}
      <Dialog open={showPdfImport} onOpenChange={setShowPdfImport}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Importar desde PDF
            </DialogTitle>
          </DialogHeader>
          <ImportarPDF 
            onClose={() => setShowPdfImport(false)}
            onSuccess={() => {
              fetchVulnerabilidades();
              fetchOptions();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Acciones Masivas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-400">
              Aplicar cambios a <strong className="text-indigo-400">{selectedIds.length}</strong> vulnerabilidad{selectedIds.length > 1 ? "es" : ""} seleccionada{selectedIds.length > 1 ? "s" : ""}:
            </p>

            <div className="space-y-4">
              {/* Estatus */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Cambiar Estatus</Label>
                <Select 
                  value={bulkAction.estatus} 
                  onValueChange={(val) => setBulkAction({...bulkAction, estatus: val})}
                >
                  <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="bulk-estatus">
                    <SelectValue placeholder="Seleccionar estatus..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="none">-- No cambiar --</SelectItem>
                    {options?.estatus?.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Responsable */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Asignar Responsable</Label>
                <SearchableSelect
                  value={bulkAction.responsable || ""}
                  onChange={(value) => setBulkAction({...bulkAction, responsable: value})}
                  options={(options?.responsables || []).map(r => ({
                    value: r.nombre,
                    label: r.nombre,
                    subtext: r.email || null
                  }))}
                  placeholder="-- No cambiar --"
                  searchPlaceholder="Buscar responsable..."
                  emptyText="No se encontraron responsables"
                  allowCreate={true}
                  onCreateNew={(name) => setBulkAction({...bulkAction, responsable: name})}
                  data-testid="bulk-responsable"
                />
              </div>

              {/* Fecha Compromiso */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Fecha de Compromiso</Label>
                <Input
                  type="date"
                  value={bulkAction.fecha_compromiso || ""}
                  onChange={(e) => setBulkAction({...bulkAction, fecha_compromiso: e.target.value})}
                  className="bg-black/20 border-zinc-700 text-white"
                  data-testid="bulk-fecha"
                />
              </div>

              {/* Incrementar Veces Retest */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Incrementar Veces Retest (+)</Label>
                <Input
                  type="number"
                  min="1"
                  max="99"
                  placeholder="Ej: 1"
                  value={bulkAction.incrementar_retest || ""}
                  onChange={(e) => setBulkAction({...bulkAction, incrementar_retest: e.target.value})}
                  className="bg-black/20 border-zinc-700 text-white"
                  data-testid="bulk-retest"
                />
                <p className="text-xs text-zinc-500">Este valor se sumará al conteo actual de cada vulnerabilidad</p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
              <strong>Nota:</strong> Solo los campos con valores serán actualizados. Los campos vacíos no se modificarán.
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkModal(false);
                setBulkAction({ estatus: "", responsable: "", fecha_compromiso: "", incrementar_retest: "" });
              }}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={applyingBulk || (!bulkAction.estatus && !bulkAction.responsable && !bulkAction.fecha_compromiso && !bulkAction.incrementar_retest)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="apply-bulk-btn"
            >
              {applyingBulk ? "Aplicando..." : "Aplicar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Confirmar Eliminación Masiva
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-zinc-300">
              ¿Estás seguro de que deseas eliminar <strong className="text-red-400">{selectedIds.length}</strong> vulnerabilidad{selectedIds.length > 1 ? "es" : ""}?
            </p>
            <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              <strong>Advertencia:</strong> Esta acción no se puede deshacer. Todas las vulnerabilidades seleccionadas serán eliminadas permanentemente.
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteConfirm(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={applyingBulk}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-bulk-delete-btn"
            >
              {applyingBulk ? "Eliminando..." : "Eliminar Todo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Entry Modal */}
      <BulkEntryModal
        open={showBulkEntryModal}
        onClose={() => setShowBulkEntryModal(false)}
        options={options}
        onSuccess={() => {
          fetchVulnerabilidades();
          fetchOptions();
        }}
      />

      {/* Risk Search Modal */}
      <Dialog open={showRiskSearchModal} onOpenChange={setShowRiskSearchModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Buscar Riesgo en Catálogo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={riskSearchTerm}
                onChange={(e) => setRiskSearchTerm(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                autoFocus
                data-testid="risk-search-input"
              />
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {filteredRiesgos.length === 0 ? (
                  <p className="text-zinc-500 text-center py-4">
                    {catalogoRiesgos.length === 0 
                      ? "No hay riesgos en el catálogo. Crea uno en Catálogo de Riesgos."
                      : "No se encontraron riesgos"}
                  </p>
                ) : (
                  filteredRiesgos.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setFormData({ ...formData, riesgo_id: r.id });
                        setShowRiskSearchModal(false);
                        setRiskSearchTerm("");
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors border border-transparent hover:border-orange-500/30"
                      data-testid={`risk-option-${r.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-mono text-xs">
                          {r.codigo_riesgo}
                        </Badge>
                        <span className="text-white font-medium">{r.nombre_corto}</span>
                      </div>
                      {r.descripcion_completa && (
                        <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.descripcion_completa}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Posible Duplicado Detectado
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              <p className="mb-3">Se encontró una vulnerabilidad similar en el sistema:</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {duplicatesFound.map((dup, idx) => (
                  <div key={idx} className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                    <p className="text-white font-medium text-sm">{dup.vulnerabilidad}</p>
                    <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                      <span>Código: <span className="text-zinc-300">{dup.codigo}</span></span>
                      <span>App: <span className="text-zinc-300">{dup.aplicaciones}</span></span>
                      <span>Inst: <span className="text-zinc-300">{dup.institucion}</span></span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-amber-400/80">¿Desea crear la vulnerabilidad de todas formas?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDuplicate}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDuplicate}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="confirm-duplicate-btn"
            >
              Crear de todas formas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportConfirmModal} onOpenChange={setShowImportConfirmModal}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Importación
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <p>
                Está a punto de importar vulnerabilidades desde un archivo <strong className="text-white">{pendingImportFormat?.toUpperCase()}</strong>.
              </p>
              {pendingImportFile && (
                <p className="text-sm">
                  <span className="text-zinc-500">Archivo:</span>{" "}
                  <span className="text-white">{pendingImportFile.name}</span>
                </p>
              )}
              <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 mt-2">
                <p className="text-amber-300 text-sm">
                  <strong>Importante:</strong> Esta acción creará nuevos registros de vulnerabilidades en el sistema.
                  Asegúrese de que el archivo tiene el formato correcto antes de continuar.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={cancelImport}
              className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirmar Importación
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ MODAL DE ADVERTENCIA PARA CAMBIO GLOBAL CON RESULTADOS PERSONALIZADOS ============ */}
      <AlertDialog open={showGlobalChangeWarning} onOpenChange={setShowGlobalChangeWarning}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Resultados Personalizados Detectados
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 space-y-3">
              <p>
                Esta vulnerabilidad contiene <strong className="text-white">Resultados de Re-Test personalizados</strong> por aplicación.
              </p>
              {pendingGlobalChange?.infoPersonalizados && (
                <div className="bg-zinc-800/50 p-3 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="text-zinc-300">Aplicaciones con resultados diferentes:</span>{" "}
                    <span className="text-white font-medium">
                      {pendingGlobalChange.infoPersonalizados.resultados_diferentes?.join(", ") || "Varios"}
                    </span>
                  </p>
                  {pendingGlobalChange.infoPersonalizados.es_correccion_parcial && (
                    <p className="text-amber-400 text-sm flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Corrección parcial: {pendingGlobalChange.infoPersonalizados.aplicaciones_corregidas} de {pendingGlobalChange.infoPersonalizados.aplicaciones_total} aplicaciones corregidas
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm">
                ¿Cómo desea aplicar el cambio a <strong className="text-blue-400">{pendingGlobalChange?.resultado}</strong>?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              onClick={handleCancelGlobalChange}
              className="bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleConfirmGlobalChange(false)}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              Solo resultado general
            </Button>
            <Button
              onClick={() => handleConfirmGlobalChange(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Aplicar a todas las apps
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
