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
import { Building2, Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Instituciones() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [instituciones, setInstituciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInst, setEditingInst] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({ nombre: "" });

  useEffect(() => {
    fetchInstituciones();
  }, []);

  const fetchInstituciones = async () => {
    try {
      const response = await axios.get(`${API}/config/instituciones`);
      setInstituciones(response.data);
    } catch (error) {
      console.error("Error fetching instituciones:", error);
      toast.error("Error al cargar instituciones");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (inst = null) => {
    if (inst) {
      setEditingInst(inst);
      setFormData({ nombre: inst.nombre });
    } else {
      setEditingInst(null);
      setFormData({ nombre: "" });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingInst(null);
    setFormData({ nombre: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      if (editingInst) {
        await axios.put(`${API}/config/instituciones/${editingInst.id}`, formData);
        toast.success("Institución actualizada exitosamente");
      } else {
        await axios.post(`${API}/config/instituciones`, formData);
        toast.success("Institución creada exitosamente");
      }
      handleCloseModal();
      fetchInstituciones();
    } catch (error) {
      console.error("Error saving:", error);
      const message = error.response?.data?.detail || "Error al guardar";
      toast.error(message);
    }
  };

  const handleToggleActive = async (inst) => {
    try {
      await axios.put(`${API}/config/instituciones/${inst.id}`, {
        activo: !inst.activo,
      });
      toast.success(inst.activo ? "Institución desactivada" : "Institución activada");
      fetchInstituciones();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/config/instituciones/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Institución eliminada exitosamente");
      setDeletingItem(null);
      fetchInstituciones();
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
    <div className="space-y-6" data-testid="instituciones-page">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Building2 className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Instituciones</CardTitle>
                <CardDescription className="text-zinc-500">
                  Administra las instituciones disponibles para vulnerabilidades
                </CardDescription>
              </div>
            </div>
            {canAdd && (
              <Button
                onClick={() => handleOpenModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="add-institucion-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Institución
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-700 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instituciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-zinc-500">
                    No hay instituciones configuradas
                  </TableCell>
                </TableRow>
              ) : (
                instituciones.map((inst) => (
                  <TableRow
                    key={inst.id}
                    className="border-zinc-800 hover:bg-white/5"
                    data-testid={`inst-row-${inst.id}`}
                  >
                    <TableCell className="text-white font-medium">
                      {inst.nombre}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canModify && (
                          <Switch
                            checked={inst.activo}
                            onCheckedChange={() => handleToggleActive(inst)}
                            data-testid={`toggle-${inst.id}`}
                          />
                        )}
                        <span className={`flex items-center gap-1 text-sm ${inst.activo ? "text-green-500" : "text-zinc-500"}`}>
                          {inst.activo ? (
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
                            onClick={() => handleOpenModal(inst)}
                            data-testid={`edit-btn-${inst.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => setDeletingItem(inst)}
                            data-testid={`delete-btn-${inst.id}`}
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
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white">
          <DialogHeader>
            <DialogTitle>
              {editingInst ? "Editar Institución" : "Nueva Institución"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre de la institución"
                className="bg-black/20 border-zinc-700 text-white"
                data-testid="input-nombre-institucion"
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
                data-testid="save-institucion-btn"
              >
                {editingInst ? "Guardar Cambios" : "Crear Institución"}
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
        itemType="la institución"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
