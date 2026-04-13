import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import html2canvas from "html2canvas";
import { useRef } from "react";

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
  
  // Filters
  const [selectedInformes, setSelectedInformes] = useState([]);
  const [selectedSeveridades, setSelectedSeveridades] = useState(["Critica", "Alta", "Media", "Baja"]);
  const [informesPopoverOpen, setInformesPopoverOpen] = useState(false);

  const canViewModule = isAdmin || canView("vulnerabilidades");

  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/dropdown-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOptions(response.data);
      // Initially select all informes
      if (response.data.informes_pentest) {
        setSelectedInformes(response.data.informes_pentest);
      }
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const fetchData = useCallback(async () => {
    if (selectedInformes.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/vista-comite`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          informes: selectedInformes.join(","),
          severidades: selectedSeveridades.join(",")
        }
      });
      setData(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos del comité");
    } finally {
      setLoading(false);
    }
  }, [selectedInformes, selectedSeveridades]);

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
    
    const headers = ["Informe/Alcance"];
    if (selectedSeveridades.includes("Critica")) headers.push("Crítico");
    if (selectedSeveridades.includes("Alta")) headers.push("Alto");
    if (selectedSeveridades.includes("Media")) headers.push("Medio");
    if (selectedSeveridades.includes("Baja")) headers.push("Bajo");
    headers.push("Responsable", "Tiempo Activo (meses)", "Pendiente/Total", "% Pendiente");

    const rows = data.map(row => {
      const cells = [row.informe];
      if (selectedSeveridades.includes("Critica")) cells.push(`${row.criticas_pendientes}/${row.criticas_total}`);
      if (selectedSeveridades.includes("Alta")) cells.push(`${row.altas_pendientes}/${row.altas_total}`);
      if (selectedSeveridades.includes("Media")) cells.push(`${row.medias_pendientes}/${row.medias_total}`);
      if (selectedSeveridades.includes("Baja")) cells.push(`${row.bajas_pendientes}/${row.bajas_total}`);
      cells.push(row.responsable || "-");
      cells.push(row.tiempo_activo_meses !== null ? row.tiempo_activo_meses : "-");
      cells.push(`${row.total_pendientes}/${row.total_hallazgos}`);
      const pct = row.total_hallazgos > 0 ? Math.round((row.total_pendientes / row.total_hallazgos) * 100) : 0;
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

  // Calculate totals
  const totals = data.reduce((acc, row) => {
    acc.criticas_pendientes += row.criticas_pendientes;
    acc.criticas_total += row.criticas_total;
    acc.altas_pendientes += row.altas_pendientes;
    acc.altas_total += row.altas_total;
    acc.medias_pendientes += row.medias_pendientes;
    acc.medias_total += row.medias_total;
    acc.bajas_pendientes += row.bajas_pendientes;
    acc.bajas_total += row.bajas_total;
    acc.total_pendientes += row.total_pendientes;
    acc.total_hallazgos += row.total_hallazgos;
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
        <div className="flex gap-2">
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

            {/* Informes Filter */}
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
              <PopoverContent className="w-[350px] bg-zinc-900 border-zinc-700 p-0" align="start">
                <div className="p-3 border-b border-zinc-700">
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
                <ScrollArea className="h-[250px]">
                  <div className="p-2 space-y-1">
                    {options?.informes_pentest?.map((informe) => (
                      <div
                        key={informe}
                        className="flex items-center space-x-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                        onClick={() => handleInformeToggle(informe)}
                      >
                        <Checkbox
                          checked={selectedInformes.includes(informe)}
                          onCheckedChange={() => handleInformeToggle(informe)}
                        />
                        <Label className="text-sm text-zinc-300 cursor-pointer truncate">
                          {informe.length > 45 ? informe.substring(0, 45) + "..." : informe}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

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
                      className="border-zinc-800 hover:bg-zinc-800/50"
                      data-testid={`comite-row-${idx}`}
                    >
                      <TableCell className="text-white font-medium">
                        {row.informe.length > 50 ? row.informe.substring(0, 50) + "..." : row.informe}
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
                        <RatioCell pending={row.total_pendientes} total={row.total_hallazgos} />
                      </TableCell>
                      <TableCell className="text-center">
                        <PercentageCell pending={row.total_pendientes} total={row.total_hallazgos} />
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
    </div>
  );
}
