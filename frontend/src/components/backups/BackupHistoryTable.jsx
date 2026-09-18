import { CheckCircle2, XCircle, Loader2, Download, Trash2, HardDrive, Cloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const GRID = "grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.7fr)_minmax(0,.7fr)_5rem]";
const STATES = {
  exitoso: ['Exitoso', CheckCircle2, 'bg-green-500/20 text-green-400 border-green-500/30'],
  fallido: ['Fallido', XCircle, 'bg-red-500/20 text-red-400 border-red-500/30'],
  en_progreso: ['En progreso', Loader2, 'bg-blue-500/20 text-blue-400 border-blue-500/30'],
};
const DESTINATIONS = { local: "Local", google_drive: "Google Drive", ambos: "Local + Google Drive" };
const formatDate = value => new Date(value).toLocaleString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const Cell = ({ label, id, children, className = '' }) => (
  <div role="cell" className={`min-w-0 break-words ${className}`} data-testid={id}>
    <span className="mb-1 block text-xs text-zinc-500 lg:hidden">{label}</span>{children}
  </div>
);

export const BackupHistoryTable = ({ items, onDownload, onDelete }) => (
  <div role="table" aria-label="Historial de backups" data-testid="backup-history-table" className="text-sm text-zinc-300">
    <div role="row" className={`${GRID} hidden border-b border-zinc-700 py-3 text-xs text-zinc-400 lg:grid`}>
      {['Fecha', 'Estado', 'Destino', 'Tamaño', 'Duración', 'Acciones'].map(label => <div role="columnheader" key={label}>{label}</div>)}
    </div>
    {items.map(backup => {
      const [status, Icon, color] = STATES[backup.estado] || [backup.estado, XCircle, 'text-zinc-400'];
      return (
        <div role="row" key={backup.id} data-testid={`backup-history-row-${backup.id}`} className={`${GRID} items-center border-b border-zinc-800 py-4 transition-colors hover:bg-zinc-800/30`}>
          <Cell label="Fecha" id={`backup-history-date-${backup.id}`} className="tabular-nums">{formatDate(backup.fecha)}</Cell>
          <Cell label="Estado" id={`backup-history-state-${backup.id}`}>
            <Badge className={`${color} whitespace-nowrap`}><Icon className={`w-3 h-3 mr-1 shrink-0 ${backup.estado === 'en_progreso' ? 'animate-spin' : ''}`} />{status}</Badge>
          </Cell>
          <Cell label="Destino" id={`backup-history-destination-${backup.id}`}>
            <div className="flex items-center gap-2">
              {backup.destino !== 'google_drive' ? <HardDrive className="h-4 w-4 shrink-0 text-zinc-500" /> : <Cloud className="h-4 w-4 shrink-0 text-blue-400" />}
              <span>{DESTINATIONS[backup.destino] || backup.destino}</span>
            </div>
          </Cell>
          <Cell label="Tamaño" id={`backup-history-size-${backup.id}`}>{backup.tamaño_humano || '—'}</Cell>
          <Cell label="Duración" id={`backup-history-duration-${backup.id}`}>{backup.duracion_segundos != null ? `${backup.duracion_segundos.toFixed(1)} s` : '—'}</Cell>
          <Cell label="Acciones" id={`backup-history-actions-${backup.id}`}>
            <div className="flex items-center gap-1 lg:justify-end">
              {backup.ruta_local && backup.estado === 'exitoso' && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-cyan-400" title="Descargar backup" aria-label="Descargar backup"
                  data-testid={`backup-history-download-${backup.id}`} onClick={() => onDownload(backup.id)}><Download className="h-4 w-4" /></Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-red-400" title="Eliminar backup" aria-label="Eliminar backup"
                data-testid={`backup-history-delete-${backup.id}`} onClick={() => onDelete(backup.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Cell>
        </div>
      );
    })}
  </div>
);