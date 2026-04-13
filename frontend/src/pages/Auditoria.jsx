import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  History,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  RefreshCw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Auditoria() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Filters
  const [filterEntidad, setFilterEntidad] = useState("");
  const [filterAccion, setFilterAccion] = useState("");
  const [filterUsuario, setFilterUsuario] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  
  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", itemsPerPage);
      params.append("skip", (currentPage - 1) * itemsPerPage);
      
      if (filterEntidad && filterEntidad !== "all") params.append("entidad", filterEntidad);
      if (filterAccion && filterAccion !== "all") params.append("accion", filterAccion);
      if (filterUsuario) params.append("usuario", filterUsuario);
      if (filterFechaDesde) params.append("fecha_desde", filterFechaDesde);
      if (filterFechaHasta) params.append("fecha_hasta", filterFechaHasta);

      const response = await axios.get(`${API}/historial?${params.toString()}`);
      setHistorial(response.data.historial);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error fetching historial:", error);
      toast.error("Error al cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, filterEntidad, filterAccion, filterUsuario, filterFechaDesde, filterFechaHasta]);

  useEffect(() => {
    fetchHistorial();
  }, [fetchHistorial]);

  const totalPages = Math.ceil(total / itemsPerPage);

  const getAccionIcon = (accion) => {
    switch (accion) {
      case "crear":
        return <Plus className="w-4 h-4 text-green-400" />;
      case "actualizar":
        return <Pencil className="w-4 h-4 text-blue-400" />;
      case "eliminar":
        return <Trash2 className="w-4 h-4 text-red-400" />;
      default:
        return <History className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getAccionBadge = (accion) => {
    const colors = {
      crear: "bg-green-500/20 text-green-400 border-green-500/30",
      actualizar: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      eliminar: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colors[accion] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  };

  const getEntidadBadge = (entidad) => {
    const colors = {
      vulnerabilidad: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      institucion: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      aplicacion: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      proveedor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      informe_pentest: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      usuario: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    };
    return colors[entidad] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFieldName = (field) => {
    const names = {
      estatus: "Estatus",
      severidad: "Severidad",
      responsable: "Responsable",
      fecha_compromiso: "Fecha Compromiso",
      descripcion_riesgo: "Descripción",
      recomendaciones: "Recomendaciones",
      vulnerabilidad: "Nombre",
      institucion: "Institución",
      aplicaciones: "Aplicaciones",
      proveedor: "Proveedor",
      nombre_informe_pentest: "Informe Pentest",
    };
    return names[field] || field;
  };

  const clearFilters = () => {
    setFilterEntidad("");
    setFilterAccion("");
    setFilterUsuario("");
    setFilterFechaDesde("");
    setFilterFechaHasta("");
    setCurrentPage(1);
  };

  const hasFilters = filterEntidad || filterAccion || filterUsuario || filterFechaDesde || filterFechaHasta;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
        <p>Solo administradores pueden ver el historial de cambios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-7 h-7 text-indigo-400" />
            Auditoría del Sistema
          </h1>
          <p className="text-zinc-400 mt-1">
            Historial de todos los cambios realizados en el sistema
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchHistorial}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>

            <Select value={filterEntidad} onValueChange={setFilterEntidad}>
              <SelectTrigger className="w-[150px] bg-black/20 border-zinc-700 text-white" data-testid="filter-entidad">
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="vulnerabilidad">Vulnerabilidad</SelectItem>
                <SelectItem value="institucion">Institución</SelectItem>
                <SelectItem value="aplicacion">Aplicación</SelectItem>
                <SelectItem value="proveedor">Proveedor</SelectItem>
                <SelectItem value="informe_pentest">Informe Pentest</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterAccion} onValueChange={setFilterAccion}>
              <SelectTrigger className="w-[150px] bg-black/20 border-zinc-700 text-white" data-testid="filter-accion">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="crear">Crear</SelectItem>
                <SelectItem value="actualizar">Actualizar</SelectItem>
                <SelectItem value="eliminar">Eliminar</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Usuario..."
                value={filterUsuario}
                onChange={(e) => setFilterUsuario(e.target.value)}
                className="pl-9 w-[150px] bg-black/20 border-zinc-700 text-white"
                data-testid="filter-usuario"
              />
            </div>

            <Input
              type="date"
              value={filterFechaDesde}
              onChange={(e) => setFilterFechaDesde(e.target.value)}
              className="w-[150px] bg-black/20 border-zinc-700 text-white"
              data-testid="filter-fecha-desde"
            />

            <Input
              type="date"
              value={filterFechaHasta}
              onChange={(e) => setFilterFechaHasta(e.target.value)}
              className="w-[150px] bg-black/20 border-zinc-700 text-white"
              data-testid="filter-fecha-hasta"
            />

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-zinc-400 hover:text-white"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-zinc-400">
        <span>{total} registros encontrados</span>
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-zinc-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              No hay registros en el historial
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Fecha/Hora</TableHead>
                  <TableHead className="text-zinc-400">Usuario</TableHead>
                  <TableHead className="text-zinc-400">Acción</TableHead>
                  <TableHead className="text-zinc-400">Entidad</TableHead>
                  <TableHead className="text-zinc-400">Descripción</TableHead>
                  <TableHead className="text-zinc-400 text-center">Cambios</TableHead>
                  <TableHead className="text-zinc-400 text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-zinc-300 font-mono text-sm">
                      {formatDate(item.timestamp)}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {item.usuario_nombre}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAccionIcon(item.accion)}
                        <Badge
                          variant="outline"
                          className={getAccionBadge(item.accion)}
                        >
                          {item.accion}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getEntidadBadge(item.entidad)}
                      >
                        {item.entidad}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-300 max-w-[300px] truncate">
                      {item.entidad_nombre || item.entidad_id?.slice(0, 8) + "..."}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.cambios && item.cambios.length > 0 ? (
                        <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                          {item.cambios.length} campo{item.cambios.length > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.cambios && item.cambios.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDetailModal(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Detalle del Cambio
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Fecha:</span>
                  <p className="text-white">{formatDate(selectedItem.timestamp)}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Usuario:</span>
                  <p className="text-white">{selectedItem.usuario_nombre}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Entidad:</span>
                  <p className="text-white capitalize">{selectedItem.entidad}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Acción:</span>
                  <p className="text-white capitalize">{selectedItem.accion}</p>
                </div>
              </div>

              {selectedItem.entidad_nombre && (
                <div>
                  <span className="text-zinc-500 text-sm">Elemento:</span>
                  <p className="text-white">{selectedItem.entidad_nombre}</p>
                </div>
              )}

              {selectedItem.cambios && selectedItem.cambios.length > 0 && (
                <div>
                  <span className="text-zinc-500 text-sm block mb-2">Cambios realizados:</span>
                  <div className="space-y-2">
                    {selectedItem.cambios.map((cambio, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700"
                      >
                        <div className="text-indigo-400 font-medium text-sm mb-1">
                          {formatFieldName(cambio.campo)}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-zinc-500 text-xs">Antes:</span>
                            <p className="text-red-400 break-words">
                              {cambio.valor_anterior !== null && cambio.valor_anterior !== undefined
                                ? Array.isArray(cambio.valor_anterior)
                                  ? cambio.valor_anterior.join(", ") || "(vacío)"
                                  : String(cambio.valor_anterior) || "(vacío)"
                                : "(vacío)"}
                            </p>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs">Después:</span>
                            <p className="text-green-400 break-words">
                              {cambio.valor_nuevo !== null && cambio.valor_nuevo !== undefined
                                ? Array.isArray(cambio.valor_nuevo)
                                  ? cambio.valor_nuevo.join(", ") || "(vacío)"
                                  : String(cambio.valor_nuevo) || "(vacío)"
                                : "(vacío)"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
