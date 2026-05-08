import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Empty row template
const createEmptyRow = () => ({
  id: Math.random().toString(36).substr(2, 9),
  codigo: "",
  fecha_hallazgo: "",
  institucion: "",
  aplicaciones: "",
  vulnerabilidad: "",
  severidad: "",
  estatus: "Pendiente",
  responsable: "",
  fecha_compromiso: "",
  nombre_informe_pentest: "",
  proveedor: "",
  recomendaciones: "",
  isValid: false,
});

export default function BulkEntryModal({ open, onClose, options, onSuccess }) {
  const [rows, setRows] = useState([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  const [importing, setImporting] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const pasteAreaRef = useRef(null);

  // Reset rows when modal opens
  useEffect(() => {
    if (open) {
      setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
    }
  }, [open]);

  const addRow = () => {
    setRows([...rows, createEmptyRow()]);
  };

  const removeRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  const updateRow = (id, field, value) => {
    setRows(rows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value };
        // Check if row has minimum required fields
        updated.isValid = !!(updated.vulnerabilidad && updated.severidad);
        return updated;
      }
      return row;
    }));
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    if (!pastedText.trim()) return;

    // Split by lines and tabs (Excel format)
    const lines = pastedText.trim().split('\n');
    const newRows = [];

    // Column order expected from Excel:
    // Código, Fecha Hallazgo, Institución, Aplicaciones, Vulnerabilidad, Severidad, Estatus, Responsable, Fecha Compromiso, Informe, Proveedor
    
    for (const line of lines) {
      const cells = line.split('\t');
      if (cells.length >= 1 && cells.some(c => c.trim())) {
        const row = createEmptyRow();
        
        // Map cells to fields (flexible mapping)
        if (cells[0]) row.codigo = cells[0].trim();
        if (cells[1]) row.fecha_hallazgo = cells[1].trim();
        if (cells[2]) row.institucion = cells[2].trim();
        if (cells[3]) row.aplicaciones = cells[3].trim();
        if (cells[4]) row.vulnerabilidad = cells[4].trim();
        if (cells[5]) row.severidad = normalizeSeveridad(cells[5].trim());
        if (cells[6]) row.estatus = normalizeEstatus(cells[6].trim());
        if (cells[7]) row.responsable = cells[7].trim();
        if (cells[8]) row.fecha_compromiso = cells[8].trim();
        if (cells[9]) row.nombre_informe_pentest = cells[9].trim();
        if (cells[10]) row.proveedor = cells[10].trim();
        if (cells[11]) row.recomendaciones = cells[11].trim();

        row.isValid = !!(row.vulnerabilidad && row.severidad);
        newRows.push(row);
      }
    }

    if (newRows.length > 0) {
      setRows(prev => {
        // Remove empty rows and add new ones
        const nonEmptyExisting = prev.filter(r => r.vulnerabilidad || r.codigo);
        return [...nonEmptyExisting, ...newRows];
      });
      toast.success(`${newRows.length} filas pegadas desde el portapapeles`);
      setPasteMode(false);
    }
  };

  const normalizeSeveridad = (value) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('crit')) return 'Critica';
    if (normalized.includes('alta') || normalized.includes('high')) return 'Alta';
    if (normalized.includes('media') || normalized.includes('medium')) return 'Media';
    if (normalized.includes('baja') || normalized.includes('low')) return 'Baja';
    return value;
  };

  const normalizeEstatus = (value) => {
    const normalized = value.toLowerCase();
    if (normalized.includes('pend')) return 'Pendiente';
    if (normalized.includes('cerr') || normalized.includes('corr')) return 'Cerrado';
    if (normalized.includes('proceso')) return 'En Proceso';
    if (normalized.includes('retest') || normalized.includes('re-test') || normalized.includes('re test')) return 'Para Re Test';
    return 'Pendiente';
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.isValid);
    
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar. Cada fila necesita al menos Vulnerabilidad y Severidad.");
      return;
    }

    setImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      try {
        // Prepare data
        const data = {
          codigo: row.codigo || null,
          fecha_hallazgo: row.fecha_hallazgo || null,
          institucion: row.institucion || null,
          aplicaciones: row.aplicaciones ? row.aplicaciones.split('|').map(a => a.trim()).filter(Boolean) : [],
          vulnerabilidad: row.vulnerabilidad,
          severidad: row.severidad,
          estatus: row.estatus || 'Pendiente',
          responsables: row.responsable ? row.responsable.split('|').map(r => r.trim()).filter(Boolean) : [],
          fecha_compromiso: row.fecha_compromiso || null,
          nombre_informe_pentest: row.nombre_informe_pentest || null,
          proveedor: row.proveedor || null,
          recomendaciones: row.recomendaciones || null,
        };

        await axios.post(`${API}/vulnerabilidades`, data);
        successCount++;
      } catch (error) {
        console.error("Error importing row:", error);
        errorCount++;
      }
    }

    setImporting(false);

    if (successCount > 0) {
      toast.success(`${successCount} vulnerabilidades importadas exitosamente`);
      if (errorCount > 0) {
        toast.warning(`${errorCount} filas tuvieron errores`);
      }
      onSuccess?.();
      onClose();
    } else {
      toast.error("No se pudo importar ninguna vulnerabilidad");
    }
  };

  const validRowsCount = rows.filter(r => r.isValid).length;

  const severidadOptions = ['Critica', 'Alta', 'Media', 'Baja'];
  const estatusOptions = ['Pendiente', 'En Proceso', 'Para Re Test', 'Cerrado'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-[95vw] w-[1400px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Plus className="w-5 h-5 text-indigo-400" />
            Entrada Masiva de Vulnerabilidades
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Agrega múltiples vulnerabilidades a la vez. Puedes escribir manualmente o pegar datos desde Excel.
          </DialogDescription>
        </DialogHeader>

        {/* Paste Mode Toggle */}
        <div className="flex items-center gap-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPasteMode(!pasteMode)}
            className={`border-zinc-700 ${pasteMode ? 'bg-indigo-600 text-white' : 'text-zinc-300'}`}
          >
            <Copy className="w-4 h-4 mr-2" />
            {pasteMode ? "Modo Pegar Activo" : "Pegar desde Excel"}
          </Button>
          
          {pasteMode && (
            <div className="flex-1 text-sm text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Haz clic en el área de abajo y presiona Ctrl+V para pegar datos de Excel
            </div>
          )}
        </div>

        {/* Paste Area (shown when paste mode is active) */}
        {pasteMode && (
          <div
            ref={pasteAreaRef}
            tabIndex={0}
            onPaste={handlePaste}
            className="border-2 border-dashed border-indigo-500 rounded-lg p-8 text-center cursor-pointer hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => pasteAreaRef.current?.focus()}
          >
            <Copy className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
            <p className="text-zinc-300">Haz clic aquí y presiona <kbd className="px-2 py-1 bg-zinc-800 rounded">Ctrl+V</kbd></p>
            <p className="text-xs text-zinc-500 mt-2">
              Formato esperado: Código | Fecha | Institución | Aplicaciones | Vulnerabilidad | Severidad | Estatus | Responsable | Fecha Compromiso | Informe | Proveedor
            </p>
          </div>
        )}

        {/* Data Table */}
        <ScrollArea className="h-[400px] border border-zinc-700 rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 bg-zinc-900 z-10">
              <TableRow className="border-zinc-700 hover:bg-transparent">
                <TableHead className="text-zinc-400 w-8">#</TableHead>
                <TableHead className="text-zinc-400 w-24">Código</TableHead>
                <TableHead className="text-zinc-400 w-28">Fecha</TableHead>
                <TableHead className="text-zinc-400 w-32">Institución</TableHead>
                <TableHead className="text-zinc-400 w-32">Aplicaciones</TableHead>
                <TableHead className="text-zinc-400 min-w-[200px]">Vulnerabilidad *</TableHead>
                <TableHead className="text-zinc-400 w-24">Severidad *</TableHead>
                <TableHead className="text-zinc-400 w-28">Estatus</TableHead>
                <TableHead className="text-zinc-400 w-32">Responsable</TableHead>
                <TableHead className="text-zinc-400 w-32">Informe</TableHead>
                <TableHead className="text-zinc-400 w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id} className="border-zinc-700 hover:bg-zinc-800/50">
                  <TableCell className="text-zinc-500 text-xs">
                    {row.isValid ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={row.codigo}
                      onChange={(e) => updateRow(row.id, 'codigo', e.target.value)}
                      className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                      placeholder="VULN-001"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="date"
                      value={row.fecha_hallazgo}
                      onChange={(e) => updateRow(row.id, 'fecha_hallazgo', e.target.value)}
                      className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={row.institucion}
                      onValueChange={(v) => updateRow(row.id, 'institucion', v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {options?.instituciones?.map((i) => (
                          <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={row.aplicaciones}
                      onChange={(e) => updateRow(row.id, 'aplicaciones', e.target.value)}
                      className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                      placeholder="App1 | App2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={row.vulnerabilidad}
                      onChange={(e) => updateRow(row.id, 'vulnerabilidad', e.target.value)}
                      className={`h-8 text-xs bg-zinc-800 border-zinc-700 text-white ${!row.vulnerabilidad && 'border-red-500/50'}`}
                      placeholder="Descripción de la vulnerabilidad"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={row.severidad}
                      onValueChange={(v) => updateRow(row.id, 'severidad', v)}
                    >
                      <SelectTrigger className={`h-8 text-xs bg-zinc-800 border-zinc-700 text-white ${!row.severidad && 'border-red-500/50'}`}>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {severidadOptions.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={row.estatus}
                      onValueChange={(v) => updateRow(row.id, 'estatus', v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {estatusOptions.map((e) => (
                          <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={row.responsable}
                      onChange={(e) => updateRow(row.id, 'responsable', e.target.value)}
                      className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white"
                      placeholder="Responsable"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={row.nombre_informe_pentest}
                      onValueChange={(v) => updateRow(row.id, 'nombre_informe_pentest', v)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-zinc-800 border-zinc-700 text-white">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 max-h-[200px]">
                        {options?.informes_pentest?.map((i) => (
                          <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(row.id)}
                      className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400"
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Add Row Button */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Fila
          </Button>
          
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="border-zinc-600 text-zinc-400">
              {rows.length} filas totales
            </Badge>
            <Badge className={validRowsCount > 0 ? "bg-green-600" : "bg-zinc-600"}>
              {validRowsCount} válidas
            </Badge>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-zinc-500 space-y-1">
          <p>* Campos obligatorios: Vulnerabilidad y Severidad</p>
          <p>• Para múltiples aplicaciones o responsables, sepáralos con " | " (ej: App1 | App2)</p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || validRowsCount === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {importing ? "Importando..." : `Importar ${validRowsCount} Vulnerabilidades`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
