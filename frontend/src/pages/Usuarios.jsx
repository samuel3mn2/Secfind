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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Plus, Pencil, Trash2, CheckCircle, XCircle, Shield } from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_PERMISSIONS = {
  dashboard: { ver: true, crear: false, editar: false, eliminar: false },
  vulnerabilidades: { ver: true, crear: false, editar: false, eliminar: false },
  configuracion: { ver: false, crear: false, editar: false, eliminar: false },
  auditoria: { ver: false, crear: false, editar: false, eliminar: false },
};

export default function Usuarios() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    nombre: "",
    email: "",
    es_admin: false,
    permisos: DEFAULT_PERMISSIONS,
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const response = await axios.get(`${API}/config/usuarios`);
      setUsuarios(response.data);
    } catch (error) {
      console.error("Error fetching usuarios:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: "",
        nombre: user.nombre,
        email: user.email || "",
        es_admin: user.es_admin,
        permisos: user.permisos || DEFAULT_PERMISSIONS,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        password: "",
        nombre: "",
        email: "",
        es_admin: false,
        permisos: DEFAULT_PERMISSIONS,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handlePermissionChange = (module, action, checked) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [module]: {
          ...prev.permisos[module],
          [action]: checked,
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.nombre) {
      toast.error("Usuario y nombre son requeridos");
      return;
    }
    
    if (!editingUser && !formData.password) {
      toast.error("La contraseña es requerida para nuevos usuarios");
      return;
    }

    try {
      const payload = {
        username: formData.username,
        nombre: formData.nombre,
        email: formData.email || null,
        es_admin: formData.es_admin,
        permisos: formData.permisos,
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingUser) {
        await axios.put(`${API}/config/usuarios/${editingUser.id}`, payload);
        toast.success("Usuario actualizado exitosamente");
      } else {
        payload.password = formData.password;
        await axios.post(`${API}/config/usuarios`, payload);
        toast.success("Usuario creado exitosamente");
      }
      handleCloseModal();
      fetchUsuarios();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(error.response?.data?.detail || "Error al guardar usuario");
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await axios.put(`${API}/config/usuarios/${user.id}`, {
        activo: !user.activo,
      });
      toast.success(user.activo ? "Usuario desactivado" : "Usuario activado");
      fetchUsuarios();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/config/usuarios/${deletingItem.id}?justificacion=${encodeURIComponent(justificacion)}`);
      toast.success("Usuario eliminado exitosamente");
      setDeletingItem(null);
      fetchUsuarios();
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
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-64 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="usuarios-page">
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Users className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">Usuarios</CardTitle>
                <CardDescription className="text-zinc-500">
                  Administra los usuarios y sus permisos de acceso
                </CardDescription>
              </div>
            </div>
            {canAdd && (
              <Button
                onClick={() => handleOpenModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="add-usuario-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Usuario
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-700 hover:bg-transparent">
                <TableHead className="text-zinc-400">Usuario</TableHead>
                <TableHead className="text-zinc-400">Nombre</TableHead>
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Rol</TableHead>
                <TableHead className="text-zinc-400">Estado</TableHead>
                <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                    No hay usuarios configurados
                  </TableCell>
                </TableRow>
              ) : (
                usuarios.map((user) => (
                  <TableRow
                    key={user.id}
                    className="border-zinc-800 hover:bg-white/5"
                    data-testid={`user-row-${user.id}`}
                  >
                    <TableCell className="text-white font-medium font-mono">
                      {user.username}
                    </TableCell>
                    <TableCell className="text-zinc-300">{user.nombre}</TableCell>
                    <TableCell className="text-zinc-400">{user.email || "-"}</TableCell>
                    <TableCell>
                      {user.es_admin ? (
                        <span className="flex items-center gap-1 text-indigo-400">
                          <Shield className="w-3.5 h-3.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-zinc-500">Usuario</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canModify && (
                          <Switch
                            checked={user.activo}
                            onCheckedChange={() => handleToggleActive(user)}
                            data-testid={`toggle-user-${user.id}`}
                          />
                        )}
                        <span className={`flex items-center gap-1 text-sm ${user.activo ? "text-green-500" : "text-zinc-500"}`}>
                          {user.activo ? (
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
                            onClick={() => handleOpenModal(user)}
                            data-testid={`edit-user-btn-${user.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => setDeletingItem(user)}
                            data-testid={`delete-user-btn-${user.id}`}
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
        <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Usuario</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="nombre.usuario"
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">
                    Contraseña {editingUser && "(dejar vacío para mantener)"}
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : "Contraseña"}
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Nombre Completo</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Juan Pérez"
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-400">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="juan@empresa.com"
                    className="bg-black/20 border-zinc-700 text-white"
                    data-testid="input-email"
                  />
                </div>
              </div>

              {/* Admin Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div>
                  <p className="text-white font-medium">Administrador</p>
                  <p className="text-zinc-400 text-sm">Acceso completo a todas las funciones</p>
                </div>
                <Switch
                  checked={formData.es_admin}
                  onCheckedChange={(checked) => setFormData({ ...formData, es_admin: checked })}
                  data-testid="toggle-admin"
                />
              </div>

              {/* Permissions */}
              {!formData.es_admin && (
                <div className="space-y-4">
                  <h3 className="text-white font-medium">Permisos por Módulo</h3>
                  
                  {/* Dashboard Permissions */}
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <h4 className="text-zinc-300 font-medium mb-3">Dashboard</h4>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.dashboard.ver}
                          onCheckedChange={(checked) => handlePermissionChange("dashboard", "ver", checked)}
                        />
                        Ver
                      </label>
                    </div>
                  </div>

                  {/* Vulnerabilidades Permissions */}
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <h4 className="text-zinc-300 font-medium mb-3">Vulnerabilidades</h4>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.vulnerabilidades.ver}
                          onCheckedChange={(checked) => handlePermissionChange("vulnerabilidades", "ver", checked)}
                        />
                        Ver
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.vulnerabilidades.crear}
                          onCheckedChange={(checked) => handlePermissionChange("vulnerabilidades", "crear", checked)}
                        />
                        Crear
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.vulnerabilidades.editar}
                          onCheckedChange={(checked) => handlePermissionChange("vulnerabilidades", "editar", checked)}
                        />
                        Editar
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.vulnerabilidades.eliminar}
                          onCheckedChange={(checked) => handlePermissionChange("vulnerabilidades", "eliminar", checked)}
                        />
                        Eliminar
                      </label>
                    </div>
                  </div>

                  {/* Configuración Permissions */}
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <h4 className="text-zinc-300 font-medium mb-3">Configuración</h4>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.configuracion.ver}
                          onCheckedChange={(checked) => handlePermissionChange("configuracion", "ver", checked)}
                        />
                        Ver
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.configuracion.crear}
                          onCheckedChange={(checked) => handlePermissionChange("configuracion", "crear", checked)}
                        />
                        Crear
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.configuracion.editar}
                          onCheckedChange={(checked) => handlePermissionChange("configuracion", "editar", checked)}
                        />
                        Editar
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.configuracion.eliminar}
                          onCheckedChange={(checked) => handlePermissionChange("configuracion", "eliminar", checked)}
                        />
                        Eliminar
                      </label>
                    </div>
                  </div>

                  {/* Auditoría Permissions */}
                  <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
                    <h4 className="text-zinc-300 font-medium mb-3">Auditoría</h4>
                    <p className="text-xs text-zinc-500 mb-3">Historial de cambios del sistema</p>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-zinc-400">
                        <Checkbox
                          checked={formData.permisos.auditoria?.ver || false}
                          onCheckedChange={(checked) => handlePermissionChange("auditoria", "ver", checked)}
                        />
                        Ver
                      </label>
                    </div>
                  </div>
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
                  data-testid="save-usuario-btn"
                >
                  {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete with Justification Modal */}
      <DeleteWithJustificationModal
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        itemName={deletingItem?.nombre || deletingItem?.username}
        itemType="el usuario"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
