import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, AlertTriangle, FileText } from "lucide-react";

/**
 * Modal reutilizable para eliminar elementos con justificación obligatoria.
 * 
 * @param {boolean} open - Controla si el modal está abierto
 * @param {function} onOpenChange - Callback cuando cambia el estado del modal
 * @param {string} itemName - Nombre del elemento a eliminar (para mostrar al usuario)
 * @param {string} itemType - Tipo de elemento (ej: "vulnerabilidad", "hallazgo")
 * @param {function} onConfirm - Callback que recibe la justificación cuando se confirma
 * @param {boolean} loading - Estado de carga durante la eliminación
 */
export function DeleteWithJustificationModal({
  open,
  onOpenChange,
  itemName,
  itemType = "elemento",
  onConfirm,
  loading = false,
}) {
  const [justificacion, setJustificacion] = useState("");
  const [error, setError] = useState("");

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setJustificacion("");
      setError("");
    }
  }, [open]);

  const MIN_CHARS = 10;
  const isValid = justificacion.trim().length >= MIN_CHARS;

  const handleConfirm = () => {
    if (!isValid) {
      setError(`La justificación debe tener al menos ${MIN_CHARS} caracteres`);
      return;
    }
    setError("");
    onConfirm(justificacion.trim());
  };

  const handleJustificacionChange = (e) => {
    const value = e.target.value;
    setJustificacion(value);
    if (value.trim().length >= MIN_CHARS) {
      setError("");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#18181b] border-[#27272a] text-white max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Confirmar Eliminación
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-zinc-400 space-y-3">
              <span className="block">
                Estás a punto de eliminar {itemType}:
              </span>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <span className="text-red-300 font-medium break-words">
                  {itemName || "Sin nombre"}
                </span>
              </div>
              <span className="text-amber-400 text-sm flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Esta acción requiere una justificación obligatoria.
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="justificacion" className="text-zinc-300">
            Nota / Justificación del Borrado <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="justificacion"
            value={justificacion}
            onChange={handleJustificacionChange}
            placeholder="Ingrese la razón por la cual está eliminando este elemento (mínimo 10 caracteres)..."
            className="bg-zinc-900 border-zinc-700 text-white min-h-[100px] placeholder:text-zinc-500"
            data-testid="delete-justificacion-input"
            disabled={loading}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={`${justificacion.trim().length >= MIN_CHARS ? "text-green-400" : "text-zinc-500"}`}>
              {justificacion.trim().length} / {MIN_CHARS} caracteres mínimos
            </span>
            {error && <span className="text-red-400">{error}</span>}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            data-testid="cancel-delete-btn"
            disabled={loading}
          >
            Cancelar
          </AlertDialogCancel>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="confirm-delete-btn"
          >
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteWithJustificationModal;
