import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Truck, Search } from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Proveedores() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", activo: true });

  const canModify = isAdmin || canEdit("configuracion");
  const canRemove = isAdmin || canDelete("configuracion");
  const canAdd = isAdmin || canCreate("configuracion");

  const fetchProveedores = async () => {
    try {
      const response = await axios.get(`${API}/config/proveedores`);
      setProveedores(response.data);
    } catch (error) {
      console.error("Error fetching proveedores:", error);
      toast.error("Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProveedores();
  }, []);

  const filteredProveedores = proveedores.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ nombre: item.nombre, activo: item.activo });
    } else {
      setEditingItem(null);
      setFormData({ nombre: "", activo: true });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ nombre: "", activo: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    try {
      if (editingItem) {
        await axios.put(`${API}/config/proveedores/${editingItem.id}`, formData);
        toast.success("Proveedor actualizado exitosamente");
      } else {
        await axios.post(`${API}/config/proveedores`, { nombre: formData.nombre.trim() });
        toast.success("Proveedor creado exitosamente");
      }
      handleCloseModal();
      fetchProveedores();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(error.response?.data?.detail || "Error al guardar el proveedor");
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/config/proveedores/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Proveedor eliminado exitosamente");
      setDeletingItem(null);
      fetchProveedores();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar el proveedor");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-zinc-800 rounded w-48" />
        <div className="h-64 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="proveedores-section">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Truck className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Proveedores</h2>
            <p className="text-sm text-zinc-500">{proveedores.length} registrados</p>
          </div>
        </div>
        {canAdd && (
          <Button
            onClick={() => handleOpenModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="add-proveedor-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proveedor
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-black/20 border-zinc-700 text-white placeholder:text-zinc-500"
          data-testid="search-proveedor-input"
        />
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-700 hover:bg-transparent">
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProveedores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-zinc-500">
                    No se encontraron proveedores
                  </TableCell>
                </TableRow>
              ) : (
                filteredProveedores.map((prov) => (
                  <TableRow
                    key={prov.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                    data-testid={`proveedor-row-${prov.id}`}
                  >
                    <TableCell className="text-white font-medium">{prov.nombre}</TableCell>
                    <TableCell>
                      <Badge
                        variant={prov.activo ? "default" : "secondary"}
                        className={prov.activo ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-400"}
                      >
                        {prov.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canModify && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
                            onClick={() => handleOpenModal(prov)}
                            data-testid={`edit-proveedor-btn-${prov.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => setDeletingItem(prov)}
                            data-testid={`delete-proveedor-btn-${prov.id}`}
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
              {editingItem ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del proveedor"
                className="bg-black/20 border-zinc-700 text-white"
                data-testid="input-proveedor-nombre"
              />
            </div>

            {editingItem && (
              <div className="flex items-center justify-between">
                <Label className="text-zinc-400">Estado</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                    data-testid="switch-proveedor-activo"
                  />
                  <span className="text-sm text-zinc-300">
                    {formData.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                className="border-zinc-700 text-zinc-300"
                data-testid="cancel-proveedor-btn"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="save-proveedor-btn"
              >
                {editingItem ? "Guardar Cambios" : "Crear Proveedor"}
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
        itemType="el proveedor"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
