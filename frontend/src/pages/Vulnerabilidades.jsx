import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import ImportarPDF from "@/pages/ImportarPDF";

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
  const [filterSeveridad, setFilterSeveridad] = useState("");
  const [filterEstatus, setFilterEstatus] = useState("");
  const [filterInstitucion, setFilterInstitucion] = useState("");
  const [filterAño, setFilterAño] = useState("");
  const [filterAplicacion, setFilterAplicacion] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingVuln, setViewingVuln] = useState(null);
  const [editingVuln, setEditingVuln] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const itemsPerPage = 15;

  const [formData, setFormData] = useState({
    fecha_hallazgo: "",
    institucion: "",
    aplicaciones: [],
    vulnerabilidad: "",
    recomendaciones: "",
    severidad: "",
    riesgo_asociado: "",
    descripcion_riesgo: "",
    responsable: "",
    fecha_compromiso: "",
    estatus: "",
    resultado_re_test: "",
    nombre_informe_pentest: "",
    proveedor: "",
  });

  const canModify = isAdmin || canEdit("vulnerabilidades");
  const canRemove = isAdmin || canDelete("vulnerabilidades");
  const canAdd = isAdmin || canCreate("vulnerabilidades");

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchVulnerabilidades = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterSeveridad && filterSeveridad !== "all") params.append("severidad", filterSeveridad);
      if (filterEstatus && filterEstatus !== "all") params.append("estatus", filterEstatus);
      if (filterInstitucion && filterInstitucion !== "all") params.append("institucion", filterInstitucion);
      if (filterAño && filterAño !== "all") params.append("año", filterAño);
      if (filterAplicacion && filterAplicacion !== "all") params.append("aplicacion", filterAplicacion);

      const response = await axios.get(`${API}/vulnerabilidades?${params.toString()}`);
      setVulnerabilidades(response.data);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching vulnerabilidades:", error);
      toast.error("Error al cargar vulnerabilidades");
    } finally {
      setLoading(false);
    }
  }, [search, filterSeveridad, filterEstatus, filterInstitucion, filterAño, filterAplicacion]);

  useEffect(() => {
    fetchOptions();
  }, []);

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
      setFormData({ 
        ...vuln,
        aplicaciones: vuln.aplicaciones || []
      });
    } else {
      setEditingVuln(null);
      setFormData({
        fecha_hallazgo: "",
        institucion: "",
        aplicaciones: [],
        vulnerabilidad: "",
        recomendaciones: "",
        severidad: "",
        riesgo_asociado: "",
        descripcion_riesgo: "",
        responsable: "",
        fecha_compromiso: "",
        estatus: "",
        resultado_re_test: "",
        nombre_informe_pentest: "",
        proveedor: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
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
      const response = await axios.get(`${API}/export/${format}`, {
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
      toast.error("Error al exportar");
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
    return apps.join(", ");
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
          </p>
        </div>
        {canAdd && (
          <Button
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
            data-testid="add-vuln-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Vulnerabilidad
          </Button>
        )}
      </div>

      {/* Filters & Actions */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Buscar por vulnerabilidad, aplicación, responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-black/20 border-zinc-700 text-white placeholder:text-zinc-500"
                data-testid="search-input"
              />
            </div>

            {/* Filters */}
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

              <Select value={filterSeveridad} onValueChange={setFilterSeveridad}>
                <SelectTrigger className="w-[120px] bg-black/20 border-zinc-700 text-white" data-testid="filter-severidad">
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todas</SelectItem>
                  {options?.severidades?.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterEstatus} onValueChange={setFilterEstatus}>
                <SelectTrigger className="w-[130px] bg-black/20 border-zinc-700 text-white" data-testid="filter-estatus">
                  <SelectValue placeholder="Estatus" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todos</SelectItem>
                  {options?.estatus?.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterInstitucion} onValueChange={setFilterInstitucion}>
                <SelectTrigger className="w-[140px] bg-black/20 border-zinc-700 text-white" data-testid="filter-institucion">
                  <SelectValue placeholder="Institución" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all">Todas</SelectItem>
                  {options?.instituciones?.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterAplicacion} onValueChange={setFilterAplicacion}>
                <SelectTrigger className="w-[140px] bg-black/20 border-zinc-700 text-white" data-testid="filter-aplicacion">
                  <SelectValue placeholder="Aplicación" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[300px]">
                  <SelectItem value="all">Todas</SelectItem>
                  {options?.aplicaciones?.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="vuln-table">
              <TableHeader>
                <TableRow className="border-zinc-700 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Fecha</TableHead>
                  <TableHead className="text-zinc-400">Institución</TableHead>
                  <TableHead className="text-zinc-400">Aplicaciones</TableHead>
                  <TableHead className="text-zinc-400 min-w-[200px]">Vulnerabilidad</TableHead>
                  <TableHead className="text-zinc-400">Severidad</TableHead>
                  <TableHead className="text-zinc-400">Estatus</TableHead>
                  <TableHead className="text-zinc-400">Responsable</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                      No se encontraron vulnerabilidades
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((vuln) => (
                    <TableRow
                      key={vuln.id}
                      className={`border-zinc-800 table-row-hover ${vuln.severidad === "Critica" ? "critical-indicator" : ""}`}
                      data-testid={`vuln-row-${vuln.id}`}
                    >
                      <TableCell className="text-zinc-300 font-mono text-xs">
                        {vuln.fecha_hallazgo || "-"}
                      </TableCell>
                      <TableCell className="text-zinc-300">{vuln.institucion || "-"}</TableCell>
                      <TableCell className="text-zinc-300 max-w-[150px]">
                        <span className="truncate block" title={formatAplicaciones(vuln)}>
                          {formatAplicaciones(vuln)}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-100 max-w-[300px] truncate">
                        {vuln.vulnerabilidad || "-"}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={vuln.severidad} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={vuln.estatus} />
                      </TableCell>
                      <TableCell className="text-zinc-300">{vuln.responsable || "-"}</TableCell>
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
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Proveedor</p>
                    <p className="text-white">{viewingVuln.proveedor || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Riesgo Asociado</p>
                    <p className="text-white">{viewingVuln.riesgo_asociado || "-"}</p>
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

                <div className="space-y-2">
                  <Label className="text-zinc-400">Riesgo Asociado</Label>
                  <Input
                    value={formData.riesgo_asociado || ""}
                    onChange={(e) => setFormData({ ...formData, riesgo_asociado: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-riesgo-asociado"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Responsable</Label>
                  <Input
                    value={formData.responsable || ""}
                    onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                    className="bg-black/20 border-zinc-700 text-white"
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
                  <Select
                    value={formData.nombre_informe_pentest || ""}
                    onValueChange={(v) => setFormData({ ...formData, nombre_informe_pentest: v })}
                  >
                    <SelectTrigger className="bg-black/20 border-zinc-700 text-white" data-testid="input-nombre-informe">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[300px]">
                      {options?.informes_pentest?.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}
