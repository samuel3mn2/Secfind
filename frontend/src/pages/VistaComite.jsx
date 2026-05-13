import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Users,
  FileText,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  Clock,
  Image,
  Search,
  FolderOpen,
  Layers,
  Eye,
  ExternalLink,
  Loader2,
  Save,
  BookmarkCheck,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import html2canvas from "html2canvas";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color coding for ratios
const getRatioColor = (pending, total) => {
  if (total === 0) return "text-zinc-500";
  const ratio = pending / total;
  if (ratio === 0) return "text-green-500";
  if (ratio <= 0.25) return "text-green-400";
  if (ratio <= 0.5) return "text-yellow-500";
  if (ratio <= 0.75) return "text-orange-500";
  return "text-red-500";
};

const RatioCell = ({ pending, total }) => {
  if (total === 0) return <span className="text-zinc-600">-</span>;
  const color = getRatioColor(pending, total);
  return (
    <span className={`font-mono font-medium ${color}`}>
      {pending}/{total}
    </span>
  );
};

const PercentageCell = ({ pending, total }) => {
  if (total === 0) return <span className="text-zinc-600">-</span>;
  const percentage = Math.round((pending / total) * 100);
  const color = getRatioColor(pending, total);
  return (
    <span className={`font-mono font-medium ${color}`}>
      {percentage}%
    </span>
  );
};

