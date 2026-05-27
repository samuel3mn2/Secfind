import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Shield, Save, Loader2, Filter } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Controles() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [controles, setControles] = useState([]);
  const [dominios, setDominios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filter
  const [filterDominio, setFilterDominio] = useState("all");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingControl, setEditingControl] = useState(null);
  const [formData, setFormData] = useState({
    dominio_id: "",
    codigo_control: "",
    nombre_control: "",
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const canCreateControl = isAdmin || canCreate("configuracion");
  const canEditControl = isAdmin || canEdit("configuracion");
  const canDeleteControl = isAdmin || canDelete("configuracion");

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [controlesRes, dominiosRes] = await Promise.all([
        axios.get(`${API}/config/controles`, { headers }),
        axios.get(`${API}/config/dominios`, { headers }),
      ]);

      setControles(controlesRes.data);
      setDominios(dominiosRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredControles = filterDominio === "all"
    ? controles
    : controles.filter(c => c.dominio_id === filterDominio);

  const openCreateModal = () => {
    setEditingControl(null);
    setFormData({ dominio_id: "", codigo_control: "", nombre_control: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (control) => {
    setEditingControl(control);
    setFormData({
      dominio_id: control.dominio_id || "",
      codigo_control: control.codigo_control || "",
      nombre_control: control.nombre_control,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingControl(null);
    setFormData({ dominio_id: "", codigo_control: "", nombre_control: "" });
  };

  const handleSave = async () => {
    if (!formData.nombre_control.trim()) {
      toast.error("El nombre del control es requerido");
      return;
    }
    if (!formData.dominio_id) {
      toast.error("Debe seleccionar un dominio");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (editingControl) {
        await axios.put(
          `${API}/config/controles/${editingControl.id}`,
          formData,
          { headers }
        );
        toast.success("Control actualizado exitosamente");
      } else {
        await axios.post(`${API}/config/controles`, formData, { headers });
        toast.success("Control creado exitosamente");
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving control:", error);
      toast.error(error.response?.data?.detail || "Error al guardar control");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (control) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/config/controles/${control.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Control eliminado exitosamente");
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting control:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar control");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="controles-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-cyan-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Controles de Seguridad</h2>
            <p className="text-sm text-zinc-500">
              Controles técnicos agrupados por dominio
            </p>
          </div>
        </div>
        {canCreateControl && (
          <Button
            onClick={openCreateModal}
            className="bg-cyan-600 hover:bg-cyan-700"
            data-testid="btn-crear-control"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Control
          </Button>
        )}
      </div>

      {/* Summary & Filter */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800 flex-1 min-w-[150px]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Total Controles</p>
            <p className="text-2xl font-bold text-white">{controles.length}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800 flex-1 min-w-[150px]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Mostrando</p>
            <p className="text-2xl font-bold text-cyan-500">{filteredControles.length}</p>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <Select value={filterDominio} onValueChange={setFilterDominio}>
            <SelectTrigger className="w-[220px] bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder="Filtrar por dominio" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-300">
                Todos los dominios
              </SelectItem>
              {dominios.map((dom) => (
                <SelectItem key={dom.id} value={dom.id} className="text-zinc-300">
                  {dom.nombre_dominio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-zinc-800">
        <CardContent className="p-0">
          {filteredControles.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay controles {filterDominio !== "all" ? "en este dominio" : "creados"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-[120px]">Código</TableHead>
                  <TableHead className="text-zinc-400">Nombre del Control</TableHead>
                  <TableHead className="text-zinc-400">Dominio</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControles.map((control) => (
                  <TableRow
                    key={control.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                    data-testid={`control-row-${control.id}`}
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 font-mono text-xs">
                        {control.codigo_control || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {control.nombre_control}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                        {control.nombre_dominio}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditControl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(control)}
                            className="text-zinc-400 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteControl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(control)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-500" />
              {editingControl ? "Editar Control" : "Crear Nuevo Control"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Dominio *</Label>
              <Select
                value={formData.dominio_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, dominio_id: value }))
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Seleccionar dominio..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {dominios.map((dom) => (
                    <SelectItem key={dom.id} value={dom.id} className="text-zinc-300">
                      {dom.nombre_dominio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Código del Control</Label>
              <Input
                value={formData.codigo_control}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, codigo_control: e.target.value.toUpperCase() }))
                }
                placeholder="Ej: CTRL-EP-01"
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre del Control *</Label>
              <Input
                value={formData.nombre_control}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nombre_control: e.target.value }))
                }
                placeholder="Ej: Protección del endpoint (EDR/EPP)"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-nombre-control"
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
              onClick={handleSave}
              disabled={saving || !formData.nombre_control.trim() || !formData.dominio_id}
              className="bg-cyan-600 hover:bg-cyan-700"
              data-testid="btn-guardar-control"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingControl ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar control?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esto eliminará el control "{deleteConfirm?.nombre_control}". 
              No se puede eliminar si tiene vulnerabilidades o hallazgos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm)}
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
