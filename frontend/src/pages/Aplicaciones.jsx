import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppWindow, Plus, Pencil, Trash2, CheckCircle, XCircle, Search } from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Aplicaciones() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [aplicaciones, setAplicaciones] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({ nombre: "" });
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchAplicaciones();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredApps(
        aplicaciones.filter((app) =>
          app.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredApps(aplicaciones);
    }
  }, [searchTerm, aplicaciones]);

  const fetchAplicaciones = async () => {
    try {
      const response = await axios.get(`${API}/config/aplicaciones`);
      setAplicaciones(response.data);
      setFilteredApps(response.data);
    } catch (error) {
      console.error("Error fetching aplicaciones:", error);
      toast.error("Error al cargar aplicaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (app = null) => {
    if (app) {
      setEditingApp(app);
      setFormData({ nombre: app.nombre });
    } else {
      setEditingApp(null);
      setFormData({ nombre: "" });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingApp(null);
    setFormData({ nombre: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      if (editingApp) {
        await axios.put(`${API}/config/aplicaciones/${editingApp.id}`, formData);
        toast.success("Aplicación actualizada exitosamente");
      } else {
        await axios.post(`${API}/config/aplicaciones`, formData);
        toast.success("Aplicación creada exitosamente");
      }
      handleCloseModal();
      fetchAplicaciones();
    } catch (error) {
      console.error("Error saving:", error);
      const message = error.response?.data?.detail || "Error al guardar";
      toast.error(message);
    }
  };

  const handleToggleActive = async (app) => {
    try {
      await axios.put(`${API}/config/aplicaciones/${app.id}`, {
        activo: !app.activo,
      });
      toast.success(app.activo ? "Aplicación desactivada" : "Aplicación activada");
      fetchAplicaciones();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/config/aplicaciones/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Aplicación eliminada exitosamente");
      setDeletingItem(null);
      fetchAplicaciones();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  const canModify = isAdmin || canEdit("configuracion");
  const canRemove = isAdmin || canDelete("configuracion");
  const canAdd = isAdmin || canCreate("configuracion");

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="aplicaciones-page">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <AppWindow className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Aplicaciones</CardTitle>
                <CardDescription className="text-zinc-500">
                  Catálogo de aplicaciones para asignar a vulnerabilidades ({aplicaciones.length} registros)
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Buscar aplicación..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px] bg-black/20 border-zinc-700 text-white"
                />
              </div>
              {canAdd && (
                <Button
                  onClick={() => handleOpenModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="add-aplicacion-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Aplicación
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-700 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Nombre</TableHead>
                  <TableHead className="text-zinc-400">Estado</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-zinc-500">
                      {searchTerm ? "No se encontraron aplicaciones" : "No hay aplicaciones configuradas"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApps.map((app) => (
                    <TableRow
                      key={app.id}
                      className="border-zinc-800 hover:bg-white/5"
                      data-testid={`app-row-${app.id}`}
                    >
                      <TableCell className="text-white font-medium font-mono">
                        {app.nombre}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {canModify && (
                            <Switch
                              checked={app.activo}
                              onCheckedChange={() => handleToggleActive(app)}
                              data-testid={`toggle-app-${app.id}`}
                            />
                          )}
                          <span className={`flex items-center gap-1 text-sm ${app.activo ? "text-green-500" : "text-zinc-500"}`}>
                            {app.activo ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" />
                                Activo
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Inactivo
                              </>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canModify && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
                              onClick={() => handleOpenModal(app)}
                              data-testid={`edit-app-btn-${app.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                              onClick={() => setDeletingItem(app)}
                              data-testid={`delete-app-btn-${app.id}`}
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
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white">
          <DialogHeader>
            <DialogTitle>
              {editingApp ? "Editar Aplicación" : "Nueva Aplicación"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre de la aplicación (ej: MBP, IBE)"
                className="bg-black/20 border-zinc-700 text-white font-mono"
                data-testid="input-nombre-aplicacion"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                className="border-zinc-700 text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="save-aplicacion-btn"
              >
                {editingApp ? "Guardar Cambios" : "Crear Aplicación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete with Justification Modal */}
      <DeleteWithJustificationModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        itemName={deletingItem?.nombre}
        itemType="la aplicación"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