export default function VistaComite() {
  const { isAdmin, canView } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [options, setOptions] = useState(null);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);
  
  // Grouping mode
  const [agruparPorGrupo, setAgruparPorGrupo] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupos, setSelectedGrupos] = useState([]);
  const [gruposPopoverOpen, setGruposPopoverOpen] = useState(false);
  const [grupoSearch, setGrupoSearch] = useState("");
  
  // Informes sin grupo (para modo mixto)
  const [informesSinGrupo, setInformesSinGrupo] = useState([]);
  const [selectedInformesSinGrupo, setSelectedInformesSinGrupo] = useState([]);
  const [informesSinGrupoPopoverOpen, setInformesSinGrupoPopoverOpen] = useState(false);
  const [informeSinGrupoSearch, setInformeSinGrupoSearch] = useState("");
  
  // Filters
  const [selectedInformes, setSelectedInformes] = useState([]);
  const [selectedSeveridades, setSelectedSeveridades] = useState(["Critica", "Alta", "Media", "Baja"]);
  const [informesPopoverOpen, setInformesPopoverOpen] = useState(false);
  const [informeSearch, setInformeSearch] = useState("");
  
  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailVulnerabilities, setDetailVulnerabilities] = useState([]);
  
  // Saved Views
  const [vistasGuardadas, setVistasGuardadas] = useState([]);
  const [saveViewModalOpen, setSaveViewModalOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");
  const [savingView, setSavingView] = useState(false);
  const [deleteViewConfirm, setDeleteViewConfirm] = useState(null);

  const canViewModule = isAdmin || canView("vulnerabilidades");

  // Clear search when popover closes
  useEffect(() => {
    if (!informesPopoverOpen) {
      setInformeSearch("");
    }
  }, [informesPopoverOpen]);

  useEffect(() => {
    if (!gruposPopoverOpen) {
      setGrupoSearch("");
    }
  }, [gruposPopoverOpen]);

  useEffect(() => {
    if (!informesSinGrupoPopoverOpen) {
      setInformeSinGrupoSearch("");
    }
  }, [informesSinGrupoPopoverOpen]);

  // Filter informes by search - use useMemo for better performance
  const filteredInformes = React.useMemo(() => {
    if (!informeSearch.trim()) return options?.informes_pentest || [];
    const searchLower = informeSearch.toLowerCase().trim();
    return (options?.informes_pentest || []).filter(
      informe => informe.toLowerCase().includes(searchLower)
    );
  }, [options?.informes_pentest, informeSearch]);

  // Filter grupos by search
  const filteredGrupos = React.useMemo(() => {
    if (!grupoSearch.trim()) return grupos;
    const searchLower = grupoSearch.toLowerCase().trim();
    return grupos.filter(g => g.nombre.toLowerCase().includes(searchLower));
  }, [grupos, grupoSearch]);

  // Filter informes sin grupo by search
  const filteredInformesSinGrupo = React.useMemo(() => {
    if (!informeSinGrupoSearch.trim()) return informesSinGrupo;
    const searchLower = informeSinGrupoSearch.toLowerCase().trim();
    return informesSinGrupo.filter(i => i.toLowerCase().includes(searchLower));
  }, [informesSinGrupo, informeSinGrupoSearch]);

  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      
      const [optionsRes, gruposRes, sinGrupoRes, vistasRes] = await Promise.all([
        axios.get(`${API}/dropdown-options`, { headers }),
        axios.get(`${API}/config/grupos-informes`, { headers }),
        axios.get(`${API}/config/informes-sin-grupo`, { headers }),
        axios.get(`${API}/vistas-guardadas`, { headers }),
      ]);
      
      setOptions(optionsRes.data);
      setGrupos(gruposRes.data);
      setInformesSinGrupo(sinGrupoRes.data);
      setVistasGuardadas(vistasRes.data);
      
      // Initially select all informes
      if (optionsRes.data.informes_pentest) {
        setSelectedInformes(optionsRes.data.informes_pentest);
      }
      // Initially select all grupos
      if (gruposRes.data.length > 0) {
        setSelectedGrupos(gruposRes.data.map(g => g.id));
      }
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchData = useCallback(async () => {
    // Check if we have selections based on mode
    if (agruparPorGrupo) {
      // In group mode, need at least grupos OR informes sin grupo selected
      if (selectedGrupos.length === 0 && selectedInformesSinGrupo.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }
    } else {
      if (selectedInformes.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem("token");
      const params = {
        severidades: selectedSeveridades.join(","),
        agrupar_por: agruparPorGrupo ? "grupo" : "informe",
      };
      
      if (agruparPorGrupo) {
        params.grupos = selectedGrupos.join(",");
        // Also include individual reports without group
        if (selectedInformesSinGrupo.length > 0) {
          params.informes_adicionales = selectedInformesSinGrupo.join(",");
        }
      } else {
        params.informes = selectedInformes.join(",");
      }
      
      const response = await axios.get(`${API}/vista-comite`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setData(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos del comité");
    } finally {
      setLoading(false);
    }
  }, [selectedInformes, selectedGrupos, selectedInformesSinGrupo, selectedSeveridades, agruparPorGrupo]);

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (options) {
      fetchData();
    }
  }, [fetchData, options]);

  const handleInformeToggle = (informe) => {
    setSelectedInformes(prev => 
      prev.includes(informe)
        ? prev.filter(i => i !== informe)
        : [...prev, informe]
    );
  };

  const handleSelectAllInformes = () => {
    if (options?.informes_pentest) {
      setSelectedInformes(options.informes_pentest);
    }
  };

  const handleClearInformes = () => {
    setSelectedInformes([]);
  };

  // Grupo handlers
  const handleGrupoToggle = (grupoId) => {
    setSelectedGrupos(prev =>
      prev.includes(grupoId)
        ? prev.filter(g => g !== grupoId)
        : [...prev, grupoId]
    );
  };

  const handleSelectAllGrupos = () => {
    setSelectedGrupos(grupos.map(g => g.id));
  };

  const handleClearGrupos = () => {
    setSelectedGrupos([]);
  };

  // Informes sin grupo handlers
  const handleInformeSinGrupoToggle = (informe) => {
    setSelectedInformesSinGrupo(prev =>
      prev.includes(informe)
        ? prev.filter(i => i !== informe)
        : [...prev, informe]
    );
  };

  const handleSelectAllInformesSinGrupo = () => {
    setSelectedInformesSinGrupo([...informesSinGrupo]);
  };

  const handleClearInformesSinGrupo = () => {
    setSelectedInformesSinGrupo([]);
  };

  // Toggle grouping mode
  const handleToggleGroupMode = (checked) => {
    setAgruparPorGrupo(checked);
    setSelectedInformesSinGrupo([]); // Reset informes sin grupo selection
    setLoading(true);
  };

  // Open detail modal
  const handleOpenDetail = async (row) => {
    setDetailData(row);
    setDetailModalOpen(true);
    setDetailLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      // Get vulnerabilities for this row
      const informesToFetch = row.es_grupo && row.informes_incluidos?.length > 0
        ? row.informes_incluidos
        : [row.informe];
      
      // Build URL with multiple informe_pentest params
      const params = new URLSearchParams();
      informesToFetch.forEach(inf => params.append("informe_pentest", inf));
      params.append("limit", "500");
      
      const response = await axios.get(`${API}/vulnerabilidades?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setDetailVulnerabilities(response.data.items || response.data || []);
    } catch (error) {
      console.error("Error fetching vulnerabilities:", error);
      toast.error("Error al cargar vulnerabilidades");
      setDetailVulnerabilities([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailData(null);
    setDetailVulnerabilities([]);
  };

  // Saved Views Functions
  const handleSaveView = async () => {
    if (!newViewName.trim()) {
      toast.error("El nombre de la vista es requerido");
      return;
    }
    
    setSavingView(true);
    try {
      const token = localStorage.getItem("token");
      const viewData = {
        nombre: newViewName.trim(),
        descripcion: newViewDescription.trim() || null,
        agrupar_por_grupo: agruparPorGrupo,
        grupos_ids: selectedGrupos,
        informes_adicionales: selectedInformesSinGrupo,
        informes_individuales: selectedInformes,
        severidades: selectedSeveridades,
      };
      
      const response = await axios.post(`${API}/vistas-guardadas`, viewData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setVistasGuardadas(prev => [...prev, response.data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      toast.success("Vista guardada exitosamente");
      setSaveViewModalOpen(false);
      setNewViewName("");
      setNewViewDescription("");
    } catch (error) {
      console.error("Error saving view:", error);
      toast.error(error.response?.data?.detail || "Error al guardar la vista");
    } finally {
      setSavingView(false);
    }
  };

  const handleLoadView = (vista) => {
    // Apply the saved view configuration
    setAgruparPorGrupo(vista.agrupar_por_grupo);
    setSelectedSeveridades(vista.severidades || ["Critica", "Alta", "Media", "Baja"]);
    
    if (vista.agrupar_por_grupo) {
      setSelectedGrupos(vista.grupos_ids || []);
      setSelectedInformesSinGrupo(vista.informes_adicionales || []);
    } else {
      setSelectedInformes(vista.informes_individuales || []);
    }
    
    setLoading(true);
    toast.success(`Vista "${vista.nombre}" cargada`);
  };

  const handleDeleteView = async (vista) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/vistas-guardadas/${vista.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setVistasGuardadas(prev => prev.filter(v => v.id !== vista.id));
      setDeleteViewConfirm(null);
      toast.success("Vista eliminada");
    } catch (error) {
      console.error("Error deleting view:", error);
      toast.error("Error al eliminar la vista");
    }
  };

  const handleSeveridadToggle = (severidad) => {
    setSelectedSeveridades(prev =>
      prev.includes(severidad)
        ? prev.filter(s => s !== severidad)
        : [...prev, severidad]
    );
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const exportToCSV = () => {
    if (data.length === 0) return;
    
    // Helper to escape CSV cell values that contain commas
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const headers = ["Informe/Alcance"];
    if (selectedSeveridades.includes("Critica")) headers.push("Crítico");
    if (selectedSeveridades.includes("Alta")) headers.push("Alto");
    if (selectedSeveridades.includes("Media")) headers.push("Medio");
    if (selectedSeveridades.includes("Baja")) headers.push("Bajo");
    headers.push("Responsable", "Tiempo Activo (meses)", "Pendiente/Total", "% Pendiente");

    const rows = data.map(row => {
      const cells = [escapeCSV(row.informe)];
      if (selectedSeveridades.includes("Critica")) cells.push(`${row.criticas_pendientes}/${row.criticas_total}`);
      if (selectedSeveridades.includes("Alta")) cells.push(`${row.altas_pendientes}/${row.altas_total}`);
      if (selectedSeveridades.includes("Media")) cells.push(`${row.medias_pendientes}/${row.medias_total}`);
      if (selectedSeveridades.includes("Baja")) cells.push(`${row.bajas_pendientes}/${row.bajas_total}`);
      cells.push(escapeCSV(row.responsable) || "-");
      cells.push(row.tiempo_activo_meses !== null ? row.tiempo_activo_meses : "-");
      // Calculate totals based on selected severities
      let pendientes = 0;
      let hallazgos = 0;
      if (selectedSeveridades.includes("Critica")) {
        pendientes += row.criticas_pendientes;
        hallazgos += row.criticas_total;
      }
      if (selectedSeveridades.includes("Alta")) {
        pendientes += row.altas_pendientes;
        hallazgos += row.altas_total;
      }
      if (selectedSeveridades.includes("Media")) {
        pendientes += row.medias_pendientes;
        hallazgos += row.medias_total;
      }
      if (selectedSeveridades.includes("Baja")) {
        pendientes += row.bajas_pendientes;
        hallazgos += row.bajas_total;
      }
      cells.push(`${pendientes}/${hallazgos}`);
      const pct = hallazgos > 0 ? Math.round((pendientes / hallazgos) * 100) : 0;
      cells.push(`${pct}%`);
      return cells;
    });

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vista_comite_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado a CSV");
  };

  const exportToImage = async () => {
    if (!tableRef.current || data.length === 0) return;
    
    setExporting(true);
    try {
      // Add export mode class for light-friendly colors
      tableRef.current.classList.add("export-mode");
      
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      // Remove export mode class
      tableRef.current.classList.remove("export-mode");
      
      const link = document.createElement("a");
      link.download = `vista_comite_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Imagen descargada para PowerPoint");
    } catch (error) {
      console.error("Error exporting image:", error);
      toast.error("Error al exportar imagen");
      tableRef.current?.classList.remove("export-mode");
    } finally {
      setExporting(false);
    }
  };

  // Helper function to calculate totals based on selected severities
  const calcRowTotals = (row) => {
    let pendientes = 0;
    let hallazgos = 0;
    if (selectedSeveridades.includes("Critica")) {
      pendientes += row.criticas_pendientes;
      hallazgos += row.criticas_total;
    }
    if (selectedSeveridades.includes("Alta")) {
      pendientes += row.altas_pendientes;
      hallazgos += row.altas_total;
    }
    if (selectedSeveridades.includes("Media")) {
      pendientes += row.medias_pendientes;
      hallazgos += row.medias_total;
    }
    if (selectedSeveridades.includes("Baja")) {
      pendientes += row.bajas_pendientes;
      hallazgos += row.bajas_total;
    }
    return { pendientes, hallazgos };
  };

  // Calculate totals based on selected severities
  const totals = data.reduce((acc, row) => {
    if (selectedSeveridades.includes("Critica")) {
      acc.criticas_pendientes += row.criticas_pendientes;
      acc.criticas_total += row.criticas_total;
    }
    if (selectedSeveridades.includes("Alta")) {
      acc.altas_pendientes += row.altas_pendientes;
      acc.altas_total += row.altas_total;
    }
    if (selectedSeveridades.includes("Media")) {
      acc.medias_pendientes += row.medias_pendientes;
      acc.medias_total += row.medias_total;
    }
    if (selectedSeveridades.includes("Baja")) {
      acc.bajas_pendientes += row.bajas_pendientes;
      acc.bajas_total += row.bajas_total;
    }
    // Totals based on selected severities only
    const rowTotals = calcRowTotals(row);
    acc.total_pendientes += rowTotals.pendientes;
    acc.total_hallazgos += rowTotals.hallazgos;
    return acc;
  }, {
    criticas_pendientes: 0, criticas_total: 0,
    altas_pendientes: 0, altas_total: 0,
    medias_pendientes: 0, medias_total: 0,
    bajas_pendientes: 0, bajas_total: 0,
    total_pendientes: 0, total_hallazgos: 0
  });

  if (!canViewModule) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <div className="text-center text-zinc-500 py-12">
          No tiene permisos para ver este módulo
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="vista-comite-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Vista Comité
          </h1>
          <p className="text-zinc-500 mt-1">
            Resumen ejecutivo de vulnerabilidades por informe de pentest
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Saved Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-green-700 text-green-300 hover:bg-green-900/30"
                data-testid="saved-views-btn"
              >
                <BookmarkCheck className="w-4 h-4 mr-2" />
                Vistas
                {vistasGuardadas.length > 0 && (
                  <span className="ml-1 text-xs bg-green-500/30 px-1.5 py-0.5 rounded">
                    {vistasGuardadas.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-700">
              <DropdownMenuItem
                onClick={() => setSaveViewModalOpen(true)}
                className="text-green-400 focus:text-green-300 focus:bg-green-500/10 cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar vista actual
              </DropdownMenuItem>
              {vistasGuardadas.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-zinc-700" />
                  {vistasGuardadas.map((vista) => (
                    <div key={vista.id} className="flex items-center group">
                      <DropdownMenuItem
                        onClick={() => handleLoadView(vista)}
                        className="flex-1 text-zinc-300 focus:text-white focus:bg-white/10 cursor-pointer pr-2"
                      >
                        <BookmarkCheck className="w-4 h-4 mr-2 text-indigo-400" />
                        <span className="truncate">{vista.nombre}</span>
                      </DropdownMenuItem>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteViewConfirm(vista);
                        }}
                        className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {vistasGuardadas.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-zinc-500">
                  No hay vistas guardadas
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="refresh-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={data.length === 0}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="export-csv-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={exportToImage}
            disabled={data.length === 0 || exporting}
            className="border-indigo-700 text-indigo-300 hover:bg-indigo-900/30"
            data-testid="export-image-btn"
          >
            <Image className="w-4 h-4 mr-2" />
            {exporting ? "Exportando..." : "Imagen PPT"}
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Críticas Pendientes</p>
                <p className="text-xl font-bold text-red-500">
                  {totals.criticas_pendientes}/{totals.criticas_total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Altas Pendientes</p>
                <p className="text-xl font-bold text-orange-500">
                  {totals.altas_pendientes}/{totals.altas_total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Total Pendientes</p>
                <p className="text-xl font-bold text-indigo-500">
                  {totals.total_pendientes}/{totals.total_hallazgos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">% Pendiente Global</p>
                <p className="text-xl font-bold text-yellow-500">
                  {totals.total_hallazgos > 0 
                    ? Math.round((totals.total_pendientes / totals.total_hallazgos) * 100) 
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">Filtros:</span>
            </div>

            {/* Grouping Mode Toggle */}
            {grupos.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-lg border border-zinc-700">
                      <Layers className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm text-zinc-400">Agrupar:</span>
                      <Switch
                        checked={agruparPorGrupo}
                        onCheckedChange={handleToggleGroupMode}
                        data-testid="toggle-agrupar"
                      />
                      <span className={`text-sm ${agruparPorGrupo ? 'text-indigo-400' : 'text-zinc-500'}`}>
                        {agruparPorGrupo ? 'Por Grupo' : 'Individual'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-800 border-zinc-700">
                    <p className="text-sm">
                      {agruparPorGrupo 
                        ? "Mostrando informes consolidados por grupo" 
                        : "Mostrando cada informe individualmente"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Grupos Filter (when grouping mode is on) */}
            {agruparPorGrupo && grupos.length > 0 && (
              <Popover open={gruposPopoverOpen} onOpenChange={setGruposPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-indigo-700 text-indigo-300 hover:bg-indigo-900/30 min-w-[200px] justify-between"
                    data-testid="filter-grupos"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    <span className="truncate">
                      {selectedGrupos.length === 0
                        ? "Seleccionar grupos..."
                        : selectedGrupos.length === grupos.length
                          ? "Todos los grupos"
                          : `${selectedGrupos.length} grupos`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] bg-zinc-900 border-zinc-700 p-0" align="start">
                  <div className="p-3 border-b border-zinc-700 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        placeholder="Buscar grupo..."
                        value={grupoSearch}
                        onChange={(e) => setGrupoSearch(e.target.value)}
                        className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllGrupos}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <Check className="w-3 h-3 mr-1" /> Todos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearGrupos}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3 mr-1" /> Ninguno
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-2 space-y-1">
                      {filteredGrupos.map((grupo) => (
                        <div
                          key={grupo.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                          onClick={() => handleGrupoToggle(grupo.id)}
                        >
                          <Checkbox
                            checked={selectedGrupos.includes(grupo.id)}
                            onCheckedChange={() => handleGrupoToggle(grupo.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <Label className="text-sm text-zinc-300 cursor-pointer font-medium">
                              {grupo.nombre}
                            </Label>
                            <p className="text-xs text-zinc-500">
                              {grupo.informes?.length || 0} informes
                            </p>
                          </div>
                        </div>
                      ))}
                      {filteredGrupos.length === 0 && (
                        <p className="text-center text-zinc-500 py-4 text-sm">
                          {grupoSearch ? "No se encontraron grupos" : "No hay grupos creados"}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            {/* Informes sin grupo (in group mode - to add individual reports) */}
            {agruparPorGrupo && informesSinGrupo.length > 0 && (
              <Popover open={informesSinGrupoPopoverOpen} onOpenChange={setInformesSinGrupoPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/30 min-w-[180px] justify-between"
                    data-testid="filter-informes-sin-grupo"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    <span className="truncate">
                      {selectedInformesSinGrupo.length === 0
                        ? "Agregar informes..."
                        : `+${selectedInformesSinGrupo.length} informes`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] bg-zinc-900 border-zinc-700 p-0" align="start">
                  <div className="p-3 border-b border-zinc-700 space-y-2">
                    <p className="text-xs text-yellow-400 mb-2">
                      Añade informes individuales (sin grupo) a la vista
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        placeholder="Buscar informe..."
                        value={informeSinGrupoSearch}
                        onChange={(e) => setInformeSinGrupoSearch(e.target.value)}
                        className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllInformesSinGrupo}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <Check className="w-3 h-3 mr-1" /> Todos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearInformesSinGrupo}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3 mr-1" /> Ninguno
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[250px]">
                    <div className="p-2 space-y-1">
                      {filteredInformesSinGrupo.map((informe) => (
                        <div
                          key={informe}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                          onClick={() => handleInformeSinGrupoToggle(informe)}
                        >
                          <Checkbox
                            checked={selectedInformesSinGrupo.includes(informe)}
                            onCheckedChange={() => handleInformeSinGrupoToggle(informe)}
                          />
                          <Label className="text-sm text-zinc-300 cursor-pointer break-words whitespace-normal">
                            {informe}
                          </Label>
                        </div>
                      ))}
                      {filteredInformesSinGrupo.length === 0 && (
                        <p className="text-center text-zinc-500 py-4 text-sm">
                          {informeSinGrupoSearch ? "No se encontraron informes" : "No hay informes sin grupo"}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            {/* Informes Filter (when not grouping) */}
            {!agruparPorGrupo && (
              <Popover open={informesPopoverOpen} onOpenChange={setInformesPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 min-w-[200px] justify-between"
                    data-testid="filter-informes"
                  >
                    <span className="truncate">
                      {selectedInformes.length === 0 
                        ? "Seleccionar informes..." 
                        : selectedInformes.length === options?.informes_pentest?.length
                          ? "Todos los informes"
                          : `${selectedInformes.length} informes`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] bg-zinc-900 border-zinc-700 p-0" align="start">
                  <div className="p-3 border-b border-zinc-700 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <Input
                        placeholder="Buscar informe..."
                        value={informeSearch}
                        onChange={(e) => setInformeSearch(e.target.value)}
                        className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllInformes}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <Check className="w-3 h-3 mr-1" /> Todos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearInformes}
                        className="text-xs text-zinc-400 hover:text-white"
                      >
                        <X className="w-3 h-3 mr-1" /> Ninguno
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="p-2 space-y-1">
                      {filteredInformes.map((informe) => (
                        <div
                          key={informe}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                          onClick={() => handleInformeToggle(informe)}
                        >
                          <Checkbox
                            checked={selectedInformes.includes(informe)}
                            onCheckedChange={() => handleInformeToggle(informe)}
                          />
                          <Label className="text-sm text-zinc-300 cursor-pointer break-words whitespace-normal">
                            {informe}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            {/* Severidad Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">Severidades:</span>
              {[
                { key: "Critica", label: "Crítico", color: "bg-red-500/20 text-red-400 border-red-500/30" },
                { key: "Alta", label: "Alto", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
                { key: "Media", label: "Medio", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                { key: "Baja", label: "Bajo", color: "bg-green-500/20 text-green-400 border-green-500/30" },
              ].map(({ key, label, color }) => (
                <Badge
                  key={key}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    selectedSeveridades.includes(key)
                      ? color
                      : "bg-zinc-800 text-zinc-500 border-zinc-700"
                  }`}
                  onClick={() => handleSeveridadToggle(key)}
                  data-testid={`filter-sev-${key.toLowerCase()}`}
                >
                  {label}
                </Badge>
              ))}
            </div>

            <div className="ml-auto text-sm text-zinc-500">
              {data.length} informes
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>Lectura: Pendiente/Total</span>
        <span>•</span>
        <span>Ej: <span className="text-yellow-500 font-mono">1/7</span> = 1 pendiente de 7 hallazgos (6 finalizados)</span>
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]" ref={tableRef}>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-zinc-500">Cargando datos...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              Seleccione al menos un informe para ver los datos
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700 hover:bg-transparent">
                    <TableHead className="text-zinc-400 min-w-[250px]">Informe / Alcance</TableHead>
                    {selectedSeveridades.includes("Critica") && (
                      <TableHead className="text-red-400 text-center">Crítico</TableHead>
                    )}
                    {selectedSeveridades.includes("Alta") && (
                      <TableHead className="text-orange-400 text-center">Alto</TableHead>
                    )}
                    {selectedSeveridades.includes("Media") && (
                      <TableHead className="text-yellow-400 text-center">Medio</TableHead>
                    )}
                    {selectedSeveridades.includes("Baja") && (
                      <TableHead className="text-green-400 text-center">Bajo</TableHead>
                    )}
                    <TableHead className="text-zinc-400">Responsable</TableHead>
                    <TableHead className="text-zinc-400 text-center">T. Activo</TableHead>
                    <TableHead className="text-zinc-400 text-center">Pend./Total</TableHead>
                    <TableHead className="text-zinc-400 text-center">% Pend.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, idx) => (
                    <TableRow
                      key={idx}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer group"
                      data-testid={`comite-row-${idx}`}
                      onClick={() => handleOpenDetail(row)}
                    >
                      <TableCell className="text-white font-medium whitespace-normal break-words">
                        <div className="flex items-start gap-2">
                          {row.es_grupo && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                                  <FolderOpen className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-800 border-zinc-700 max-w-sm">
                                  <p className="font-medium text-indigo-400 mb-1">Grupo con {row.informes_incluidos?.length || 0} informes:</p>
                                  <ul className="text-xs text-zinc-300 space-y-0.5">
                                    {row.informes_incluidos?.slice(0, 5).map((inf, i) => (
                                      <li key={i}>• {inf}</li>
                                    ))}
                                    {(row.informes_incluidos?.length || 0) > 5 && (
                                      <li className="text-zinc-500">... y {row.informes_incluidos.length - 5} más</li>
                                    )}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <span className="group-hover:text-indigo-400 transition-colors">{row.informe}</span>
                          <Eye className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0" />
                        </div>
                      </TableCell>
                      {selectedSeveridades.includes("Critica") && (
                        <TableCell className="text-center">
                          <RatioCell pending={row.criticas_pendientes} total={row.criticas_total} />
                        </TableCell>
                      )}
                      {selectedSeveridades.includes("Alta") && (
                        <TableCell className="text-center">
                          <RatioCell pending={row.altas_pendientes} total={row.altas_total} />
                        </TableCell>
                      )}
                      {selectedSeveridades.includes("Media") && (
                        <TableCell className="text-center">
                          <RatioCell pending={row.medias_pendientes} total={row.medias_total} />
                        </TableCell>
                      )}
                      {selectedSeveridades.includes("Baja") && (
                        <TableCell className="text-center">
                          <RatioCell pending={row.bajas_pendientes} total={row.bajas_total} />
                        </TableCell>
                      )}
                      <TableCell className="text-zinc-300">
                        {row.responsable || <span className="text-zinc-600">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.tiempo_activo_meses !== null ? (
                          <span className={`font-mono ${row.tiempo_activo_meses >= 12 ? 'text-red-400' : row.tiempo_activo_meses >= 6 ? 'text-orange-400' : 'text-zinc-300'}`}>
                            {row.tiempo_activo_meses} {row.tiempo_activo_meses === 1 ? 'mes' : 'meses'}
                          </span>
                        ) : <span className="text-zinc-600">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const { pendientes, hallazgos } = calcRowTotals(row);
                          return <RatioCell pending={pendientes} total={hallazgos} />;
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const { pendientes, hallazgos } = calcRowTotals(row);
                          return <PercentageCell pending={pendientes} total={hallazgos} />;
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Row */}
                  <TableRow className="border-zinc-700 bg-zinc-800/50 font-bold">
                    <TableCell className="text-white">TOTALES</TableCell>
                    {selectedSeveridades.includes("Critica") && (
                      <TableCell className="text-center">
                        <RatioCell pending={totals.criticas_pendientes} total={totals.criticas_total} />
                      </TableCell>
                    )}
                    {selectedSeveridades.includes("Alta") && (
                      <TableCell className="text-center">
                        <RatioCell pending={totals.altas_pendientes} total={totals.altas_total} />
                      </TableCell>
                    )}
                    {selectedSeveridades.includes("Media") && (
                      <TableCell className="text-center">
                        <RatioCell pending={totals.medias_pendientes} total={totals.medias_total} />
                      </TableCell>
                    )}
                    {selectedSeveridades.includes("Baja") && (
                      <TableCell className="text-center">
                        <RatioCell pending={totals.bajas_pendientes} total={totals.bajas_total} />
                      </TableCell>
                    )}
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-center">
                      <RatioCell pending={totals.total_pendientes} total={totals.total_hallazgos} />
                    </TableCell>
                    <TableCell className="text-center">
                      <PercentageCell pending={totals.total_pendientes} total={totals.total_hallazgos} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {detailData?.es_grupo ? (
                <FolderOpen className="w-5 h-5 text-indigo-400" />
              ) : (
                <FileText className="w-5 h-5 text-indigo-400" />
              )}
              {detailData?.informe}
            </DialogTitle>
          </DialogHeader>
          
          {/* Summary badges */}
          {detailData && (
            <div className="flex flex-wrap gap-2 py-2 border-b border-zinc-800">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                Críticas: {detailData.criticas_pendientes}/{detailData.criticas_total}
              </Badge>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                Altas: {detailData.altas_pendientes}/{detailData.altas_total}
              </Badge>
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                Medias: {detailData.medias_pendientes}/{detailData.medias_total}
              </Badge>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Bajas: {detailData.bajas_pendientes}/{detailData.bajas_total}
              </Badge>
              {detailData.es_grupo && detailData.informes_incluidos?.length > 0 && (
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                  {detailData.informes_incluidos.length} informes incluidos
                </Badge>
              )}
            </div>
          )}

          {/* Vulnerabilities table */}
          <ScrollArea className="flex-1 overflow-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : detailVulnerabilities.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                No se encontraron vulnerabilidades
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700 hover:bg-transparent">
                    <TableHead className="text-zinc-400 w-[80px]">Código</TableHead>
                    <TableHead className="text-zinc-400">Vulnerabilidad</TableHead>
                    <TableHead className="text-zinc-400 w-[90px]">Severidad</TableHead>
                    <TableHead className="text-zinc-400 w-[100px]">Estatus</TableHead>
                    <TableHead className="text-zinc-400">Responsable</TableHead>
                    {detailData?.es_grupo && (
                      <TableHead className="text-zinc-400">Informe</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailVulnerabilities.map((vuln, idx) => (
                    <TableRow key={vuln.id || idx} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="text-zinc-400 font-mono text-xs">
                        {vuln.codigo || "-"}
                      </TableCell>
                      <TableCell className="text-white max-w-[300px]">
                        <p className="truncate" title={vuln.vulnerabilidad}>
                          {vuln.vulnerabilidad || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            vuln.severidad === "Critica" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            vuln.severidad === "Alta" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                            vuln.severidad === "Media" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                            "bg-green-500/20 text-green-400 border-green-500/30"
                          }
                        >
                          {vuln.severidad || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            vuln.estatus === "Cerrado" || vuln.estatus === "Corregido" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                            vuln.estatus === "Pendiente" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            vuln.estatus === "En Proceso" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                            "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          }
                        >
                          {vuln.estatus || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">
                        {vuln.responsable || "-"}
                      </TableCell>
                      {detailData?.es_grupo && (
                        <TableCell className="text-zinc-400 text-xs max-w-[150px] truncate" title={vuln.nombre_informe_pentest}>
                          {vuln.nombre_informe_pentest || "-"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <span className="text-sm text-zinc-500">
              {detailVulnerabilities.length} vulnerabilidades
            </span>
            <Button
              variant="outline"
              onClick={closeDetailModal}
              className="border-zinc-700 text-zinc-300"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save View Modal */}
      <Dialog open={saveViewModalOpen} onOpenChange={setSaveViewModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Save className="w-5 h-5 text-green-400" />
              Guardar Vista Actual
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre de la vista *</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Ej: Comité Q4 2024"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-view-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-zinc-300">Descripción (opcional)</Label>
              <Input
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
                placeholder="Descripción de la vista..."
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            
            <div className="text-xs text-zinc-500 bg-zinc-800/50 p-3 rounded-lg space-y-1">
              <p className="font-medium text-zinc-400">Se guardará:</p>
              <p>• Modo: {agruparPorGrupo ? "Por Grupo" : "Individual"}</p>
              {agruparPorGrupo ? (
                <>
                  <p>• {selectedGrupos.length} grupos seleccionados</p>
                  <p>• {selectedInformesSinGrupo.length} informes adicionales</p>
                </>
              ) : (
                <p>• {selectedInformes.length} informes seleccionados</p>
              )}
              <p>• Severidades: {selectedSeveridades.join(", ")}</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setSaveViewModalOpen(false);
                setNewViewName("");
                setNewViewDescription("");
              }}
              className="border-zinc-700 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveView}
              disabled={savingView || !newViewName.trim()}
              className="bg-green-600 hover:bg-green-700"
              data-testid="btn-save-view"
            >
              {savingView ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete View Confirmation */}
      <AlertDialog open={!!deleteViewConfirm} onOpenChange={() => setDeleteViewConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              ¿Eliminar vista guardada?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esto eliminará permanentemente la vista "{deleteViewConfirm?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteView(deleteViewConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
