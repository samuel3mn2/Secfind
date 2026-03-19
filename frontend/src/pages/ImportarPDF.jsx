import { useState, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Edit,
  Save,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SeverityBadge = ({ severity }) => {
  const classes = {
    Critica: "bg-red-500/20 text-red-400 border-red-500/30",
    Alta: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Media: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Baja: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${classes[severity] || "bg-zinc-700 text-zinc-300"}`}>
      {severity}
    </span>
  );
};

export default function ImportarPDF({ onClose, onSuccess }) {
  const { isAdmin, canCreate } = useAuth();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1); // 1: upload, 2: review catalog, 3: review vulns
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [currentVulnIndex, setCurrentVulnIndex] = useState(0);
  const [editingVuln, setEditingVuln] = useState(null);
  const [addedVulns, setAddedVulns] = useState([]);
  const [options, setOptions] = useState(null);
  const [showConfirmAdd, setShowConfirmAdd] = useState(false);

  const canImport = isAdmin || canCreate("vulnerabilidades");

  const fetchOptions = async () => {
    try {
      const response = await axios.get(`${API}/dropdown-options`);
      setOptions(response.data);
    } catch (error) {
      console.error("Error fetching options:", error);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Por favor seleccione un archivo PDF");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/import/pdf/extract`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setExtractedData(response.data);
      await fetchOptions();
      
      // Check if there are new catalog items
      const hasNewItems = 
        response.data.aplicaciones_nuevas?.length > 0 ||
        response.data.informes_nuevos?.length > 0 ||
        response.data.proveedores_nuevos?.length > 0 ||
        response.data.instituciones_nuevas?.length > 0;
      
      if (hasNewItems) {
        setStep(2); // Go to catalog review
      } else {
        setStep(3); // Go directly to vulnerability review
        prepareFirstVuln(response.data);
      }
      
      toast.success(`Se extrajeron ${response.data.vulnerabilidades?.length || 0} vulnerabilidades del PDF`);
    } catch (error) {
      console.error("Error extracting:", error);
      toast.error(error.response?.data?.detail || "Error al procesar el PDF");
    } finally {
      setLoading(false);
    }
  };

  const prepareFirstVuln = (data) => {
    if (data.vulnerabilidades?.length > 0) {
      const vuln = data.vulnerabilidades[0];
      setEditingVuln({
        fecha_hallazgo: data.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: data.institucion || "",
        aplicaciones: vuln.activos_afectados || [],
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: `${vuln.descripcion || ""}\n\nImpacto: ${vuln.impacto || ""}`.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: vuln.severidad || "Media",
        estatus: "Pendiente",
        nombre_informe_pentest: data.nombre_informe || "",
        proveedor: data.proveedor || "",
        riesgo_asociado: "",
        responsable: "",
        fecha_compromiso: ""
      });
    }
  };

  const handleAddCatalogItems = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/import/pdf/add-catalog-items`, null, {
        params: {
          aplicaciones: extractedData.aplicaciones_nuevas || [],
          informes: extractedData.informes_nuevos || [],
          proveedores: extractedData.proveedores_nuevos || [],
          instituciones: extractedData.instituciones_nuevas || []
        },
        paramsSerializer: params => {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach(v => searchParams.append(key, v));
            } else {
              searchParams.append(key, value);
            }
          });
          return searchParams.toString();
        }
      });
      
      toast.success("Elementos de catálogo agregados");
      await fetchOptions();
      setStep(3);
      prepareFirstVuln(extractedData);
    } catch (error) {
      console.error("Error adding catalog items:", error);
      toast.error("Error al agregar elementos de catálogo");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipCatalog = () => {
    setStep(3);
    prepareFirstVuln(extractedData);
  };

  const handleAddVulnerability = async () => {
    if (!editingVuln) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/import/pdf/add-vulnerability`, editingVuln);
      
      setAddedVulns([...addedVulns, currentVulnIndex]);
      toast.success("Vulnerabilidad agregada exitosamente");
      
      // Move to next vulnerability
      if (currentVulnIndex < extractedData.vulnerabilidades.length - 1) {
        goToNextVuln();
      } else {
        toast.success(`Importación completada. ${addedVulns.length + 1} vulnerabilidades agregadas.`);
        onSuccess?.();
        onClose?.();
      }
    } catch (error) {
      console.error("Error adding vulnerability:", error);
      toast.error(error.response?.data?.detail || "Error al agregar vulnerabilidad");
    } finally {
      setLoading(false);
    }
  };

  const goToNextVuln = () => {
    const nextIndex = currentVulnIndex + 1;
    if (nextIndex < extractedData.vulnerabilidades.length) {
      setCurrentVulnIndex(nextIndex);
      const vuln = extractedData.vulnerabilidades[nextIndex];
      setEditingVuln({
        fecha_hallazgo: extractedData.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: extractedData.institucion || "",
        aplicaciones: vuln.activos_afectados || [],
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: `${vuln.descripcion || ""}\n\nImpacto: ${vuln.impacto || ""}`.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: vuln.severidad || "Media",
        estatus: "Pendiente",
        nombre_informe_pentest: extractedData.nombre_informe || "",
        proveedor: extractedData.proveedor || "",
        riesgo_asociado: "",
        responsable: "",
        fecha_compromiso: ""
      });
    }
  };

  const goToPrevVuln = () => {
    const prevIndex = currentVulnIndex - 1;
    if (prevIndex >= 0) {
      setCurrentVulnIndex(prevIndex);
      const vuln = extractedData.vulnerabilidades[prevIndex];
      setEditingVuln({
        fecha_hallazgo: extractedData.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: extractedData.institucion || "",
        aplicaciones: vuln.activos_afectados || [],
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: `${vuln.descripcion || ""}\n\nImpacto: ${vuln.impacto || ""}`.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: vuln.severidad || "Media",
        estatus: "Pendiente",
        nombre_informe_pentest: extractedData.nombre_informe || "",
        proveedor: extractedData.proveedor || "",
        riesgo_asociado: "",
        responsable: "",
        fecha_compromiso: ""
      });
    }
  };

  const handleSkipVuln = () => {
    if (currentVulnIndex < extractedData.vulnerabilidades.length - 1) {
      goToNextVuln();
    } else {
      toast.info(`Importación finalizada. ${addedVulns.length} vulnerabilidades agregadas.`);
      onSuccess?.();
      onClose?.();
    }
  };

  const handleFinish = () => {
    toast.success(`Importación completada. ${addedVulns.length} vulnerabilidades agregadas.`);
    onSuccess?.();
    onClose?.();
  };

  if (!canImport) {
    return (
      <div className="text-center text-zinc-500 py-8">
        No tiene permisos para importar vulnerabilidades
      </div>
    );
  }

  // Step 1: Upload PDF
  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="p-4 bg-indigo-500/10 rounded-full w-fit mx-auto mb-4">
            <FileText className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Importar desde PDF</h3>
          <p className="text-sm text-zinc-400">
            Sube un informe de pentest en PDF y el sistema extraerá automáticamente las vulnerabilidades
          </p>
        </div>

        <div 
          className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            className="hidden"
            data-testid="pdf-file-input"
          />
          {loading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 text-indigo-500 mx-auto animate-spin" />
              <p className="text-zinc-400">Procesando PDF con IA...</p>
              <p className="text-xs text-zinc-500">Esto puede tomar unos segundos</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <p className="text-zinc-300 mb-1">Arrastra un archivo PDF aquí o haz clic para seleccionar</p>
              <p className="text-xs text-zinc-500">Solo archivos PDF de informes de pentest</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Review new catalog items
  if (step === 2 && extractedData) {
    const hasNewItems = 
      (extractedData.aplicaciones_nuevas?.length || 0) +
      (extractedData.informes_nuevos?.length || 0) +
      (extractedData.proveedores_nuevos?.length || 0) +
      (extractedData.instituciones_nuevas?.length || 0);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="p-4 bg-yellow-500/10 rounded-full w-fit mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Elementos Nuevos Detectados</h3>
          <p className="text-sm text-zinc-400">
            Se encontraron {hasNewItems} elementos que no existen en el catálogo
          </p>
        </div>

        <Card className="bg-zinc-900/50 border-zinc-700">
          <CardContent className="p-4 space-y-4">
            {/* Informe del PDF */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Informe:</span>
                <p className="text-white truncate">{extractedData.nombre_informe}</p>
              </div>
              <div>
                <span className="text-zinc-500">Fecha:</span>
                <p className="text-white">{extractedData.fecha_informe}</p>
              </div>
              <div>
                <span className="text-zinc-500">Institución:</span>
                <p className="text-white">{extractedData.institucion}</p>
              </div>
              <div>
                <span className="text-zinc-500">Proveedor:</span>
                <p className="text-white">{extractedData.proveedor}</p>
              </div>
            </div>

            {/* New items */}
            {extractedData.instituciones_nuevas?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Instituciones Nuevas</p>
                <div className="flex flex-wrap gap-2">
                  {extractedData.instituciones_nuevas.map((item, i) => (
                    <Badge key={i} variant="outline" className="border-blue-500/50 text-blue-400">
                      <Plus className="w-3 h-3 mr-1" /> {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extractedData.informes_nuevos?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Informes Nuevos</p>
                <div className="flex flex-wrap gap-2">
                  {extractedData.informes_nuevos.map((item, i) => (
                    <Badge key={i} variant="outline" className="border-cyan-500/50 text-cyan-400">
                      <Plus className="w-3 h-3 mr-1" /> {item.substring(0, 50)}...
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extractedData.proveedores_nuevos?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Proveedores Nuevos</p>
                <div className="flex flex-wrap gap-2">
                  {extractedData.proveedores_nuevos.map((item, i) => (
                    <Badge key={i} variant="outline" className="border-purple-500/50 text-purple-400">
                      <Plus className="w-3 h-3 mr-1" /> {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extractedData.aplicaciones_nuevas?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Aplicaciones/Activos Nuevos</p>
                <div className="flex flex-wrap gap-2">
                  {extractedData.aplicaciones_nuevas.map((item, i) => (
                    <Badge key={i} variant="outline" className="border-green-500/50 text-green-400">
                      <Plus className="w-3 h-3 mr-1" /> {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleSkipCatalog}
            className="border-zinc-700 text-zinc-300"
          >
            Omitir y Continuar
          </Button>
          <Button
            onClick={handleAddCatalogItems}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Agregar al Catálogo
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Review and edit vulnerabilities one by one
  if (step === 3 && extractedData && editingVuln) {
    const totalVulns = extractedData.vulnerabilidades?.length || 0;
    const isAlreadyAdded = addedVulns.includes(currentVulnIndex);

    return (
      <div className="space-y-4">
        {/* Progress header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-500 text-indigo-400">
              {currentVulnIndex + 1} / {totalVulns}
            </Badge>
            <span className="text-zinc-400 text-sm">
              {addedVulns.length} agregadas
            </span>
          </div>
          <SeverityBadge severity={editingVuln.severidad} />
        </div>

        {/* Form */}
        <ScrollArea className="h-[450px] pr-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Fecha Hallazgo</Label>
                <Input
                  type="date"
                  value={editingVuln.fecha_hallazgo}
                  onChange={(e) => setEditingVuln({...editingVuln, fecha_hallazgo: e.target.value})}
                  className="bg-black/20 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Severidad</Label>
                <Select
                  value={editingVuln.severidad}
                  onValueChange={(v) => setEditingVuln({...editingVuln, severidad: v})}
                >
                  <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {["Critica", "Alta", "Media", "Baja"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Institución</Label>
                <Select
                  value={editingVuln.institucion}
                  onValueChange={(v) => setEditingVuln({...editingVuln, institucion: v})}
                >
                  <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {options?.instituciones?.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Proveedor</Label>
                <Select
                  value={editingVuln.proveedor}
                  onValueChange={(v) => setEditingVuln({...editingVuln, proveedor: v})}
                >
                  <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {options?.proveedores?.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Informe Pentest</Label>
              <Select
                value={editingVuln.nombre_informe_pentest}
                onValueChange={(v) => setEditingVuln({...editingVuln, nombre_informe_pentest: v})}
              >
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                  {options?.informes_pentest?.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Vulnerabilidad (Título)</Label>
              <Input
                value={editingVuln.vulnerabilidad}
                onChange={(e) => setEditingVuln({...editingVuln, vulnerabilidad: e.target.value})}
                className="bg-black/20 border-zinc-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Aplicaciones Afectadas</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editingVuln.aplicaciones.map((app, i) => (
                  <Badge key={i} variant="outline" className="border-zinc-600 text-zinc-300">
                    {app}
                    <button
                      onClick={() => setEditingVuln({
                        ...editingVuln,
                        aplicaciones: editingVuln.aplicaciones.filter((_, idx) => idx !== i)
                      })}
                      className="ml-1 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select
                onValueChange={(v) => {
                  if (!editingVuln.aplicaciones.includes(v)) {
                    setEditingVuln({
                      ...editingVuln,
                      aplicaciones: [...editingVuln.aplicaciones, v]
                    });
                  }
                }}
              >
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                  <SelectValue placeholder="Agregar aplicación..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                  {options?.aplicaciones?.filter(a => !editingVuln.aplicaciones.includes(a)).map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Descripción del Riesgo</Label>
              <Textarea
                value={editingVuln.descripcion_riesgo}
                onChange={(e) => setEditingVuln({...editingVuln, descripcion_riesgo: e.target.value})}
                className="bg-black/20 border-zinc-700 text-white min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Recomendaciones</Label>
              <Textarea
                value={editingVuln.recomendaciones}
                onChange={(e) => setEditingVuln({...editingVuln, recomendaciones: e.target.value})}
                className="bg-black/20 border-zinc-700 text-white min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Responsable (Opcional)</Label>
                <Input
                  value={editingVuln.responsable || ""}
                  onChange={(e) => setEditingVuln({...editingVuln, responsable: e.target.value})}
                  className="bg-black/20 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Fecha Compromiso (Opcional)</Label>
                <Input
                  type="date"
                  value={editingVuln.fecha_compromiso || ""}
                  onChange={(e) => setEditingVuln({...editingVuln, fecha_compromiso: e.target.value})}
                  className="bg-black/20 border-zinc-700 text-white"
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Navigation and actions */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevVuln}
              disabled={currentVulnIndex === 0}
              className="border-zinc-700 text-zinc-300"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkipVuln}
              className="border-zinc-700 text-zinc-300"
            >
              Omitir
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleFinish}
              className="border-zinc-700 text-zinc-300"
            >
              Finalizar ({addedVulns.length} agregadas)
            </Button>
            <Button
              onClick={handleAddVulnerability}
              disabled={loading || isAlreadyAdded}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isAlreadyAdded ? (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isAlreadyAdded ? "Ya Agregada" : "Agregar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
