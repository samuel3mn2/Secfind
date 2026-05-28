import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, Send, TestTube, Bell, Clock, Users, Calendar } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Notificaciones() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [enviandoResumen, setEnviandoResumen] = useState(false);
  
  const [config, setConfig] = useState({
    habilitado: false,
    smtp_servidor: "smtp.gmail.com",
    smtp_puerto: 587,
    smtp_email: "",
    smtp_password: "",
    smtp_usar_tls: true,
    alertas: {
      dias_7: true,
      dias_3: true,
      dias_1: true
    },
    enviar_a_responsables: false,
    resumen_semanal: true,
    ultima_ejecucion: null
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API}/config/notificaciones`);
      setConfig(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error("Error fetching config:", error);
      // Use defaults if not found
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/config/notificaciones`, config);
      toast.success("Configuración guardada exitosamente");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      // First save current config
      await axios.put(`${API}/config/notificaciones`, config);
      // Then test
      await axios.post(`${API}/config/notificaciones/test`);
      toast.success("Conexión SMTP exitosa");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error de conexión SMTP");
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      const response = await axios.post(`${API}/config/notificaciones/send-test-email`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enviar email de prueba");
    } finally {
      setSendingTest(false);
    }
  };

  const handleEjecutarNotificaciones = async () => {
    setEjecutando(true);
    try {
      const response = await axios.post(`${API}/notificaciones/ejecutar`);
      toast.success(response.data.message);
      fetchConfig(); // Refresh to get updated ultima_ejecucion
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al ejecutar notificaciones");
    } finally {
      setEjecutando(false);
    }
  };

  const handleEnviarResumen = async () => {
    setEnviandoResumen(true);
    try {
      const response = await axios.post(`${API}/notificaciones/resumen-semanal`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al enviar resumen");
    } finally {
      setEnviandoResumen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600/20">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">Notificaciones por Email</CardTitle>
              <CardDescription className="text-zinc-500">
                Configura alertas automáticas para fechas de compromiso de vulnerabilidades y hallazgos de auditoría
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center gap-3">
              <Switch
                id="habilitado"
                checked={config.habilitado}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, habilitado: checked }))}
                data-testid="notif-enabled-switch"
              />
              <Label htmlFor="habilitado" className="text-white font-medium cursor-pointer">
                {config.habilitado ? "Notificaciones Activas" : "Notificaciones Desactivadas"}
              </Label>
            </div>
            {config.ultima_ejecucion && (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Última ejecución: {new Date(config.ultima_ejecucion).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SMTP Configuration */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-zinc-400" />
            <CardTitle className="text-white text-base">Configuración SMTP</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Para Gmail: usa smtp.gmail.com con una App Password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Servidor SMTP</Label>
              <Input
                value={config.smtp_servidor}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_servidor: e.target.value }))}
                placeholder="smtp.gmail.com"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="smtp-server-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Puerto</Label>
              <Input
                type="number"
                value={config.smtp_puerto}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_puerto: parseInt(e.target.value) || 587 }))}
                placeholder="587"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="smtp-port-input"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">Email</Label>
              <Input
                type="email"
                value={config.smtp_email}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_email: e.target.value }))}
                placeholder="tu-email@gmail.com"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="smtp-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Contraseña / App Password</Label>
              <Input
                type="password"
                value={config.smtp_password}
                onChange={(e) => setConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                placeholder="••••••••••••••••"
                className="bg-zinc-900 border-zinc-700 text-white"
                data-testid="smtp-password-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="usar_tls"
              checked={config.smtp_usar_tls}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, smtp_usar_tls: checked }))}
            />
            <Label htmlFor="usar_tls" className="text-zinc-400 cursor-pointer">
              Usar TLS (recomendado para Gmail)
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || !config.smtp_email || !config.smtp_password}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              data-testid="test-connection-btn"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube className="w-4 h-4 mr-2" />}
              Probar Conexión
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTestEmail}
              disabled={sendingTest || !config.smtp_email || !config.smtp_password}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              data-testid="send-test-email-btn"
            >
              {sendingTest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar Email de Prueba
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Configuration */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <CardTitle className="text-white text-base">Configuración de Alertas</CardTitle>
          </div>
          <CardDescription className="text-zinc-500">
            Elige cuándo enviar alertas antes del vencimiento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">7 días antes</p>
                  <p className="text-xs text-zinc-500">Alerta anticipada</p>
                </div>
                <Switch
                  checked={config.alertas?.dias_7 ?? true}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    alertas: { ...prev.alertas, dias_7: checked }
                  }))}
                  data-testid="alert-7-days-switch"
                />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">3 días antes</p>
                  <p className="text-xs text-zinc-500">Recordatorio</p>
                </div>
                <Switch
                  checked={config.alertas?.dias_3 ?? true}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    alertas: { ...prev.alertas, dias_3: checked }
                  }))}
                  data-testid="alert-3-days-switch"
                />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">1 día antes</p>
                  <p className="text-xs text-zinc-500">Urgente</p>
                </div>
                <Switch
                  checked={config.alertas?.dias_1 ?? true}
                  onCheckedChange={(checked) => setConfig(prev => ({
                    ...prev,
                    alertas: { ...prev.alertas, dias_1: checked }
                  }))}
                  data-testid="alert-1-day-switch"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients & Summary */}
      <Card className="bg-[#18181b] border-[#27272a]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            <CardTitle className="text-white text-base">Destinatarios y Resumen</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div>
              <p className="text-white font-medium">Enviar también a responsables</p>
              <p className="text-xs text-zinc-500">Además de administradores, enviar al responsable de cada vulnerabilidad o hallazgo de auditoría</p>
            </div>
            <Switch
              checked={config.enviar_a_responsables}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enviar_a_responsables: checked }))}
              data-testid="send-to-responsables-switch"
            />
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
            <div>
              <p className="text-white font-medium">Resumen semanal</p>
              <p className="text-xs text-zinc-500">Enviar resumen los lunes con todas las remediaciones (vulnerabilidades y hallazgos) próximas a vencer</p>
            </div>
            <Switch
              checked={config.resumen_semanal}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, resumen_semanal: checked }))}
              data-testid="weekly-summary-switch"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2">
          <Button
            onClick={handleEjecutarNotificaciones}
            disabled={ejecutando || !config.habilitado}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="execute-notifications-btn"
          >
            {ejecutando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
            Ejecutar Ahora
          </Button>
          <Button
            onClick={handleEnviarResumen}
            disabled={enviandoResumen || !config.habilitado}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="send-summary-btn"
          >
            {enviandoResumen ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Enviar Resumen
          </Button>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          data-testid="save-notif-config-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Guardar Configuración
        </Button>
      </div>

      {/* Help Text */}
      <Card className="bg-amber-950/20 border-amber-500/30">
        <CardContent className="pt-4">
          <h4 className="text-amber-400 font-medium mb-2">Configuración de Gmail</h4>
          <ol className="text-sm text-amber-300/80 space-y-1 list-decimal list-inside">
            <li>Activa la verificación en 2 pasos en tu cuenta de Google</li>
            <li>Ve a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-200">myaccount.google.com/apppasswords</a></li>
            <li>Genera una nueva contraseña de aplicación</li>
            <li>Usa esa contraseña (16 caracteres) en el campo "App Password"</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
