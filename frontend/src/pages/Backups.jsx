import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { BackupHistory } from "@/components/backups/BackupHistory";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Database,
  Play,
  Settings,
  Cloud,
  HardDrive,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FolderOpen,
  Mail,
  TestTube,
  Folder,
  ChevronRight,
  ChevronUp,
  FolderPlus,
  Check,
  AlertTriangle,
  Terminal,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DIAS_SEMANA = [
  { value: "0", label: "Lunes" },
  { value: "1", label: "Martes" },
  { value: "2", label: "Miércoles" },
  { value: "3", label: "Jueves" },
  { value: "4", label: "Viernes" },
  { value: "5", label: "Sábado" },
  { value: "6", label: "Domingo" },
];

const DIAS_MES = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export default function Backups() {
  const [config, setConfig] = useState({
    habilitado: false,
    ruta_local: "",
    ruta_mongodump: "",
    google_drive_habilitado: false,
    google_drive_folder_id: "",
    google_drive_credentials: "",
    frecuencia: "diario",
    hora_ejecucion: "02:00",
    dia_semana: 0,
    dia_mes: 1,
    notificar_error: true,
    email_notificacion: "",
  });
  
  const [historyRevision, setHistoryRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [testingGDrive, setTestingGDrive] = useState(false);
  
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupDestino, setBackupDestino] = useState("local");
  const [backupRuta, setBackupRuta] = useState("");
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Folder browser state
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [folderBrowserPath, setFolderBrowserPath] = useState("");
  const [folderList, setFolderList] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderBrowserTarget, setFolderBrowserTarget] = useState("config"); // "config" or "manual"
  
  // Path validation state
  const [validatingPath, setValidatingPath] = useState(false);
  const [pathValidation, setPathValidation] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Mongodump validation state
  const [validatingMongodump, setValidatingMongodump] = useState(false);
  const [mongodumpValidation, setMongodumpValidation] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/config/backup`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (error) {
      console.error("Error fetching backup config:", error);
    }
  }, []);

  const fetchHistorial = useCallback(() => setHistoryRevision(value => value + 1), []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchConfig();
      setLoading(false);
    };
    loadData();
  }, [fetchConfig]);

  // Folder browser functions
  const openFolderBrowser = async (target = "config") => {
    setFolderBrowserTarget(target);
    setShowFolderBrowser(true);
    await loadFolders("");
  };

  const loadFolders = async (path) => {
    setLoadingFolders(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/backup/listar-carpetas`, {
        params: { ruta: path },
        headers: { Authorization: `Bearer ${token}` }
      });
      setFolderList(response.data.carpetas || []);
      setFolderBrowserPath(response.data.ruta_actual || "");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al listar carpetas");
    } finally {
      setLoadingFolders(false);
    }
  };

  const navigateToFolder = (folderPath) => {
    loadFolders(folderPath);
  };

  const navigateUp = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(`${API}/backup/listar-carpetas`, {
        params: { ruta: folderBrowserPath },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.ruta_padre) {
        loadFolders(response.data.ruta_padre);
      } else {
        loadFolders("");
      }
    } catch (error) {
      loadFolders("");
    }
  };

  const selectFolder = (folderPath) => {
    if (folderBrowserTarget === "config") {
      setConfig({ ...config, ruta_local: folderPath });
    } else {
      setBackupRuta(folderPath);
    }
    setShowFolderBrowser(false);
    // Auto-validate the selected path
    validatePath(folderPath);
  };

  const validatePath = async (path) => {
    if (!path) {
      setPathValidation(null);
      return;
    }
    setValidatingPath(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/backup/validar-ruta`, 
        { ruta: path },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPathValidation(response.data);
    } catch (error) {
      setPathValidation({
        existe: false,
        error: error.response?.data?.detail || "Error al validar ruta"
      });
    } finally {
      setValidatingPath(false);
    }
  };

  const createFolder = async () => {
    setCreatingFolder(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/backup/crear-carpeta`,
        { ruta: config.ruta_local },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success("Carpeta creada exitosamente");
      validatePath(config.ruta_local);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al crear carpeta");
    } finally {
      setCreatingFolder(false);
    }
  };

  const validateMongodump = async (ruta = "") => {
    setValidatingMongodump(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/backup/validar-mongodump`,
        { ruta_mongodump: ruta },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setMongodumpValidation(response.data);
    } catch (error) {
      setMongodumpValidation({
        encontrado: false,
        error: error.response?.data?.detail || "Error al validar mongodump"
      });
    } finally {
      setValidatingMongodump(false);
    }
  };

  // Validate mongodump on component load and when config changes
  useEffect(() => {
    if (!loading) {
      validateMongodump(config.ruta_mongodump);
    }
  }, [loading]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/config/backup`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Configuración guardada exitosamente");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleEjecutarBackup = async () => {
    setEjecutando(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API}/backup/ejecutar`, {
        destino: backupDestino,
        ruta_personalizada: backupRuta || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.estado === "exitoso") {
        toast.success(`Backup completado: ${response.data.tamaño_humano || 'N/A'}`);
      } else {
        toast.error(`Backup fallido: ${response.data.error}`);
      }
      
      setShowBackupDialog(false);
      fetchHistorial();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al ejecutar backup");
    } finally {
      setEjecutando(false);
    }
  };

  const handleTestGoogleDrive = async () => {
    setTestingGDrive(true);
    try {
      const token = localStorage.getItem("token");
      
      // First save the credentials
      await axios.put(`${API}/config/backup`, config, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Then test
      const response = await axios.post(`${API}/backup/google-drive/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al probar conexión");
    } finally {
      setTestingGDrive(false);
    }
  };

  const handleDescargar = async (backupId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API}/backup/${backupId}/descargar`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${backupId}.gz`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Descarga iniciada");
    } catch (error) {
      toast.error("Error al descargar backup");
    }
  };

  const handleEliminar = async (backupId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/backup/${backupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Backup eliminado");
      fetchHistorial();
    } catch (error) {
      toast.error("Error al eliminar backup");
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 [&_code]:break-all" data-testid="backups-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-indigo-500" />
          <div>
            <h2 className="text-base md:text-lg font-semibold text-white" data-testid="backups-heading">Backup de Base de Datos</h2>
            <p className="text-sm text-zinc-500">Configuración y gestión de respaldos</p>
          </div>
        </div>
        <Button
          onClick={() => setShowBackupDialog(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="btn-backup-manual"
        >
          <Play className="w-4 h-4 mr-2" />
          Backup Manual
        </Button>
      </div>

      {/* Configuration Card */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración de Backup Automático
          </CardTitle>
          <CardDescription>
            Configura los backups programados de la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between gap-3 p-4 bg-zinc-900 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-white font-medium">Backup Automático</p>
                <p className="text-sm text-zinc-500">Ejecutar backups de forma programada</p>
              </div>
            </div>
            <Switch
              checked={config.habilitado}
              onCheckedChange={(v) => setConfig({ ...config, habilitado: v })}
              data-testid="switch-backup-auto"
            />
          </div>

          {config.habilitado && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
              {/* Frecuencia */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Frecuencia</Label>
                <Select
                  value={config.frecuencia}
                  onValueChange={(v) => setConfig({ ...config, frecuencia: v })}
                >
                  <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="diario">Diario</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hora */}
              <div className="space-y-2">
                <Label className="text-zinc-400">Hora de Ejecución</Label>
                <Input
                  type="time"
                  value={config.hora_ejecucion}
                  onChange={(e) => setConfig({ ...config, hora_ejecucion: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>

              {/* Día de semana (para semanal) */}
              {config.frecuencia === "semanal" && (
                <div className="space-y-2">
                  <Label className="text-zinc-400">Día de la Semana</Label>
                  <Select
                    value={String(config.dia_semana)}
                    onValueChange={(v) => setConfig({ ...config, dia_semana: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>{dia.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Día del mes (para mensual) */}
              {config.frecuencia === "mensual" && (
                <div className="space-y-2">
                  <Label className="text-zinc-400">Día del Mes</Label>
                  <Select
                    value={String(config.dia_mes)}
                    onValueChange={(v) => setConfig({ ...config, dia_mes: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {DIAS_MES.map((dia) => (
                        <SelectItem key={dia.value} value={dia.value}>{dia.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Ruta local */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-zinc-400">Ruta Local de Backup</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      value={config.ruta_local}
                      onChange={(e) => {
                        setConfig({ ...config, ruta_local: e.target.value });
                        setPathValidation(null);
                      }}
                      onBlur={() => validatePath(config.ruta_local)}
                      placeholder="C:\Backups\SecFind"
                      className="bg-zinc-900 border-zinc-700 text-white pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => openFolderBrowser("config")}
                    className="border-zinc-700"
                    title="Explorar carpetas"
                  >
                    <Folder className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => validatePath(config.ruta_local)}
                    disabled={validatingPath}
                    className="border-zinc-700"
                    title="Validar ruta"
                  >
                    {validatingPath ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* Path validation result */}
                {pathValidation && (
                  <div className={`p-3 rounded-lg text-sm ${
                    pathValidation.existe && pathValidation.tiene_permisos_escritura
                      ? "bg-green-500/10 border border-green-500/30"
                      : "bg-amber-500/10 border border-amber-500/30"
                  }`}>
                    {pathValidation.existe && pathValidation.tiene_permisos_escritura ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                        <div>
                          <p className="text-green-400 font-medium">Ruta válida</p>
                          {pathValidation.espacio_disponible_humano && (
                            <p className="text-zinc-400 text-xs mt-1">
                              Espacio disponible: {pathValidation.espacio_disponible_humano} de {pathValidation.espacio_total_humano} 
                              ({pathValidation.espacio_usado_porcentaje}% usado)
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                        <div>
                          <p className="text-amber-400 font-medium">
                            {pathValidation.error || "Ruta no válida"}
                          </p>
                          {!pathValidation.existe && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={createFolder}
                              disabled={creatingFolder}
                              className="mt-2 h-7 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                            >
                              {creatingFolder ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <FolderPlus className="w-3 h-3 mr-1" />
                              )}
                              Crear carpeta
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mongodump Configuration Section */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-white font-medium">Configuración de mongodump</p>
                  <p className="text-sm text-zinc-500">Ejecutable para realizar backups de MongoDB</p>
                </div>
              </div>
              {mongodumpValidation && (
                mongodumpValidation.encontrado ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Detectado
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    No encontrado
                  </Badge>
                )
              )}
            </div>

            <div className="space-y-3 p-4 bg-zinc-900/50 rounded-lg">
              <div className="space-y-2">
                <Label className="text-zinc-400">Ruta al ejecutable mongodump (opcional)</Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                      value={config.ruta_mongodump}
                      onChange={(e) => {
                        setConfig({ ...config, ruta_mongodump: e.target.value });
                        setMongodumpValidation(null);
                      }}
                      onBlur={() => validateMongodump(config.ruta_mongodump)}
                      placeholder="Dejar vacío para auto-detectar"
                      className="bg-zinc-900 border-zinc-700 text-white pl-10 font-mono text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => validateMongodump(config.ruta_mongodump)}
                    disabled={validatingMongodump}
                    className="border-zinc-700"
                    title="Validar mongodump"
                  >
                    {validatingMongodump ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-zinc-500">
                  Si mongodump no está en el PATH del sistema, especifica la ruta completa.<br/>
                  Ejemplo Windows: <code className="bg-zinc-800 px-1 rounded">C:\mongodb-database-tools-windows-x86_64-100.18.0\bin\mongodump.exe</code>
                </p>
              </div>

              {/* Mongodump validation result */}
              {mongodumpValidation && (
                <div className={`p-3 rounded-lg text-sm ${
                  mongodumpValidation.encontrado
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                }`}>
                  {mongodumpValidation.encontrado ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 font-medium">mongodump encontrado</p>
                        {mongodumpValidation.ruta && (
                          <p className="text-zinc-400 text-xs mt-1 font-mono break-all">
                            Ruta: {mongodumpValidation.ruta}
                          </p>
                        )}
                        {mongodumpValidation.version && (
                          <p className="text-zinc-400 text-xs mt-1">
                            {mongodumpValidation.version}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                      <div>
                        <p className="text-red-400 font-medium">mongodump no encontrado</p>
                        <p className="text-zinc-400 text-xs mt-1 whitespace-pre-line">
                          {mongodumpValidation.error}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Google Drive Section */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-white font-medium">Google Drive</p>
                  <p className="text-sm text-zinc-500">Subir backups a la nube</p>
                </div>
              </div>
              <Switch
                checked={config.google_drive_habilitado}
                onCheckedChange={(v) => setConfig({ ...config, google_drive_habilitado: v })}
                data-testid="switch-gdrive"
              />
            </div>

            {config.google_drive_habilitado && (
              <div className="grid grid-cols-1 gap-4 p-4 bg-zinc-900/50 rounded-lg">
                <div className="space-y-2">
                  <Label className="text-zinc-400">Folder ID de Google Drive (opcional)</Label>
                  <Input
                    value={config.google_drive_folder_id}
                    onChange={(e) => setConfig({ ...config, google_drive_folder_id: e.target.value })}
                    placeholder="ID de la carpeta en Google Drive"
                    className="bg-zinc-900 border-zinc-700 text-white"
                  />
                  <p className="text-xs text-zinc-500">
                    Deja vacío para guardar en la raíz. El ID está en la URL de la carpeta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-400">Credenciales de Service Account (JSON)</Label>
                  <Textarea
                    value={config.google_drive_credentials === "********" ? "" : config.google_drive_credentials}
                    onChange={(e) => setConfig({ ...config, google_drive_credentials: e.target.value })}
                    placeholder='{"type": "service_account", ...}'
                    className="bg-zinc-900 border-zinc-700 text-white font-mono text-xs h-32"
                  />
                  <p className="text-xs text-zinc-500">
                    Pega el contenido del archivo JSON de la cuenta de servicio de Google Cloud.
                  </p>
                </div>

                <Button
                  variant="outline"
                  onClick={handleTestGoogleDrive}
                  disabled={testingGDrive}
                  className="w-fit"
                >
                  {testingGDrive ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4 mr-2" />
                  )}
                  Probar Conexión
                </Button>
              </div>
            )}
          </div>

          {/* Notificaciones */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-white font-medium">Notificar Errores</p>
                  <p className="text-sm text-zinc-500">Enviar email cuando un backup falle</p>
                </div>
              </div>
              <Switch
                checked={config.notificar_error}
                onCheckedChange={(v) => setConfig({ ...config, notificar_error: v })}
              />
            </div>

            {config.notificar_error && (
              <div className="space-y-2 p-4 bg-zinc-900/50 rounded-lg">
                <Label className="text-zinc-400">Email de Notificación</Label>
                <Input
                  type="email"
                  value={config.email_notificacion}
                  onChange={(e) => setConfig({ ...config, email_notificacion: e.target.value })}
                  placeholder="admin@empresa.com"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar Configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      <BackupHistory refreshKey={historyRevision} onDownload={handleDescargar} onDelete={setDeleteConfirm} />

      {/* Backup Manual Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="bg-[#1c1c1e] border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Ejecutar Backup Manual</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Realiza un backup inmediato de la base de datos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Destino del Backup</Label>
              <Select value={backupDestino} onValueChange={setBackupDestino}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="local">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Solo Local
                    </div>
                  </SelectItem>
                  {config.google_drive_habilitado && (
                    <>
                      <SelectItem value="google_drive">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4" />
                          Solo Google Drive
                        </div>
                      </SelectItem>
                      <SelectItem value="ambos">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4" />
                          Local + Google Drive
                        </div>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {backupDestino !== "google_drive" && (
              <div className="space-y-2">
                <Label className="text-zinc-400">Ruta Personalizada (opcional)</Label>
                <Input
                  value={backupRuta}
                  onChange={(e) => setBackupRuta(e.target.value)}
                  placeholder={config.ruta_local || "Ruta configurada por defecto"}
                  className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm"
                />
                <p className="text-xs text-zinc-500">
                  Deja vacío para usar la ruta configurada: <code className="bg-zinc-800 px-1 rounded">{config.ruta_local || "(por defecto)"}</code>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBackupDialog(false)}
              className="border-zinc-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEjecutarBackup}
              disabled={ejecutando}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {ejecutando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Ejecutar Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent data-testid="backup-delete-dialog" className="bg-[#1c1c1e] border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="backup-delete-title" className="text-white">¿Eliminar backup?</AlertDialogTitle>
            <AlertDialogDescription data-testid="backup-delete-description" className="text-zinc-400">
              Esta acción eliminará el archivo de backup y su registro del historial.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="backup-delete-cancel" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="backup-delete-confirm"
              onClick={() => handleEliminar(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Folder Browser Dialog */}
      <Dialog open={showFolderBrowser} onOpenChange={setShowFolderBrowser}>
        <DialogContent className="bg-[#1c1c1e] border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
              Seleccionar Carpeta
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Navega y selecciona la carpeta donde guardar los backups
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current path */}
            <div className="flex items-center gap-2 p-2 bg-zinc-900 rounded-lg">
              <FolderOpen className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-300 truncate flex-1 font-mono">
                {folderBrowserPath || "Unidades / Raíz"}
              </span>
              {folderBrowserPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={navigateUp}
                  className="h-7 px-2"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Folder list */}
            <ScrollArea className="h-[300px] border border-zinc-800 rounded-lg">
              {loadingFolders ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                </div>
              ) : folderList.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No hay carpetas disponibles
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {folderList.map((folder, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                        folder.sin_acceso 
                          ? "opacity-50 cursor-not-allowed" 
                          : "hover:bg-zinc-800"
                      }`}
                      onClick={() => !folder.sin_acceso && navigateToFolder(folder.ruta)}
                      onDoubleClick={() => !folder.sin_acceso && selectFolder(folder.ruta)}
                    >
                      {folder.es_drive ? (
                        <HardDrive className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Folder className="w-5 h-5 text-amber-400" />
                      )}
                      <span className="text-sm text-zinc-200 flex-1 truncate">
                        {folder.nombre}
                      </span>
                      {folder.sin_acceso && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                          Sin acceso
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <p className="text-xs text-zinc-500">
              Haz doble clic en una carpeta para seleccionarla, o navega dentro y usa el botón Seleccionar
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFolderBrowser(false)}
              className="border-zinc-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectFolder(folderBrowserPath)}
              disabled={!folderBrowserPath}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Seleccionar esta carpeta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
