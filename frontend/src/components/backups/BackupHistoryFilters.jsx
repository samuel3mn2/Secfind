import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = {
  estado: [["todos", "Todos los estados"], ["exitoso", "Exitoso"], ["fallido", "Fallido"], ["en_progreso", "En progreso"]],
  destino: [["todos", "Todos los destinos"], ["local", "Local"], ["google_drive", "Google Drive"], ["ambos", "Local + Google Drive"]],
};

export const BackupHistoryFilters = ({ query, changeFilter, clearFilters, hasFilters, invalidDates }) => (
  <div className="space-y-3" data-testid="backup-history-filters">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1fr_auto] xl:items-end">
      {[['estado', 'Estado'], ['destino', 'Destino']].map(([field, label]) => (
        <div className="min-w-0 space-y-2" key={field}>
          <Label htmlFor={`backup-filter-${field}`} className="text-zinc-400">{label}</Label>
          <Select value={query[field]} onValueChange={value => changeFilter(field, value)}>
            <SelectTrigger id={`backup-filter-${field}`} data-testid={`backup-filter-${field}`} className="bg-zinc-900 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
            <SelectContent data-testid={`backup-filter-${field}-options`} className="bg-zinc-900 border-zinc-700 text-white">
              {OPTIONS[field].map(([value, text]) => <SelectItem key={value} value={value} data-testid={`backup-filter-${field}-${value}`}>{text}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
      {[['desde', 'Desde'], ['hasta', 'Hasta']].map(([field, label]) => (
        <div className="min-w-0 space-y-2" key={field}>
          <Label htmlFor={`backup-filter-${field}`} className="text-zinc-400">{label}</Label>
          <Input id={`backup-filter-${field}`} data-testid={`backup-filter-${field}`} type="date" value={query[field]}
            onChange={event => changeFilter(field, event.target.value)} aria-invalid={invalidDates}
            aria-describedby={invalidDates ? "backup-date-error" : undefined}
            className="min-w-0 w-full bg-zinc-900 border-zinc-700 text-white" />
        </div>
      ))}
      <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters} data-testid="backup-history-clear-filters" className="justify-self-start text-zinc-400 hover:text-white">
        <RotateCcw className="w-4 h-4 mr-2" />Limpiar
      </Button>
    </div>
    {invalidDates && <p id="backup-date-error" role="alert" data-testid="backup-history-date-error" className="text-sm text-red-400">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
  </div>
);