import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, FileText, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Formulario reutilizable para registrar seguimiento de vulnerabilidades.
 * Se usa tanto en el módulo de Seguimiento como en el modal de Detalle de Vulnerabilidad.
 * 
 * @param {string} vulnId - ID de la vulnerabilidad
 * @param {string} currentFechaCompromiso - Fecha compromiso actual de la vulnerabilidad
 * @param {function} onSuccess - Callback cuando se guarda exitosamente (recibe la vuln actualizada)
 * @param {function} onCancel - Callback para cancelar (opcional, si no se pasa no muestra botón cancelar)
 * @param {boolean} compact - Modo compacto para espacios reducidos
 */
export const SeguimientoForm = ({ 
  vulnId, 
  currentFechaCompromiso,
  onSuccess, 
  onCancel,
  compact = false 
}) => {
  const [formData, setFormData] = useState({
    resultado_retest: "",
    fecha_compromiso_asignada: "",
    notas_impedimento: ""
  });
  const [saving, setSaving] = useState(false);

  // Estados que NO requieren fecha (la limpian o congelan)
  const ESTADOS_SIN_FECHA = ["Corregido", "Desestimado", "En Retest", "Nota de Seguimiento"];

  const handleResultadoChange = (value) => {
    const limpiarFecha = ESTADOS_SIN_FECHA.includes(value);
    setFormData(prev => ({
      ...prev,
      resultado_retest: value,
      fecha_compromiso_asignada: limpiarFecha ? "" : prev.fecha_compromiso_asignada
    }));
  };

  const getMensajeEstado = () => {
    const r = formData.resultado_retest;
    if (r === "Corregido" || r === "Desestimado") return "(No aplica para cierre)";
    if (r === "En Retest") return "(Se congela fecha - En validación)";
    if (r === "Nota de Seguimiento") return "(No altera fecha)";
    return "";
  };

  const handleSubmit = async () => {
    if (!formData.resultado_retest) {
      toast.error("Selecciona un resultado de retest");
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API}/seguimiento/${vulnId}/registrar`, formData);
      toast.success("Seguimiento registrado exitosamente");
      
      // Limpiar formulario
      setFormData({
        resultado_retest: "",
        fecha_compromiso_asignada: "",
        notas_impedimento: ""
      });

      // Callback de éxito
      if (onSuccess) {
        onSuccess(response.data.vulnerabilidad);
      }
    } catch (error) {
      console.error("Error registrando seguimiento:", error);
      toast.error(error.response?.data?.detail || "Error al registrar seguimiento");
    } finally {
      setSaving(false);
    }
  };

  const deshabilitarFecha = ESTADOS_SIN_FECHA.includes(formData.resultado_retest);
  const mensajeEstado = getMensajeEstado();
  const mostrarWarningFecha = formData.fecha_compromiso_asignada && 
    formData.fecha_compromiso_asignada !== currentFechaCompromiso && 
    !deshabilitarFecha;

  return (
    <div className={`space-y-4 bg-zinc-800/50 ${compact ? 'p-3' : 'p-4'} rounded-lg border border-zinc-700`}>
      <h4 className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-zinc-300 flex items-center gap-2`}>
        <FileText className={compact ? "w-3 h-3" : "w-4 h-4"} />
        Registrar Seguimiento / Impedimento
      </h4>
      
      <div className={`grid ${compact ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
        {/* Resultado Retest */}
        <div className="space-y-2">
          <Label className={`text-zinc-400 ${compact ? 'text-xs' : ''}`}>Resultado Retest *</Label>
          <Select
            value={formData.resultado_retest}
            onValueChange={handleResultadoChange}
          >
            <SelectTrigger 
              className={`bg-zinc-900 border-zinc-700 ${compact ? 'h-8 text-xs' : ''}`} 
              data-testid="seguimiento-form-resultado"
            >
              <SelectValue placeholder="Seleccionar resultado" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="Corregido">Corregido - Remediación exitosa</SelectItem>
              <SelectItem value="Pendiente">Pendiente - Prórroga o retest fallido</SelectItem>
              <SelectItem value="Impedimento">Impedimento - Bloqueo operativo</SelectItem>
              <SelectItem value="Vulnerable">Vulnerable - Persiste tras validación</SelectItem>
              <SelectItem value="Desestimado">Desestimado - Falso positivo / Riesgo aceptado</SelectItem>
              <SelectItem value="En Retest">En Retest - En validación con proveedor</SelectItem>
              <SelectItem value="Nota de Seguimiento">Nota de Seguimiento - Comentario</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Fecha Compromiso */}
        <div className="space-y-2">
          <Label className={`${deshabilitarFecha ? 'text-zinc-600' : 'text-zinc-400'} ${compact ? 'text-xs' : ''}`}>
            Nueva Fecha Compromiso
            {deshabilitarFecha && (
              <span className="text-xs text-zinc-500 ml-2">{mensajeEstado}</span>
            )}
          </Label>
          <Input
            type="date"
            value={formData.fecha_compromiso_asignada}
            onChange={(e) => setFormData(prev => ({ ...prev, fecha_compromiso_asignada: e.target.value }))}
            className={`bg-zinc-900 border-zinc-700 ${deshabilitarFecha ? 'opacity-50 cursor-not-allowed' : ''} ${compact ? 'h-8 text-xs' : ''}`}
            disabled={deshabilitarFecha}
            data-testid="seguimiento-form-fecha"
          />
          {mostrarWarningFecha && (
            <p className="text-xs text-amber-400">Se incrementará el contador de reprogramaciones</p>
          )}
        </div>
      </div>

      {/* Notas */}
      <div className="space-y-2">
        <Label className={`text-zinc-400 ${compact ? 'text-xs' : ''}`}>Notas / Detalle del Impedimento</Label>
        <Textarea
          value={formData.notas_impedimento}
          onChange={(e) => setFormData(prev => ({ ...prev, notas_impedimento: e.target.value }))}
          placeholder="Describe el impedimento, bloqueo o notas relevantes..."
          className={`bg-zinc-900 border-zinc-700 ${compact ? 'min-h-[60px] text-xs' : 'min-h-[80px]'}`}
          data-testid="seguimiento-form-notas"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={saving || !formData.resultado_retest}
          className={`bg-green-600 hover:bg-green-700 ${compact ? 'h-8 text-xs px-3' : ''}`}
          data-testid="seguimiento-form-guardar"
        >
          <Save className={compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2"} />
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className={`border-zinc-600 ${compact ? 'h-8 text-xs px-3' : ''}`}
          >
            <X className={compact ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2"} />
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
};

export default SeguimientoForm;
