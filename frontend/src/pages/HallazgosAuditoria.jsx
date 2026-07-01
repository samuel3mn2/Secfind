import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, ClipboardCheck, Save, Loader2, Search, Filter, AlertTriangle, X, Upload, Download, FileSpreadsheet, Calendar as CalendarIcon, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parse, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";
import { ConfirmChangesModal } from "@/components/ConfirmChangesModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ESTADOS = ["Abierto", "En Proceso", "Listo para Revisión", "Cerrado"];
const PROBABILIDAD_OPTIONS = [
  { value: 1, label: "1 - Bajo" },
  { value: 2, label: "2 - Medio" },
  { value: 3, label: "3 - Medio-Alto" },
  { value: 4, label: "4 - Alto" },
];
const IMPACTO_OPTIONS = [
  { value: 1, label: "1 - Bajo" },
  { value: 2, label: "2 - Medio" },
  { value: 3, label: "3 - Medio-Alto" },
  { value: 4, label: "4 - Alto" },
];

const getRiesgoColor = (value) => {
  if (value >= 12) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (value >= 6) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  if (value >= 3) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-green-500/20 text-green-400 border-green-500/30";
};

const getEstadoColor = (estado) => {
  switch (estado) {
    case "Abierto": return "bg-red-500/20 text-red-400 border-red-500/30";
    case "En Proceso": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Listo para Revisión": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "Cerrado": return "bg-green-500/20 text-green-400 border-green-500/30";
    default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
};

export default function HallazgosAuditoria() {
  const { isAdmin, canCreate, canEdit, canDelete, canView } = useAuth();
  const [hallazgos, setHallazgos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState("all");
  const [filterRiesgo, setFilterRiesgo] = useState("all");
  const [filterAño, setFilterAño] = useState([]);
  const [filterResponsable, setFilterResponsable] = useState([]);
  const [filterDominio, setFilterDominio] = useState([]);
  const [filterControl, setFilterControl] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, skip: 0, limit: 50 });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Reference data for dropdowns
  const [dominios, setDominios] = useState([]);
  const [controles, setControles] = useState([]);
  const [riesgos, setRiesgos] = useState([]);
  const [responsables, setResponsables] = useState([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHallazgo, setEditingHallazgo] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    dominio_id: "", // For cascading filter
    control_id: "",
    brecha: "",
    riesgo_id: "",
    probabilidad: 3,
    impacto: 3,
    estado: "Abierto",
    responsable: "",
    fecha_hallazgo: "",
    fecha_compromiso: "",
    observaciones: "",
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Confirm changes modal
  const [showConfirmChanges, setShowConfirmChanges] = useState(false);
  const [originalDataForDiff, setOriginalDataForDiff] = useState(null);
  const [savingChanges, setSavingChanges] = useState(false);

  // Risk search modal
  const [riskSearchOpen, setRiskSearchOpen] = useState(false);
  const [riskSearchTerm, setRiskSearchTerm] = useState("");

  const canCreateHallazgo = isAdmin || canCreate("vulnerabilidades");
  const canEditHallazgo = isAdmin || canEdit("vulnerabilidades");
  const canDeleteHallazgo = isAdmin || canDelete("vulnerabilidades");
  const canViewHallazgo = isAdmin || canView("vulnerabilidades");

  // Reactive calculation of Riesgo Inherente
  const riesgoInherente = useMemo(() => {
    return formData.probabilidad * formData.impacto;
  }, [formData.probabilidad, formData.impacto]);

  // Filter controles based on selected dominio
  const filteredControles = useMemo(() => {
    if (!formData.dominio_id) return []; // No mostrar controles si no hay dominio seleccionado
    return controles.filter(c => c.dominio_id === formData.dominio_id);
  }, [controles, formData.dominio_id]);

  // Filter riesgos for search modal
  const filteredRiesgos = useMemo(() => {
    if (!riskSearchTerm) return riesgos;
    const term = riskSearchTerm.toLowerCase();
    return riesgos.filter(r =>
      r.codigo_riesgo?.toLowerCase().includes(term) ||
      r.nombre_corto?.toLowerCase().includes(term) ||
      r.descripcion_completa?.toLowerCase().includes(term)
    );
  }, [riesgos, riskSearchTerm]);

  // Lookup maps for ConfirmChangesModal to resolve IDs to names
  const lookupMaps = useMemo(() => {
    const controlesMap = {};
    controles.forEach(c => {
      controlesMap[c.id] = `${c.codigo_control} - ${c.nombre_control || c.descripcion || ''}`.trim();
    });
    
    const riesgosMap = {};
    riesgos.forEach(r => {
      riesgosMap[r.id] = `${r.codigo_riesgo} - ${r.nombre_corto}`;
    });
    
    const dominiosMap = {};
    dominios.forEach(d => {
      dominiosMap[d.id] = d.nombre_dominio;
    });
    
    return { controles: controlesMap, riesgos: riesgosMap, dominios: dominiosMap };
  }, [controles, riesgos, dominios]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [dominiosRes, controlesRes, riesgosRes, responsablesRes] = await Promise.all([
        axios.get(`${API}/config/dominios`, { headers }),
        axios.get(`${API}/config/controles`, { headers }),
        axios.get(`${API}/catalogo-riesgos/all`, { headers }),
        axios.get(`${API}/config/responsables`, { headers }),
      ]);

      setDominios(dominiosRes.data);
      setControles(controlesRes.data);
      setRiesgos(riesgosRes.data);
      setResponsables(responsablesRes.data);
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  const fetchHallazgos = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (filterEstado !== "all") params.append("estado", filterEstado);
      if (filterRiesgo !== "all") params.append("riesgo_id", filterRiesgo);
      if (filterAño.length > 0) filterAño.forEach(v => params.append("año", v));
      if (filterResponsable.length > 0) filterResponsable.forEach(v => params.append("responsable", v));
      if (filterDominio.length > 0) filterDominio.forEach(v => params.append("dominio", v));
      if (filterControl.length > 0) filterControl.forEach(v => params.append("control", v));
      params.append("skip", pagination.skip.toString());
      params.append("limit", pagination.limit.toString());

      const response = await axios.get(`${API}/hallazgos-auditoria?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHallazgos(response.data.items);
      setPagination((prev) => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error("Error fetching hallazgos:", error);
      toast.error("Error al cargar hallazgos de auditoría");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterEstado, filterRiesgo, filterAño, filterResponsable, filterDominio, filterControl, pagination.skip, pagination.limit]);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hallazgos-auditoria/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
    fetchStats();
  }, [fetchReferenceData, fetchStats]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchHallazgos();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchHallazgos]);

  const getNextCodigo = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hallazgos-auditoria/next-codigo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.next_codigo;
    } catch (error) {
      console.error("Error getting next codigo:", error);
      return "";
    }
  };

  const openCreateModal = async () => {
    setEditingHallazgo(null);
    const nextCodigo = await getNextCodigo();
    const today = format(new Date(), "yyyy-MM-dd");
    setFormData({
      codigo: nextCodigo,
      dominio_id: "",
      control_id: "",
      brecha: "",
      riesgo_id: "",
      probabilidad: 3,
      impacto: 3,
      estado: "Abierto",
      responsable: "",
      fecha_hallazgo: today,
      fecha_compromiso: "",
      observaciones: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (hallazgo) => {
    setEditingHallazgo(hallazgo);
    // Find the dominio_id from the control if available
    const control = controles.find(c => c.id === hallazgo.control_id);
    setFormData({
      codigo: hallazgo.codigo || "",
      dominio_id: control?.dominio_id || "",
      control_id: hallazgo.control_id || "",
      brecha: hallazgo.brecha || "",
      riesgo_id: hallazgo.riesgo_id || "",
      probabilidad: hallazgo.probabilidad || 3,
      impacto: hallazgo.impacto || 3,
      estado: hallazgo.estado || "Abierto",
      responsable: hallazgo.responsable || "",
      fecha_hallazgo: hallazgo.fecha_hallazgo || "",
      fecha_compromiso: hallazgo.fecha_compromiso || "",
      observaciones: hallazgo.observaciones || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingHallazgo(null);
    setFormData({
      codigo: "",
      dominio_id: "",
      control_id: "",
      brecha: "",
      riesgo_id: "",
      probabilidad: 3,
      impacto: 3,
      estado: "Abierto",
      responsable: "",
      fecha_hallazgo: "",
      fecha_compromiso: "",
      observaciones: "",
    });
  };

  const handleSave = async () => {
    if (!formData.codigo.trim() || !formData.brecha.trim()) {
      toast.error("El código y la brecha son requeridos");
      return;
    }

    // Validate fecha_compromiso >= fecha_hallazgo
    if (formData.fecha_hallazgo && formData.fecha_compromiso) {
      const fh = new Date(formData.fecha_hallazgo);
      const fc = new Date(formData.fecha_compromiso);
      if (fc < fh) {
        toast.error("La fecha de compromiso no puede ser anterior a la fecha de hallazgo");
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Remove dominio_id from payload (it's only for cascading filter)
      const { dominio_id, ...payload } = formData;

      if (editingHallazgo) {
        await axios.put(
          `${API}/hallazgos-auditoria/${editingHallazgo.id}`,
          payload,
          { headers }
        );
        toast.success("Hallazgo actualizado exitosamente");
      } else {
        await axios.post(`${API}/hallazgos-auditoria`, payload, { headers });
        toast.success("Hallazgo creado exitosamente");
      }

      closeModal();
      fetchHallazgos();
      fetchStats();
    } catch (error) {
      console.error("Error saving hallazgo:", error);
      toast.error(error.response?.data?.detail || "Error al guardar hallazgo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/hallazgos-auditoria/${deleteConfirm.id}?justificacion=${encodeURIComponent(justificacion)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Hallazgo eliminado exitosamente");
      setDeleteConfirm(null);
      fetchHallazgos();
      fetchStats();
    } catch (error) {
      console.error("Error deleting hallazgo:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar hallazgo");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Función para abrir modal de confirmación de cambios (Diff)
  const handlePreSave = () => {
    if (editingHallazgo) {
      // Find original dominio_id from control if exists
      const control = controles.find(c => c.id === editingHallazgo.control_id);
      const originalDominioId = control?.dominio_id || "";
      setOriginalDataForDiff({...editingHallazgo, dominio_id: originalDominioId});
      setShowConfirmChanges(true);
    } else {
      // Para creación, guardar directamente
      handleSave();
    }
  };

  // Función para confirmar y guardar cambios
  const handleConfirmSave = async () => {
    setSavingChanges(true);
    try {
      const token = localStorage.getItem("token");
      // Remove dominio_id from payload (it's only for cascading filter)
      const { dominio_id, ...payload } = formData;
      await axios.put(`${API}/hallazgos-auditoria/${editingHallazgo.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Hallazgo actualizado exitosamente");
      setShowConfirmChanges(false);
      setIsModalOpen(false);
      setEditingHallazgo(null);
      setFormData({
        codigo: "",
        dominio_id: "",
        control_id: "",
        brecha: "",
        riesgo_id: "",
        probabilidad: 3,
        impacto: 3,
        estado: "Abierto",
        responsable: "",
        fecha_hallazgo: "",
        fecha_compromiso: "",
        observaciones: "",
      });
      fetchHallazgos();
      fetchStats();
    } catch (error) {
      console.error("Error saving hallazgo:", error);
      toast.error(error.response?.data?.detail || "Error al guardar hallazgo");
    } finally {
      setSavingChanges(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecciona un archivo Excel");
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem("token");
      const formDataUpload = new FormData();
      formDataUpload.append("file", importFile);

      const response = await axios.post(`${API}/hallazgos-auditoria/import/excel`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(response.data.message);
      if (response.data.errors?.length > 0) {
        response.data.errors.forEach((err) => toast.warning(err));
      }

      setShowImportModal(false);
      setImportFile(null);
      fetchHallazgos();
      fetchStats();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error(error.response?.data?.detail || "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/hallazgos-auditoria/plantilla/descargar`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_hallazgos_auditoria.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Error al descargar plantilla");
    }
  };

  const selectRiesgo = (riesgo) => {
    setFormData((prev) => ({ ...prev, riesgo_id: riesgo.id }));
    setRiskSearchOpen(false);
    setRiskSearchTerm("");
  };

  const selectedRiesgoName = useMemo(() => {
    const r = riesgos.find(r => r.id === formData.riesgo_id);
    return r ? `${r.codigo_riesgo} - ${r.nombre_corto}` : "";
  }, [riesgos, formData.riesgo_id]);

  if (!canViewHallazgo) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <p className="text-zinc-500">No tiene permisos para ver esta página</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="hallazgos-auditoria-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10">
            <ClipboardCheck className="w-6 h-6 text-teal-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Hallazgos de Auditoría
            </h1>
            <p className="text-zinc-500">
              Gestiona hallazgos de auditoría y su relación con riesgos
            </p>
          </div>
        </div>
        {canCreateHallazgo && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              data-testid="btn-descargar-plantilla-hallazgos"
            >
              <Download className="w-4 h-4 mr-2" />
              Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
              data-testid="btn-importar-hallazgos"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button
              onClick={openCreateModal}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="btn-crear-hallazgo"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Hallazgo
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">Abiertos</p>
              <p className="text-2xl font-bold text-red-400">{stats.por_estado?.Abierto || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">En Proceso</p>
              <p className="text-2xl font-bold text-blue-400">{stats.por_estado?.["En Proceso"] || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">Revisión</p>
              <p className="text-2xl font-bold text-amber-400">{stats.por_estado?.["Listo para Revisión"] || 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500">Alto Riesgo</p>
              <p className="text-2xl font-bold text-red-500">{stats.alto_riesgo_pendientes || 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((prev) => ({ ...prev, skip: 0 }));
            }}
            placeholder="Buscar por código, brecha..."
            className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            data-testid="search-hallazgos"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setPagination((prev) => ({ ...prev, skip: 0 })); }}>
            <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-300">Todos los estados</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e} className="text-zinc-300">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MultiSelectFilter
            options={[...new Set(hallazgos.map(h => h.fecha_hallazgo?.substring(0, 4)).filter(Boolean))].sort().reverse()}
            selected={filterAño}
            onChange={(v) => { setFilterAño(v); setPagination((prev) => ({ ...prev, skip: 0 })); }}
            placeholder="Año"
            searchPlaceholder="Buscar año..."
            allLabel="Todos los años"
            data-testid="filter-año-hallazgos"
          />

          <MultiSelectFilter
            options={responsables.map(r => r.nombre)}
            selected={filterResponsable}
            onChange={(v) => { setFilterResponsable(v); setPagination((prev) => ({ ...prev, skip: 0 })); }}
            placeholder="Responsable"
            searchPlaceholder="Buscar responsable..."
            allLabel="Todos"
            data-testid="filter-responsable-hallazgos"
          />

          <MultiSelectFilter
            options={dominios.map(d => d.nombre_dominio)}
            selected={filterDominio}
            onChange={(v) => { setFilterDominio(v); setPagination((prev) => ({ ...prev, skip: 0 })); }}
            placeholder="Dominio"
            searchPlaceholder="Buscar dominio..."
            allLabel="Todos"
            data-testid="filter-dominio-hallazgos"
          />

          <MultiSelectFilter
            options={controles.map(c => c.codigo_control)}
            selected={filterControl}
            onChange={(v) => { setFilterControl(v); setPagination((prev) => ({ ...prev, skip: 0 })); }}
            placeholder="Control"
            searchPlaceholder="Buscar control..."
            allLabel="Todos"
            data-testid="filter-control-hallazgos"
          />

          {(filterAño.length > 0 || filterResponsable.length > 0 || filterDominio.length > 0 || filterControl.length > 0 || filterEstado !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterAño([]);
                setFilterResponsable([]);
                setFilterDominio([]);
                setFilterControl([]);
                setFilterEstado("all");
                setPagination((prev) => ({ ...prev, skip: 0 }));
              }}
              className="text-zinc-400 hover:text-white"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-zinc-800">
        <CardContent className="p-0">
          {hallazgos.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{searchTerm || filterEstado !== "all" ? "No se encontraron hallazgos" : "No hay hallazgos registrados"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 w-[100px]">Código</TableHead>
                    <TableHead className="text-zinc-400 min-w-[300px]">Brecha</TableHead>
                    <TableHead className="text-zinc-400 hidden xl:table-cell">Dominio</TableHead>
                    <TableHead className="text-zinc-400 hidden lg:table-cell">Control</TableHead>
                    <TableHead className="text-zinc-400 hidden md:table-cell">Riesgo</TableHead>
                    <TableHead className="text-zinc-400 text-center w-[60px]">R.I.</TableHead>
                    <TableHead className="text-zinc-400 hidden lg:table-cell">Responsable</TableHead>
                    <TableHead className="text-zinc-400 hidden md:table-cell">F. Compromiso</TableHead>
                    <TableHead className="text-zinc-400">Estado</TableHead>
                    <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hallazgos.map((hallazgo) => {
                    // Check if vencido (fecha_compromiso < today AND estado != Cerrado)
                    const isVencido = hallazgo.fecha_compromiso && 
                      hallazgo.estado !== "Cerrado" &&
                      new Date(hallazgo.fecha_compromiso) < new Date(new Date().toDateString());
                    
                    return (
                      <TableRow
                        key={hallazgo.id}
                        className={`border-zinc-800 hover:bg-zinc-800/50 ${isVencido ? "bg-red-500/5" : ""}`}
                        data-testid={`hallazgo-row-${hallazgo.id}`}
                      >
                        <TableCell>
                          <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30 font-mono text-xs">
                            {hallazgo.codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-medium min-w-[300px]">
                          <span className="line-clamp-2" title={hallazgo.brecha}>
                            {hallazgo.brecha}
                          </span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-zinc-400 text-sm">
                          {hallazgo.nombre_dominio || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-zinc-400 text-sm">
                          {hallazgo.codigo_control || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {hallazgo.codigo_riesgo ? (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                              {hallazgo.codigo_riesgo}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${getRiesgoColor(hallazgo.riesgo_inherente)} font-bold`}>
                            {hallazgo.riesgo_inherente || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-zinc-300 text-sm">
                          {hallazgo.responsable || "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {hallazgo.fecha_compromiso ? (
                            <div className="flex items-center gap-1">
                              <span className={`font-mono text-xs ${isVencido ? "text-red-400" : "text-zinc-300"}`}>
                                {format(new Date(hallazgo.fecha_compromiso), "dd/MM/yyyy")}
                              </span>
                              {isVencido && (
                                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1">
                                  VENCIDO
                                </Badge>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getEstadoColor(hallazgo.estado)}>
                            {hallazgo.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEditHallazgo && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditModal(hallazgo)}
                                className="text-zinc-400 hover:text-white"
                                data-testid={`btn-editar-hallazgo-${hallazgo.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {canDeleteHallazgo && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirm(hallazgo)}
                                className="text-red-400 hover:text-red-300"
                                data-testid={`btn-eliminar-hallazgo-${hallazgo.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.skip === 0}
            onClick={() => setPagination((prev) => ({ ...prev, skip: prev.skip - prev.limit }))}
            className="border-zinc-700 text-zinc-300"
          >
            Anterior
          </Button>
          <span className="text-zinc-400 text-sm flex items-center px-3">
            {Math.floor(pagination.skip / pagination.limit) + 1} de {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.skip + pagination.limit >= pagination.total}
            onClick={() => setPagination((prev) => ({ ...prev, skip: prev.skip + prev.limit }))}
            className="border-zinc-700 text-zinc-300"
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-teal-500" />
              {editingHallazgo ? "Editar Hallazgo" : "Crear Nuevo Hallazgo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Row 1: Codigo & Estado */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Código *</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  placeholder="AUD-2025-001"
                  className="bg-zinc-800 border-zinc-700 text-white font-mono"
                  data-testid="input-codigo-hallazgo"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Estado</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, estado: v }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {ESTADOS.map((e) => (
                      <SelectItem key={e} value={e} className="text-zinc-300">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Brecha */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Brecha / Descripción del Hallazgo *</Label>
              <Textarea
                value={formData.brecha}
                onChange={(e) => setFormData((prev) => ({ ...prev, brecha: e.target.value }))}
                placeholder="Describe el hallazgo de auditoría..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
                data-testid="input-brecha-hallazgo"
              />
            </div>

            {/* Dominio -> Control (Cascading) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Dominio</Label>
                <Select
                  value={formData.dominio_id || ""}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, dominio_id: v, control_id: "" }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Seleccionar dominio..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {dominios.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-zinc-300">
                        {d.nombre_dominio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Control Asociado</Label>
                <Select
                  value={formData.control_id || "_none"}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, control_id: v === "_none" ? "" : v }))}
                  disabled={!formData.dominio_id}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder={formData.dominio_id ? "Seleccionar control..." : "Primero seleccione un dominio"} />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                    <SelectItem value="_none" className="text-zinc-300">Sin control</SelectItem>
                    {filteredControles.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-zinc-300">
                        {c.codigo_control ? `${c.codigo_control} - ` : ""}{c.nombre_control}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Riesgo Search */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Riesgo Asociado (del Catálogo)</Label>
              <div className="flex gap-2">
                <Input
                  value={selectedRiesgoName}
                  readOnly
                  placeholder="Buscar y seleccionar riesgo..."
                  className="bg-zinc-800 border-zinc-700 text-white flex-1 cursor-pointer"
                  onClick={() => setRiskSearchOpen(true)}
                  data-testid="input-riesgo-hallazgo"
                />
                {formData.riesgo_id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormData((prev) => ({ ...prev, riesgo_id: "" }))}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRiskSearchOpen(true)}
                  className="border-zinc-700 text-zinc-300"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Probabilidad, Impacto, Riesgo Inherente */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Probabilidad</Label>
                <Select
                  value={formData.probabilidad.toString()}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, probabilidad: parseInt(v) }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {PROBABILIDAD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value.toString()} className="text-zinc-300">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Impacto</Label>
                <Select
                  value={formData.impacto.toString()}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, impacto: parseInt(v) }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {IMPACTO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value.toString()} className="text-zinc-300">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Riesgo Inherente</Label>
                <div className={`flex items-center justify-center h-10 rounded-md border ${getRiesgoColor(riesgoInherente)} font-bold text-lg`}>
                  {riesgoInherente}
                </div>
                <p className="text-xs text-zinc-500 text-center">Probabilidad × Impacto</p>
              </div>
            </div>

            {/* Responsable & Fechas */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Responsable</Label>
                <SearchableSelect
                  value={formData.responsable || ""}
                  onChange={(value) => setFormData((prev) => ({ ...prev, responsable: value }))}
                  options={responsables.map(r => ({
                    value: r.nombre,
                    label: r.nombre,
                    subtext: r.email || null
                  }))}
                  placeholder="Seleccionar..."
                  searchPlaceholder="Buscar responsable..."
                  emptyText="No hay responsables"
                  allowCreate={true}
                  onCreateNew={(name) => setFormData((prev) => ({ ...prev, responsable: name }))}
                  data-testid="input-responsable-hallazgo"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Fecha Hallazgo</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                      data-testid="input-fecha-hallazgo"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                      {formData.fecha_hallazgo ? format(new Date(formData.fecha_hallazgo), "dd/MM/yyyy") : "Seleccionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.fecha_hallazgo ? new Date(formData.fecha_hallazgo) : undefined}
                      onSelect={(date) => setFormData((prev) => ({ 
                        ...prev, 
                        fecha_hallazgo: date ? format(date, "yyyy-MM-dd") : "" 
                      }))}
                      locale={es}
                      initialFocus
                      className="bg-zinc-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Fecha Compromiso</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                      data-testid="input-fecha-compromiso-hallazgo"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                      {formData.fecha_compromiso ? format(new Date(formData.fecha_compromiso), "dd/MM/yyyy") : "Seleccionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.fecha_compromiso ? new Date(formData.fecha_compromiso) : undefined}
                      onSelect={(date) => setFormData((prev) => ({ 
                        ...prev, 
                        fecha_compromiso: date ? format(date, "yyyy-MM-dd") : "" 
                      }))}
                      locale={es}
                      initialFocus
                      className="bg-zinc-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Observaciones</Label>
              <Textarea
                value={formData.observaciones}
                onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                placeholder="Notas adicionales..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeModal}
              className="border-zinc-700 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingHallazgo) {
                  setOriginalDataForDiff({...editingHallazgo});
                  setShowConfirmChanges(true);
                } else {
                  handleSave();
                }
              }}
              disabled={saving || !formData.codigo.trim() || !formData.brecha.trim()}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="btn-guardar-hallazgo"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingHallazgo ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Risk Search Modal */}
      <Dialog open={riskSearchOpen} onOpenChange={setRiskSearchOpen}>
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
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filteredRiesgos.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">No se encontraron riesgos</p>
              ) : (
                filteredRiesgos.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectRiesgo(r)}
                    className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors border border-transparent hover:border-orange-500/30"
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete with Justification Modal */}
      <DeleteWithJustificationModal
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        itemName={deleteConfirm?.codigo}
        itemType="el hallazgo de auditoría"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />

      {/* Confirm Changes Modal (Diff) */}
      <ConfirmChangesModal
        open={showConfirmChanges}
        onOpenChange={setShowConfirmChanges}
        originalData={originalDataForDiff}
        editedData={formData}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmChanges(false)}
        loading={savingChanges}
        entityType="el hallazgo de auditoría"
        lookupMaps={lookupMaps}
      />

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-teal-500" />
              Importar Hallazgos desde Excel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Sube un archivo Excel (.xlsx) con las columnas:
            </p>
            <ul className="text-zinc-400 text-sm list-disc list-inside space-y-1">
              <li><strong>Código</strong> (obligatorio): Ej: AUD-2025-001</li>
              <li><strong>Brecha</strong> (obligatorio): Descripción del hallazgo</li>
              <li><strong>Dominio</strong> (opcional): Nombre del dominio</li>
              <li><strong>Control</strong> (opcional): Nombre del control asociado</li>
              <li><strong>Riesgo</strong> (opcional): Nombre corto del riesgo del catálogo</li>
              <li><strong>Probabilidad</strong>: Muy Baja, Baja, Medio, Alta, Muy Alta</li>
              <li><strong>Impacto</strong>: Muy Bajo, Bajo, Medio, Alto, Muy Alto</li>
              <li><strong>Estado</strong>: Abierto, En Proceso, Listo para Revisión, Cerrado</li>
              <li><strong>Observaciones</strong> (opcional)</li>
            </ul>

            <div className="space-y-2">
              <Label className="text-zinc-300">Archivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="bg-zinc-800 border-zinc-700 text-white file:bg-zinc-700 file:text-white file:border-0 file:mr-4"
                data-testid="input-import-file-hallazgos"
              />
            </div>

            <Button
              variant="link"
              onClick={downloadTemplate}
              className="text-teal-400 hover:text-teal-300 p-0 h-auto"
            >
              <Download className="w-4 h-4 mr-1" />
              Descargar plantilla de ejemplo
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              className="border-zinc-700 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="btn-confirmar-importar-hallazgos"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
