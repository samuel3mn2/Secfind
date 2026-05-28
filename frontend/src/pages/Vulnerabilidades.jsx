import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import ImportarPDF from "@/pages/ImportarPDF";
import BulkEntryModal from "@/components/BulkEntryModal";

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

// Available columns configuration
const ALL_COLUMNS = [
  { id: "codigo", label: "Código", default: true },
  { id: "fecha_hallazgo", label: "Fecha", default: true },
  { id: "institucion", label: "Institución", default: true },
  { id: "aplicaciones", label: "Aplicaciones", default: true },
  { id: "vulnerabilidad", label: "Vulnerabilidad", default: true },
  { id: "severidad", label: "Severidad", default: true },
  { id: "estatus", label: "Estatus", default: true },
  { id: "responsable", label: "Responsable", default: true },
  { id: "fecha_compromiso", label: "Fecha Compromiso", default: false },
  { id: "dominio", label: "Dominio", default: false },
  { id: "control_asociado", label: "Control Asociado", default: false },
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
  const [filterAño, setFilterAño] = useState("");
  const [filterAplicacion, setFilterAplicacion] = useState([]);
  const [filterInforme, setFilterInforme] = useState([]);
  const [filterResponsable, setFilterResponsable] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showBulkEntryModal, setShowBulkEntryModal] = useState(false);
  const [viewingVuln, setViewingVuln] = useState(null);
  const [editingVuln, setEditingVuln] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const itemsPerPage = 15;

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkAction, setBulkAction] = useState({ estatus: "", responsable: "", fecha_compromiso: "" });
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
    if (!selectedDominioId) return controles;
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

  const fetchVulnerabilidades = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterEstatus.length > 0) filterEstatus.forEach(v => params.append("estatus", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterAño && filterAño !== "all") params.append("año", filterAño);
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));

      const response = await axios.get(`${API}/vulnerabilidades?${params.toString()}`);
      setVulnerabilidades(response.data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching vulnerabilidades:", error);
      toast.error("Error al cargar vulnerabilidades");
    } finally {
      setLoading(false);
    }
  }, [search, filterSeveridad, filterEstatus, filterInstitucion, filterAño, filterAplicacion, filterInforme, filterResponsable]);

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
    setViewingVuln(vuln);
    setShowViewModal(true);
  };

  const handleOpenModal = (vuln = null) => {
    if (vuln) {
      setEditingVuln(vuln);
      // Find dominio_id from control if exists
      const control = controles.find(c => c.id === vuln.control_id);
      setSelectedDominioId(control?.dominio_id || "");
      setFormData({ 
        ...vuln,
        aplicaciones: vuln.aplicaciones || [],
        control_id: vuln.control_id || "",
        riesgo_id: vuln.riesgo_id || "",
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
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedDominioId("");
    setEditingVuln(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVuln) {
        await axios.put(`${API}/vulnerabilidades/${editingVuln.id}`, formData);
        toast.success("Vulnerabilidad actualizada exitosamente");
      } else {
        await axios.post(`${API}/vulnerabilidades`, formData);
        toast.success("Vulnerabilidad creada exitosamente");
      }
      handleCloseModal();
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Error al guardar la vulnerabilidad");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API}/vulnerabilidades/${deleteId}`);
      toast.success("Vulnerabilidad eliminada exitosamente");
      setDeleteId(null);
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar la vulnerabilidad");
    }
  };

  const handleExport = async (format) => {
    try {
      // Build query params with current filters
      const params = new URLSearchParams();
      
      // Add search filter
      if (search) params.append("search", search);
      
      // Add year filter
      if (filterAño && filterAño !== "all") params.append("año", filterAño);
      
      // Add multi-select filters
      if (filterSeveridad.length > 0) filterSeveridad.forEach(v => params.append("severidad", v));
      if (filterEstatus.length > 0) filterEstatus.forEach(v => params.append("estatus", v));
      if (filterInstitucion.length > 0) filterInstitucion.forEach(v => params.append("institucion", v));
      if (filterAplicacion.length > 0) filterAplicacion.forEach(v => params.append("aplicacion", v));
      if (filterInforme.length > 0) filterInforme.forEach(v => params.append("informe_pentest", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      
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

  const handleImport = async (e, format) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const response = await axios.post(`${API}/import/${format}`, formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(response.data.message);
      fetchVulnerabilidades();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error(error.response?.data?.detail || "Error al importar archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
    if (!bulkAction.estatus && bulkAction.responsable === undefined && bulkAction.fecha_compromiso === undefined) {
      toast.error("Selecciona al menos un campo para actualizar");
      return;
    }
    
    setApplyingBulk(true);
    try {
      const payload = { ids: selectedIds };
      if (bulkAction.estatus) payload.estatus = bulkAction.estatus;
      if (bulkAction.responsable !== undefined && bulkAction.responsable !== "") payload.responsable = bulkAction.responsable;
      if (bulkAction.fecha_compromiso !== undefined && bulkAction.fecha_compromiso !== "") payload.fecha_compromiso = bulkAction.fecha_compromiso;
      
      const response = await axios.post(`${API}/vulnerabilidades/bulk-update`, payload);
      toast.success(response.data.message);
      setShowBulkModal(false);
      setSelectedIds([]);
      setBulkAction({ estatus: "", responsable: "", fecha_compromiso: "" });
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
            {(filterSeveridad.length > 0 || filterEstatus.length > 0 || filterInstitucion.length > 0 || filterAplicacion.length > 0 || filterInforme.length > 0 || (filterAño && filterAño !== "all")) && (
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
              <Select value={filterAño} onValueChange={setFilterAño}>
                <SelectTrigger className="w-[100px] bg-black/20 border-zinc-700 text-white" data-testid="filter-año">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todos</SelectItem>
                  {options?.años?.map((año) => (
                    <SelectItem key={año} value={String(año)}>{año}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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

              {/* Import/Export */}
              <div className="flex gap-2 ml-auto">
                {canAdd && (
                  <>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => handleImport(e, "excel")}
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
                        onChange={(e) => handleImport(e, "csv")}
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
                  {isColumnVisible("severidad") && <TableHead className="text-zinc-400">Severidad</TableHead>}
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
                      {isColumnVisible("severidad") && (
                        <TableCell>
                          <SeverityBadge severity={vuln.severidad} />
                        </TableCell>
                      )}
                      {isColumnVisible("estatus") && (
                        <TableCell>
                          <StatusBadge status={vuln.estatus} />
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
                              onClick={() => setDeleteId(vuln.id)}
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
              <div className="flex gap-2">
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
              Detalle de Vulnerabilidad
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {viewingVuln && (
              <div className="space-y-4">
                {/* Header Info */}
                <div className="flex flex-wrap gap-3">
                  <SeverityBadge severity={viewingVuln.severidad} />
                  <StatusBadge status={viewingVuln.estatus} />
                </div>

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

                {/* GRC Section */}
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label className="text-zinc-400">Severidad</Label>
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
                  <Label className="text-zinc-400">Estatus</Label>
                  <Select
                    value={formData.estatus || ""}
                    onValueChange={(v) => setFormData({ ...formData, estatus: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-estatus">
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
                  <Label className="text-zinc-400">Recomendaciones</Label>
                  <Textarea
                    value={formData.recomendaciones || ""}
                    onChange={(e) => setFormData({ ...formData, recomendaciones: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white min-h-[80px]"
                    data-testid="input-recomendaciones"
                  />
                </div>

                {/* GRC Section - Dominio → Control Cascading */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm font-medium text-cyan-500">Vinculación GRC</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                    <div className="space-y-2">
                      <Label className="text-zinc-400">Dominio</Label>
                      <Select
                        value={selectedDominioId || "_none"}
                        onValueChange={(v) => {
                          setSelectedDominioId(v === "_none" ? "" : v);
                          setFormData({ ...formData, control_id: "" });
                        }}
                      >
                        <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                          <SelectValue placeholder="Filtrar por dominio..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="_none" className="text-zinc-400">Todos los dominios</SelectItem>
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
                      >
                        <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-control">
                          <SelectValue placeholder="Seleccionar control..." />
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

                {/* Riesgo del Catálogo */}
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

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-zinc-400">Descripción del Riesgo</Label>
                  <Textarea
                    value={formData.descripcion_riesgo || ""}
                    onChange={(e) => setFormData({ ...formData, descripcion_riesgo: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white min-h-[60px]"
                    data-testid="input-descripcion-riesgo"
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
                    onValueChange={(v) => setFormData({ ...formData, resultado_re_test: v })}
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
                </div>

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
                  type="submit"
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#18181b] border-[#27272a] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vulnerabilidad?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esta acción no se puede deshacer. La vulnerabilidad será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" data-testid="cancel-delete-btn">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-btn"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                setBulkAction({ estatus: "", responsable: "", fecha_compromiso: "" });
              }}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={applyingBulk || (!bulkAction.estatus && !bulkAction.responsable && !bulkAction.fecha_compromiso)}
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
    </div>
  );
}
