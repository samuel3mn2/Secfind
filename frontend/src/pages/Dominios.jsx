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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Layers, Save, Loader2 } from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dominios() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [dominios, setDominios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDominio, setEditingDominio] = useState(null);
  const [formData, setFormData] = useState({
    nombre_dominio: "",
    codigo_referencia: "",
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreateDominio = isAdmin || canCreate("configuracion");
  const canEditDominio = isAdmin || canEdit("configuracion");
  const canDeleteDominio = isAdmin || canDelete("configuracion");

  const fetchDominios = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/config/dominios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDominios(response.data);
    } catch (error) {
      console.error("Error fetching dominios:", error);
      toast.error("Error al cargar dominios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDominios();
  }, [fetchDominios]);

  const openCreateModal = () => {
    setEditingDominio(null);
    setFormData({ nombre_dominio: "", codigo_referencia: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (dominio) => {
    setEditingDominio(dominio);
    setFormData({
      nombre_dominio: dominio.nombre_dominio,
      codigo_referencia: dominio.codigo_referencia || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDominio(null);
    setFormData({ nombre_dominio: "", codigo_referencia: "" });
  };

  const handleSave = async () => {
    if (!formData.nombre_dominio.trim()) {
      toast.error("El nombre del dominio es requerido");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (editingDominio) {
        await axios.put(
          `${API}/config/dominios/${editingDominio.id}`,
          formData,
          { headers }
        );
        toast.success("Dominio actualizado exitosamente");
      } else {
        await axios.post(`${API}/config/dominios`, formData, { headers });
        toast.success("Dominio creado exitosamente");
      }

      closeModal();
      fetchDominios();
    } catch (error) {
      console.error("Error saving dominio:", error);
      toast.error(error.response?.data?.detail || "Error al guardar dominio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/config/dominios/${deleteConfirm.id}?justificacion=${encodeURIComponent(justificacion)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Dominio eliminado exitosamente");
      setDeleteConfirm(null);
      fetchDominios();
    } catch (error) {
      console.error("Error deleting dominio:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar dominio");
    } finally {
      setDeleteLoading(false);
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
    <div className="space-y-6" data-testid="dominios-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-purple-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Dominios de Seguridad</h2>
            <p className="text-sm text-zinc-500">
              Categorías principales para clasificar controles y hallazgos
            </p>
          </div>
        </div>
        {canCreateDominio && (
          <Button
            onClick={openCreateModal}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="btn-crear-dominio"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Dominio
          </Button>
        )}
      </div>

      {/* Summary */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-zinc-500">Total Dominios</p>
              <p className="text-2xl font-bold text-white">{dominios.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-[#18181b] border-zinc-800">
        <CardContent className="p-0">
          {dominios.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay dominios creados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Código</TableHead>
                  <TableHead className="text-zinc-400">Nombre del Dominio</TableHead>
                  <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dominios.map((dominio) => (
                  <TableRow
                    key={dominio.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                    data-testid={`dominio-row-${dominio.id}`}
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 font-mono">
                        {dominio.codigo_referencia || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {dominio.nombre_dominio}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditDominio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(dominio)}
                            className="text-zinc-400 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteDominio && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(dominio)}
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
              <Layers className="w-5 h-5 text-purple-500" />
              {editingDominio ? "Editar Dominio" : "Crear Nuevo Dominio"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Código de Referencia</Label>
              <Input
                value={formData.codigo_referencia}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, codigo_referencia: e.target.value.toUpperCase() }))
                }
                placeholder="Ej: DOM-EP"
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre del Dominio *</Label>
              <Input
                value={formData.nombre_dominio}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nombre_dominio: e.target.value }))
                }
                placeholder="Ej: Seguridad EndPoints"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-nombre-dominio"
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
              disabled={saving || !formData.nombre_dominio.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="btn-guardar-dominio"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingDominio ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete with Justification Modal */}
      <DeleteWithJustificationModal
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        itemName={deleteConfirm?.nombre_dominio}
        itemType="el dominio"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
