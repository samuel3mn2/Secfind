import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, CheckCircle2, AlertTriangle, FileEdit } from "lucide-react";

/**
 * Modal de confirmación con comparación visual (Diff) antes de guardar cambios.
 * Muestra los campos que han sido modificados entre el objeto original y el editado.
 * 
 * @param {boolean} open - Controla si el modal está abierto
 * @param {function} onOpenChange - Callback cuando cambia el estado del modal
 * @param {object} originalData - Objeto original de la base de datos
 * @param {object} editedData - Objeto modificado en el formulario
 * @param {function} onConfirm - Callback cuando se confirman los cambios
 * @param {function} onCancel - Callback cuando se cancela (seguir editando)
 * @param {boolean} loading - Estado de carga durante el guardado
 * @param {string} entityType - Tipo de entidad (ej: "vulnerabilidad", "hallazgo")
 * @param {object} fieldLabels - Mapeo opcional de nombres de campo a etiquetas legibles
 */
export function ConfirmChangesModal({
  open,
  onOpenChange,
  originalData,
  editedData,
  onConfirm,
  onCancel,
  loading = false,
  entityType = "registro",
  fieldLabels = {},
}) {
  // Campos a ignorar en la comparación
  const IGNORED_FIELDS = [
    "id", "_id", "created_at", "updated_at", "timestamp",
    "historial_impedimentos_seguimiento", "codigo", "veces_cambiada_fecha"
  ];

  // Mapeo de nombres de campo a etiquetas legibles por defecto
  const DEFAULT_LABELS = {
    // Vulnerabilidades
    vulnerabilidad: "Vulnerabilidad",
    severidad: "Severidad",
    estatus: "Estatus",
    responsable: "Responsable",
    fecha_compromiso: "Fecha Compromiso",
    descripcion_riesgo: "Descripción del Riesgo",
    recomendaciones: "Recomendaciones",
    institucion: "Institución",
    aplicaciones: "Aplicaciones",
    proveedor: "Proveedor",
    nombre_informe_pentest: "Informe Pentest",
    resultado_re_test: "Resultado Retest",
    veces_en_retest: "Veces en Retest",
    nivel_riesgo: "Nivel de Riesgo",
    control_id: "Control Asociado",
    riesgo_id: "Riesgo del Catálogo",
    fecha_hallazgo: "Fecha Hallazgo",
    // Hallazgos de Auditoría
    brecha: "Brecha/Hallazgo",
    probabilidad: "Probabilidad",
    impacto: "Impacto",
    riesgo_inherente: "Riesgo Inherente",
    estado: "Estado",
    observaciones: "Observaciones",
    fecha_identificacion: "Fecha Identificación",
    fecha_compromiso_remediacion: "Fecha Compromiso Remediación",
    control_asociado_id: "Control Asociado",
    evidencia: "Evidencia",
    plan_remediacion: "Plan de Remediación",
    // Catálogo de Riesgos
    codigo_riesgo: "Código de Riesgo",
    nombre_corto: "Nombre Corto",
    descripcion_completa: "Descripción Completa",
    categoria: "Categoría",
    ...fieldLabels,
  };

  // Calcular los cambios entre original y editado
  const changes = useMemo(() => {
    if (!originalData || !editedData) return [];

    const changedFields = [];
    const allKeys = new Set([
      ...Object.keys(originalData || {}),
      ...Object.keys(editedData || {}),
    ]);

    allKeys.forEach((key) => {
      if (IGNORED_FIELDS.includes(key)) return;

      const oldVal = originalData[key];
      const newVal = editedData[key];

      // Normalizar valores para comparación
      const normalizeValue = (val) => {
        if (val === null || val === undefined || val === "") return null;
        if (Array.isArray(val)) return val.length === 0 ? null : val.sort().join(", ");
        return String(val);
      };

      const normalizedOld = normalizeValue(oldVal);
      const normalizedNew = normalizeValue(newVal);

      if (normalizedOld !== normalizedNew) {
        changedFields.push({
          field: key,
          label: DEFAULT_LABELS[key] || key,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    });

    return changedFields;
  }, [originalData, editedData, fieldLabels]);

  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-zinc-500 italic">(vacío)</span>;
    }
    if (Array.isArray(value)) {
      return value.length === 0 ? (
        <span className="text-zinc-500 italic">(vacío)</span>
      ) : (
        <span>{value.join(", ")}</span>
      );
    }
    // Truncar valores muy largos
    const strValue = String(value);
    if (strValue.length > 100) {
      return <span title={strValue}>{strValue.slice(0, 100)}...</span>;
    }
    return <span>{strValue}</span>;
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-400">
            <FileEdit className="w-5 h-5" />
            Confirmar Cambios
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {changes.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="text-zinc-300">No se detectaron cambios en {entityType}.</p>
              <p className="text-zinc-500 text-sm mt-1">
                Los datos son idénticos al registro original.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-amber-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Vas a realizar los siguientes cambios en {entityType}:
                </p>
              </div>

              <ScrollArea className="max-h-[400px] pr-2">
                <div className="space-y-3">
                  {changes.map((change, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700"
                      data-testid={`diff-field-${change.field}`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                          {change.label}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <span className="text-xs text-zinc-500 block mb-1">Valor anterior:</span>
                          <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-red-300 text-sm break-words">
                            {formatValue(change.oldValue)}
                          </div>
                        </div>
                        <div className="flex items-center justify-center pt-6">
                          <ArrowRight className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div className="flex-1">
                          <span className="text-xs text-zinc-500 block mb-1">Nuevo valor:</span>
                          <div className="bg-green-500/10 border border-green-500/20 rounded p-2 text-green-300 text-sm break-words">
                            {formatValue(change.newValue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="text-center text-sm text-zinc-400">
                Total: <strong className="text-indigo-400">{changes.length}</strong> campo{changes.length !== 1 ? "s" : ""} modificado{changes.length !== 1 ? "s" : ""}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            disabled={loading}
            data-testid="cancel-changes-btn"
          >
            Cancelar y Seguir Editando
          </Button>
          {changes.length > 0 && (
            <Button
              onClick={onConfirm}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="confirm-changes-btn"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Sí, Confirmar y Guardar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmChangesModal;
