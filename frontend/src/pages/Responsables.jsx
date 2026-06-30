import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, UserCircle, Mail, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Responsables() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [responsables, setResponsables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    activo: true
  });

  useEffect(() => {
    fetchResponsables();
  }, []);

  const fetchResponsables = async () => {
    try {
      const response = await axios.get(`${API}/config/responsables`);
      setResponsables(response.data);
    } catch (error) {
      console.error("Error fetching responsables:", error);
      toast.error("Error al cargar responsables");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`${API}/config/responsables/${editingItem.id}`, formData);
        toast.success("Responsable actualizado exitosamente");
      } else {
        await axios.post(`${API}/config/responsables`, formData);
        toast.success("Responsable creado exitosamente");
      }
      handleCloseModal();
      fetchResponsables();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/config/responsables/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Responsable eliminado exitosamente");
      setDeletingItem(null);
      fetchResponsables();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ nombre: item.nombre, email: item.email || "", activo: item.activo });
    } else {
      setEditingItem(null);
      setFormData({ nombre: "", email: "", activo: true });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ nombre: "", email: "", activo: true });
  };

  const filteredResponsables = responsables.filter(r => 
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const canModify = isAdmin || canCreate("configuracion") || canEdit("configuracion");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-600/20">
                <UserCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">Responsables</CardTitle>
                <CardDescription className="text-zinc-500">
                  Administra los responsables de vulnerabilidades y sus emails
                </CardDescription>
              </div>
            </div>
            {canModify && (
              <Button
                onClick={() => handleOpenModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="new-responsable-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Responsable
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-700 text-white"
              data-testid="search-responsables"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Nombre</TableHead>
                  <TableHead className="text-zinc-400">Email</TableHead>
                  <TableHead className="text-zinc-400">Estado</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponsables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                      {searchTerm ? "No se encontraron resultados" : "No hay responsables registrados"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResponsables.map((item) => (
                    <TableRow key={item.id} className="border-zinc-800">
                      <TableCell className="text-white font-medium">
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4 text-zinc-500" />
                          {item.nombre}
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-400">
                        {item.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-zinc-500" />
                            {item.email}
                          </div>
                        ) : (
                          <span className="text-zinc-600 italic">Sin email</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          item.activo 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-zinc-500/20 text-zinc-400"
                        }`}>
                          {item.activo ? "Activo" : "Inactivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(isAdmin || canEdit("configuracion")) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenModal(item)}
                              className="h-8 w-8 text-zinc-400 hover:text-white"
                              data-testid={`edit-responsable-${item.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {(isAdmin || canDelete("configuracion")) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingItem(item)}
                              className="h-8 w-8 text-zinc-400 hover:text-red-400"
                              data-testid={`delete-responsable-${item.id}`}
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
          
          <p className="text-xs text-zinc-500 mt-3">
            Total: {filteredResponsables.length} responsable(s)
          </p>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Responsable" : "Nuevo Responsable"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editingItem ? "Modifica los datos del responsable" : "Agrega un nuevo responsable al catálogo"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nombre *</Label>
              <Input
                required
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="responsable-nombre-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="responsable-email-input"
              />
              <p className="text-xs text-zinc-500">
                Se usará para enviar notificaciones de vulnerabilidades
              </p>
            </div>
            {editingItem && (
              <div className="flex items-center gap-2">
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, activo: checked }))}
                />
                <Label htmlFor="activo" className="text-zinc-400 cursor-pointer">
                  Activo
                </Label>
              </div>
            )}
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
                data-testid="save-responsable-btn"
              >
                {editingItem ? "Guardar Cambios" : "Crear Responsable"}
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
        itemType="el responsable"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
