import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  FileText,
  Search,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { DeleteWithJustificationModal } from "@/components/DeleteWithJustificationModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function GruposInformes() {
  const { isAdmin, canCreate, canEdit, canDelete } = useAuth();
  const [grupos, setGrupos] = useState([]);
  const [informesSinGrupo, setInformesSinGrupo] = useState([]);
  const [allInformes, setAllInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    informes: [],
  });
  const [searchInforme, setSearchInforme] = useState("");

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreateGrupo = isAdmin || canCreate("configuracion");
  const canEditGrupo = isAdmin || canEdit("configuracion");
  const canDeleteGrupo = isAdmin || canDelete("configuracion");

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [gruposRes, sinGrupoRes, allInformesRes] = await Promise.all([
        axios.get(`${API}/config/grupos-informes`, { headers }),
        axios.get(`${API}/config/informes-sin-grupo`, { headers }),
        axios.get(`${API}/config/informes-pentest`, { headers }),
      ]);

      setGrupos(gruposRes.data);
      setInformesSinGrupo(sinGrupoRes.data);
      setAllInformes(allInformesRes.data.map((i) => i.nombre));
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

  const openCreateModal = () => {
    setEditingGrupo(null);
    setFormData({ nombre: "", descripcion: "", informes: [] });
    setSearchInforme("");
    setIsModalOpen(true);
  };

  const openEditModal = (grupo) => {
    setEditingGrupo(grupo);
    setFormData({
      nombre: grupo.nombre,
      descripcion: grupo.descripcion || "",
      informes: grupo.informes || [],
    });
    setSearchInforme("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGrupo(null);
    setFormData({ nombre: "", descripcion: "", informes: [] });
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre del grupo es requerido");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (editingGrupo) {
        await axios.put(
          `${API}/config/grupos-informes/${editingGrupo.id}`,
          formData,
          { headers }
        );
        toast.success("Grupo actualizado exitosamente");
      } else {
        await axios.post(`${API}/config/grupos-informes`, formData, { headers });
        toast.success("Grupo creado exitosamente");
      }

      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving grupo:", error);
      toast.error(error.response?.data?.detail || "Error al guardar grupo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (justificacion) => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/config/grupos-informes/${deleteConfirm.id}?justificacion=${encodeURIComponent(justificacion)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Grupo eliminado exitosamente");
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting grupo:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar grupo");
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleInformeInGroup = (informe) => {
    setFormData((prev) => ({
      ...prev,
      informes: prev.informes.includes(informe)
        ? prev.informes.filter((i) => i !== informe)
        : [...prev.informes, informe],
    }));
  };

  // Available informes for assignment (sin grupo + currently assigned to this grupo)
  const availableInformes = React.useMemo(() => {
    const currentlyAssigned = editingGrupo?.informes || [];
    const available = [...new Set([...informesSinGrupo, ...currentlyAssigned])];
    if (!searchInforme.trim()) return available.sort();
    const searchLower = searchInforme.toLowerCase();
    return available.filter((i) => i.toLowerCase().includes(searchLower)).sort();
  }, [informesSinGrupo, editingGrupo, searchInforme]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="grupos-informes-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-indigo-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              Grupos de Informes
            </h2>
            <p className="text-sm text-zinc-500">
              Agrupa informes de pentest para consolidar en la Vista Comité
            </p>
          </div>
        </div>
        {canCreateGrupo && (
          <Button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700"
            data-testid="btn-crear-grupo"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Grupo
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Total Grupos</p>
            <p className="text-2xl font-bold text-white">{grupos.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Informes Agrupados</p>
            <p className="text-2xl font-bold text-indigo-500">
              {grupos.reduce((acc, g) => acc + (g.informes?.length || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Informes Sin Grupo</p>
            <p className="text-2xl font-bold text-yellow-500">
              {informesSinGrupo.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Groups Table */}
      <Card className="bg-[#18181b] border-zinc-800">
        <CardContent className="p-0">
          {grupos.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay grupos creados</p>
              <p className="text-sm mt-1">
                Crea un grupo para consolidar varios informes en la Vista Comité
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Nombre</TableHead>
                  <TableHead className="text-zinc-400">Descripción</TableHead>
                  <TableHead className="text-zinc-400 text-center">
                    Informes
                  </TableHead>
                  <TableHead className="text-zinc-400 text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((grupo) => (
                  <TableRow
                    key={grupo.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                    data-testid={`grupo-row-${grupo.id}`}
                  >
                    <TableCell className="text-white font-medium">
                      {grupo.nombre}
                    </TableCell>
                    <TableCell className="text-zinc-400 max-w-[300px] truncate">
                      {grupo.descripcion || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                      >
                        {grupo.informes?.length || 0} informes
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEditGrupo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(grupo)}
                            className="text-zinc-400 hover:text-white"
                            data-testid={`btn-edit-${grupo.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteGrupo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(grupo)}
                            className="text-red-400 hover:text-red-300"
                            data-testid={`btn-delete-${grupo.id}`}
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

      {/* Informes sin grupo */}
      {informesSinGrupo.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Informes sin asignar a ningún grupo ({informesSinGrupo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {informesSinGrupo.slice(0, 10).map((informe) => (
                <Badge
                  key={informe}
                  variant="outline"
                  className="bg-zinc-800 text-zinc-300 border-zinc-700"
                >
                  {informe}
                </Badge>
              ))}
              {informesSinGrupo.length > 10 && (
                <Badge
                  variant="outline"
                  className="bg-zinc-800 text-zinc-500 border-zinc-700"
                >
                  +{informesSinGrupo.length - 10} más
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-500" />
              {editingGrupo ? "Editar Grupo" : "Crear Nuevo Grupo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nombre */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre del Grupo *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Ej: Primera Emulación 2024"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-nombre-grupo"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Descripción (opcional)</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Descripción del grupo..."
                className="bg-zinc-800 border-zinc-700 text-white resize-none"
                rows={2}
              />
            </div>

            {/* Informes Selection */}
            <div className="space-y-2">
              <Label className="text-zinc-300">
                Informes en este grupo ({formData.informes.length} seleccionados)
              </Label>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  value={searchInforme}
                  onChange={(e) => setSearchInforme(e.target.value)}
                  placeholder="Buscar informe..."
                  className="pl-9 bg-zinc-800 border-zinc-700 text-white"
                />
                {searchInforme && (
                  <button
                    onClick={() => setSearchInforme("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Selected informes */}
              {formData.informes.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  {formData.informes.map((inf) => (
                    <Badge
                      key={inf}
                      variant="outline"
                      className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30 pr-1 cursor-pointer hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-colors"
                      onClick={() => toggleInformeInGroup(inf)}
                    >
                      {inf}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Available informes list */}
              <ScrollArea className="h-[200px] border border-zinc-700 rounded-lg">
                <div className="p-2 space-y-1">
                  {availableInformes.length === 0 ? (
                    <p className="text-center text-zinc-500 py-4 text-sm">
                      {searchInforme
                        ? "No se encontraron informes"
                        : "Todos los informes están asignados a otros grupos"}
                    </p>
                  ) : (
                    availableInformes.map((informe) => (
                      <div
                        key={informe}
                        className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800 cursor-pointer"
                        onClick={() => toggleInformeInGroup(informe)}
                      >
                        <Checkbox
                          checked={formData.informes.includes(informe)}
                          onCheckedChange={() => toggleInformeInGroup(informe)}
                        />
                        <span className="text-sm text-zinc-300">{informe}</span>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
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
              disabled={saving || !formData.nombre.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="btn-guardar-grupo"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingGrupo ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete with Justification Modal */}
      <DeleteWithJustificationModal
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        itemName={deleteConfirm?.nombre}
        itemType="el grupo de informes"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
