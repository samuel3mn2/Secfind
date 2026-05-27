import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, AlertTriangle, Save, Loader2, Search, BookOpen, Upload, Download, FileSpreadsheet } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CatalogoRiesgos() {
  const { isAdmin } = useAuth();
  const [riesgos, setRiesgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({ total: 0, skip: 0, limit: 50 });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRiesgo, setEditingRiesgo] = useState(null);
  const [formData, setFormData] = useState({
    codigo_riesgo: "",
    nombre_corto: "",
    descripcion_completa: "",
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchRiesgos = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      params.append("skip", pagination.skip.toString());
      params.append("limit", pagination.limit.toString());

      const response = await axios.get(`${API}/catalogo-riesgos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRiesgos(response.data.items);
      setPagination((prev) => ({ ...prev, total: response.data.total }));
    } catch (error) {
      console.error("Error fetching riesgos:", error);
      toast.error("Error al cargar catálogo de riesgos");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, pagination.skip, pagination.limit]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchRiesgos();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchRiesgos]);

  const openCreateModal = () => {
    setEditingRiesgo(null);
    setFormData({ codigo_riesgo: "", nombre_corto: "", descripcion_completa: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (riesgo) => {
    setEditingRiesgo(riesgo);
    setFormData({
      codigo_riesgo: riesgo.codigo_riesgo || "",
      nombre_corto: riesgo.nombre_corto || "",
      descripcion_completa: riesgo.descripcion_completa || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRiesgo(null);
    setFormData({ codigo_riesgo: "", nombre_corto: "", descripcion_completa: "" });
  };

  const handleSave = async () => {
    if (!formData.codigo_riesgo.trim() || !formData.nombre_corto.trim()) {
      toast.error("El código y nombre corto son requeridos");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      if (editingRiesgo) {
        await axios.put(
          `${API}/catalogo-riesgos/${editingRiesgo.id}`,
          formData,
          { headers }
        );
        toast.success("Riesgo actualizado exitosamente");
      } else {
        await axios.post(`${API}/catalogo-riesgos`, formData, { headers });
        toast.success("Riesgo creado exitosamente");
      }

      closeModal();
      fetchRiesgos();
    } catch (error) {
      console.error("Error saving riesgo:", error);
      toast.error(error.response?.data?.detail || "Error al guardar riesgo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (riesgo) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/catalogo-riesgos/${riesgo.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Riesgo eliminado del catálogo");
      setDeleteConfirm(null);
      fetchRiesgos();
    } catch (error) {
      console.error("Error deleting riesgo:", error);
      toast.error(error.response?.data?.detail || "Error al eliminar riesgo");
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Selecciona un archivo Excel");
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await axios.post(`${API}/catalogo-riesgos/import/excel`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(response.data.message);
      if (response.data.errors?.length > 0) {
        response.data.errors.forEach((err) => toast.warning(err));
      }

      setShowImportModal(false);
      setImportFile(null);
      fetchRiesgos();
    } catch (error) {
      console.error("Error importing:", error);
      toast.error(error.response?.data?.detail || "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/catalogo-riesgos/plantilla/descargar`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_catalogo_riesgos.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Error al descargar plantilla");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 space-y-6" data-testid="catalogo-riesgos-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Catálogo de Riesgos
            </h1>
            <p className="text-zinc-500">
              Gestiona el catálogo corporativo de riesgos de seguridad
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              data-testid="btn-descargar-plantilla"
            >
              <Download className="w-4 h-4 mr-2" />
              Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowImportModal(true)}
              className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              data-testid="btn-importar-riesgos"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button
              onClick={openCreateModal}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="btn-crear-riesgo"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Riesgo
            </Button>
          </div>
        )}
      </div>

      {/* Search & Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800 flex-1 min-w-[150px]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500">Total Riesgos</p>
            <p className="text-2xl font-bold text-white">{pagination.total}</p>
          </CardContent>
        </Card>

        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPagination((prev) => ({ ...prev, skip: 0 }));
            }}
            placeholder="Buscar por código, nombre o descripción..."
            className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            data-testid="search-riesgos"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#18181b] border-zinc-800">
        <CardContent className="p-0">
          {riesgos.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{searchTerm ? "No se encontraron riesgos" : "No hay riesgos en el catálogo"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-[120px]">Código</TableHead>
                  <TableHead className="text-zinc-400">Nombre Corto</TableHead>
                  <TableHead className="text-zinc-400 hidden md:table-cell">Descripción</TableHead>
                  {isAdmin && (
                    <TableHead className="text-zinc-400 text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {riesgos.map((riesgo) => (
                  <TableRow
                    key={riesgo.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                    data-testid={`riesgo-row-${riesgo.id}`}
                  >
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-mono text-xs">
                        {riesgo.codigo_riesgo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {riesgo.nombre_corto}
                    </TableCell>
                    <TableCell className="text-zinc-400 hidden md:table-cell max-w-md truncate">
                      {riesgo.descripcion_completa || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(riesgo)}
                            className="text-zinc-400 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(riesgo)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.skip === 0}
            onClick={() => setPagination((prev) => ({ ...prev, skip: prev.skip - prev.limit }))}
            className="border-zinc-700 text-zinc-300"
          >
            Anterior
          </Button>
          <span className="text-zinc-400 text-sm flex items-center px-3">
            {Math.floor(pagination.skip / pagination.limit) + 1} de {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.skip + pagination.limit >= pagination.total}
            onClick={() => setPagination((prev) => ({ ...prev, skip: prev.skip + prev.limit }))}
            className="border-zinc-700 text-zinc-300"
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              {editingRiesgo ? "Editar Riesgo" : "Crear Nuevo Riesgo"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Código del Riesgo *</Label>
              <Input
                value={formData.codigo_riesgo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, codigo_riesgo: e.target.value.toUpperCase() }))
                }
                placeholder="Ej: R-001"
                className="bg-zinc-800 border-zinc-700 text-white font-mono"
                data-testid="input-codigo-riesgo"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Nombre Corto *</Label>
              <Input
                value={formData.nombre_corto}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nombre_corto: e.target.value }))
                }
                placeholder="Ej: Acceso no autorizado"
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="input-nombre-riesgo"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Descripción Completa</Label>
              <Textarea
                value={formData.descripcion_completa}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, descripcion_completa: e.target.value }))
                }
                placeholder="Descripción detallada del riesgo..."
                className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                data-testid="input-descripcion-riesgo"
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
              disabled={saving || !formData.codigo_riesgo.trim() || !formData.nombre_corto.trim()}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="btn-guardar-riesgo"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingRiesgo ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar riesgo del catálogo?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esto eliminará el riesgo "{deleteConfirm?.nombre_corto}" del catálogo.
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

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-orange-500" />
              Importar Riesgos desde Excel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Sube un archivo Excel (.xlsx) con las columnas: <strong>Código</strong>, <strong>Nombre Corto</strong>, <strong>Descripción Completa</strong>
            </p>

            <div className="space-y-2">
              <Label className="text-zinc-300">Archivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files[0])}
                className="bg-zinc-800 border-zinc-700 text-white file:bg-zinc-700 file:text-white file:border-0 file:mr-4"
                data-testid="input-import-file"
              />
            </div>

            <Button
              variant="link"
              onClick={downloadTemplate}
              className="text-orange-400 hover:text-orange-300 p-0 h-auto"
            >
              <Download className="w-4 h-4 mr-1" />
              Descargar plantilla de ejemplo
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              className="border-zinc-700 text-zinc-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="btn-confirmar-importar"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
