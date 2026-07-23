import { useState, useRef, useEffect } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Check,
  ChevronsUpDown,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Opciones de Nivel de Riesgo Corporativo GRC
const NIVEL_RIESGO_OPTIONS = ["Alto", "Medio Alto", "Medio", "Bajo"];

// Colores para el badge de Nivel de Riesgo
const getNivelRiesgoClass = (nivel) => {
  switch (nivel) {
    case "Alto":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "Medio Alto":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Medio":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Bajo":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    default:
      return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
};

// Searchable Combobox Component para selección simple
const SearchableSelect = ({ value, onValueChange, options, placeholder, emptyMessage = "No hay opciones" }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredOptions = options?.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-black/20 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
          data-testid="searchable-select-trigger"
        >
          <span className="truncate text-left flex-1">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-zinc-900 border-zinc-700" align="start">
        <Command className="bg-zinc-900">
          <div className="flex items-center border-b border-zinc-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            <input
              placeholder={`Buscar...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              data-testid="searchable-select-input"
            />
          </div>
          <CommandList className="max-h-[200px]">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">{emptyMessage}</div>
            ) : (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      onValueChange(option);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="text-zinc-200 cursor-pointer hover:bg-zinc-800 data-[selected=true]:bg-zinc-800"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100 text-green-500" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Searchable Multi-Select Combobox para aplicaciones
const SearchableMultiSelect = ({ values = [], onValuesChange, options, placeholder, emptyMessage = "No hay opciones" }) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredOptions = options?.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase()) && !values.includes(option)
  ) || [];

  const handleSelect = (option) => {
    onValuesChange([...values, option]);
    setSearchQuery("");
  };

  const handleRemove = (optionToRemove) => {
    onValuesChange(values.filter((v) => v !== optionToRemove));
  };

  return (
    <div className="space-y-2">
      {/* Selected items */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((item, i) => (
            <Badge key={i} variant="outline" className="border-zinc-600 text-zinc-300">
              {item}
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="ml-1 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-black/20 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white"
            data-testid="searchable-multi-select-trigger"
          >
            <span className="text-zinc-400">
              {placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-zinc-900 border-zinc-700" align="start">
          <Command className="bg-zinc-900">
            <div className="flex items-center border-b border-zinc-700 px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
              <input
                placeholder={`Buscar aplicación...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-10 w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                data-testid="searchable-multi-select-input"
              />
            </div>
            <CommandList className="max-h-[200px]">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-500">
                  {searchQuery ? "No se encontraron aplicaciones" : emptyMessage}
                </div>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => handleSelect(option)}
                      className="text-zinc-200 cursor-pointer hover:bg-zinc-800 data-[selected=true]:bg-zinc-800"
                    >
                      <Plus className="mr-2 h-4 w-4 text-zinc-400" />
                      <span className="truncate">{option}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

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
  const [extractionMethod, setExtractionMethod] = useState("rules"); // "ai" or "rules"
  const [parserType, setParserType] = useState("pentraze");

  const canImport = isAdmin || canCreate("vulnerabilidades");

  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/dropdown-options`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
      const token = localStorage.getItem("token");
      let response;
      
      if (extractionMethod === "rules") {
        // Use rule-based parser (no AI required)
        formData.append('parser_type', parserType);
        response = await axios.post(`${API}/import/pdf/extract-rules`, formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Transform response to match AI format
        const rulesData = response.data;
        const newInforme = rulesData.metadata?.nombre_informe || "";
        const newInstitucion = rulesData.metadata?.institucion || "";
        const newProveedor = rulesData.metadata?.proveedor || "";
        
        setExtractedData({
          nombre_informe: newInforme,
          fecha_informe: rulesData.metadata?.fecha_informe || "",
          institucion: newInstitucion,
          proveedor: newProveedor,
          aplicacion_evaluada: "",
          vulnerabilidades: rulesData.vulnerabilities?.map(v => ({
            titulo: v.vulnerabilidad,
            severidad: v.severidad,
            activos_tecnicos: v.aplicaciones || [],
            descripcion: v.descripcion_riesgo || "",
            impacto: v.riesgo_asociado || "",
            recomendaciones: v.recomendaciones || "",
            codigo: v.codigo || "",
          })) || [],
          // For rules parser, track new items for merging with options
          aplicaciones_nuevas: [],
          informes_nuevos: newInforme ? [newInforme] : [],
          proveedores_nuevos: newProveedor ? [newProveedor] : [],
          instituciones_nuevas: newInstitucion ? [newInstitucion] : [],
        });
        
        // Fetch options first, then merge with new items from extraction
        const optionsResponse = await axios.get(`${API}/dropdown-options`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Merge extracted values into options (so they appear in dropdowns)
        const mergedOptions = {
          ...optionsResponse.data,
          informes_pentest: newInforme && !optionsResponse.data.informes_pentest?.includes(newInforme)
            ? [newInforme, ...(optionsResponse.data.informes_pentest || [])]
            : optionsResponse.data.informes_pentest,
          instituciones: newInstitucion && !optionsResponse.data.instituciones?.includes(newInstitucion)
            ? [newInstitucion, ...(optionsResponse.data.instituciones || [])]
            : optionsResponse.data.instituciones,
          proveedores: newProveedor && !optionsResponse.data.proveedores?.includes(newProveedor)
            ? [newProveedor, ...(optionsResponse.data.proveedores || [])]
            : optionsResponse.data.proveedores,
        };
        setOptions(mergedOptions);
        
        setStep(3);
        
        // Prepare first vulnerability
        if (rulesData.vulnerabilities?.length > 0) {
          const vuln = rulesData.vulnerabilities[0];
          // Calcular nivel_riesgo desde severidad si no viene
          const severidadToNivelRiesgo = {
            "Critica": "Alto",
            "Alta": "Medio Alto", 
            "Media": "Medio",
            "Baja": "Bajo"
          };
          const nivelRiesgo = vuln.nivel_riesgo || severidadToNivelRiesgo[vuln.severidad] || "Medio";
          
          setEditingVuln({
            codigo: vuln.codigo || "",
            fecha_hallazgo: rulesData.metadata?.fecha_informe || new Date().toISOString().split('T')[0],
            institucion: rulesData.metadata?.institucion || "",
            aplicaciones: vuln.aplicaciones || [],
            vulnerabilidad: vuln.vulnerabilidad || "",
            recomendaciones: vuln.recomendaciones || "",
            severidad: vuln.severidad || "Media",
            nivel_riesgo: nivelRiesgo,
            estatus: "Pendiente",
            nombre_informe_pentest: rulesData.metadata?.nombre_informe || "",
            proveedor: rulesData.metadata?.proveedor || "",
            descripcion_riesgo: vuln.descripcion_riesgo || "",
            riesgo_asociado: vuln.riesgo_asociado || "",
          });
        }
        
        toast.success(`Se extrajeron ${rulesData.total || 0} vulnerabilidades usando parser de reglas`);
        
      } else {
        // Use AI-based extraction
        response = await axios.post(`${API}/import/pdf/extract`, formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
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
      }
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
      // Use the main application evaluated, not the technical assets
      const aplicacion = data.aplicacion_evaluada ? [data.aplicacion_evaluada] : [];
      // Include technical assets in description
      const activosTecnicos = vuln.activos_tecnicos || [];
      let descripcion = vuln.descripcion || "";
      if (activosTecnicos.length > 0) {
        descripcion += `\n\nActivos técnicos afectados: ${activosTecnicos.join(", ")}`;
      }
      if (vuln.impacto) {
        descripcion += `\n\nImpacto: ${vuln.impacto}`;
      }
      
      // Calcular nivel_riesgo desde severidad
      const severidadToNivelRiesgo = {
        "Critica": "Alto",
        "Alta": "Medio Alto", 
        "Media": "Medio",
        "Baja": "Bajo"
      };
      const severidad = vuln.severidad || "Media";
      const nivelRiesgo = severidadToNivelRiesgo[severidad] || "Medio";
      
      setEditingVuln({
        fecha_hallazgo: data.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: data.institucion || "",
        aplicaciones: aplicacion,
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: descripcion.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: severidad,
        nivel_riesgo: nivelRiesgo,
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
      const token = localStorage.getItem("token");
      await axios.post(`${API}/import/pdf/add-catalog-items`, null, {
        headers: { 'Authorization': `Bearer ${token}` },
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
      const token = localStorage.getItem("token");
      await axios.post(`${API}/import/pdf/add-vulnerability`, editingVuln, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
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
      // Use the main application evaluated, not the technical assets
      const aplicacion = extractedData.aplicacion_evaluada ? [extractedData.aplicacion_evaluada] : [];
      // Include technical assets in description
      const activosTecnicos = vuln.activos_tecnicos || [];
      let descripcion = vuln.descripcion || "";
      if (activosTecnicos.length > 0) {
        descripcion += `\n\nActivos técnicos afectados: ${activosTecnicos.join(", ")}`;
      }
      if (vuln.impacto) {
        descripcion += `\n\nImpacto: ${vuln.impacto}`;
      }
      
      // Calcular nivel_riesgo desde severidad
      const severidadToNivelRiesgo = {
        "Critica": "Alto",
        "Alta": "Medio Alto", 
        "Media": "Medio",
        "Baja": "Bajo"
      };
      const severidad = vuln.severidad || "Media";
      const nivelRiesgo = severidadToNivelRiesgo[severidad] || "Medio";
      
      setEditingVuln({
        fecha_hallazgo: extractedData.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: extractedData.institucion || "",
        aplicaciones: aplicacion,
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: descripcion.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: severidad,
        nivel_riesgo: nivelRiesgo,
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
      // Use the main application evaluated, not the technical assets
      const aplicacion = extractedData.aplicacion_evaluada ? [extractedData.aplicacion_evaluada] : [];
      // Include technical assets in description
      const activosTecnicos = vuln.activos_tecnicos || [];
      let descripcion = vuln.descripcion || "";
      if (activosTecnicos.length > 0) {
        descripcion += `\n\nActivos técnicos afectados: ${activosTecnicos.join(", ")}`;
      }
      if (vuln.impacto) {
        descripcion += `\n\nImpacto: ${vuln.impacto}`;
      }
      
      // Calcular nivel_riesgo desde severidad
      const severidadToNivelRiesgo = {
        "Critica": "Alto",
        "Alta": "Medio Alto", 
        "Media": "Medio",
        "Baja": "Bajo"
      };
      const severidad = vuln.severidad || "Media";
      const nivelRiesgo = severidadToNivelRiesgo[severidad] || "Medio";
      
      setEditingVuln({
        fecha_hallazgo: extractedData.fecha_informe || new Date().toISOString().split('T')[0],
        institucion: extractedData.institucion || "",
        aplicaciones: aplicacion,
        vulnerabilidad: vuln.titulo || "",
        descripcion_riesgo: descripcion.trim(),
        recomendaciones: vuln.recomendaciones || "",
        severidad: severidad,
        nivel_riesgo: nivelRiesgo,
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

        {/* Extraction Method Selection */}
        <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <Label className="text-zinc-300 text-sm font-medium">Método de Extracción</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setExtractionMethod("rules")}
              className={`p-3 rounded-lg border text-left transition-all ${
                extractionMethod === "rules" 
                  ? "border-green-500 bg-green-500/10 text-green-400" 
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium mb-1">📋 Parser de Reglas</div>
              <div className="text-xs opacity-75">Sin API Key • Gratis • Formato Pentraze</div>
            </button>
            <button
              type="button"
              onClick={() => setExtractionMethod("ai")}
              className={`p-3 rounded-lg border text-left transition-all ${
                extractionMethod === "ai" 
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400" 
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium mb-1">🤖 Inteligencia Artificial</div>
              <div className="text-xs opacity-75">Requiere API Key • Cualquier formato</div>
            </button>
          </div>
          
          {extractionMethod === "rules" && (
            <div className="pt-2">
              <Label className="text-zinc-400 text-xs">Tipo de Informe</Label>
              <Select value={parserType} onValueChange={setParserType}>
                <SelectTrigger className="mt-1 bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="pentraze">Pentraze Cybersecurity</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500 mt-1">
                Compatible con informes de Pentraze Cybersecurity
              </p>
            </div>
          )}
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
              <p className="text-zinc-400">
                {extractionMethod === "rules" ? "Procesando PDF con reglas..." : "Procesando PDF con IA..."}
              </p>
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
            {extractedData.aplicaciones_nuevas?.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Aplicación Evaluada (Nueva)</p>
                <div className="flex flex-wrap gap-2">
                  {extractedData.aplicaciones_nuevas.map((item, i) => (
                    <Badge key={i} variant="outline" className="border-green-500/50 text-green-400">
                      <Plus className="w-3 h-3 mr-1" /> {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

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
              <SearchableSelect
                value={editingVuln.nombre_informe_pentest}
                onValueChange={(v) => setEditingVuln({...editingVuln, nombre_informe_pentest: v})}
                options={options?.informes_pentest || []}
                placeholder="Buscar informe..."
                emptyMessage="No hay informes disponibles"
              />
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
              <SearchableMultiSelect
                values={editingVuln.aplicaciones}
                onValuesChange={(apps) => setEditingVuln({...editingVuln, aplicaciones: apps})}
                options={options?.aplicaciones || []}
                placeholder="Buscar y agregar aplicación..."
                emptyMessage="No hay aplicaciones disponibles"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Nivel de Riesgo Corporativo GRC</Label>
              <Select
                value={editingVuln.nivel_riesgo}
                onValueChange={(v) => setEditingVuln({...editingVuln, nivel_riesgo: v})}
              >
                <SelectTrigger className="bg-black/20 border-zinc-700 text-white">
                  <SelectValue placeholder="Seleccionar nivel de riesgo..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {NIVEL_RIESGO_OPTIONS.map((nivel) => (
                    <SelectItem key={nivel} value={nivel}>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getNivelRiesgoClass(nivel)}`}>
                        {nivel}
                      </span>
                    </SelectItem>
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
