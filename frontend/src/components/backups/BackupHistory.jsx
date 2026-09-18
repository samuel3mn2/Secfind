import { Calendar, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackupHistory } from "./useBackupHistory";
import { BackupHistoryFilters } from "./BackupHistoryFilters";
import { BackupHistoryPagination } from "./BackupHistoryPagination";
import { BackupHistoryTable } from "./BackupHistoryTable";

export const BackupHistory = ({ refreshKey, onDownload, onDelete }) => {
  const history = useBackupHistory(refreshKey);
  const { data, loading, error, invalidDates, hasFilters, refresh } = history;
  const unavailable = loading || Boolean(error) || invalidDates;
  const start = data?.total ? (data.pagina - 1) * data.limite + 1 : 0;
  const end = data ? Math.min(data.pagina * data.limite, data.total) : 0;
  return (
    <section className="min-w-0 space-y-5 border-t border-zinc-800 pt-6" aria-labelledby="backup-history-heading" data-testid="backup-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="backup-history-heading" data-testid="backup-history-title" className="flex items-center gap-2 text-base font-semibold text-white md:text-lg"><Calendar className="w-5 h-5 shrink-0" />Historial de Backups</h2>
        <Button variant="outline" size="sm" disabled={loading || invalidDates} onClick={refresh} className="border-zinc-700" data-testid="backup-history-refresh">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualizar
        </Button>
      </div>
      <BackupHistoryFilters {...history} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-400" aria-live="polite">
        <span data-testid="backup-history-results">{unavailable ? 'Resultados: —' : `${start}–${end} de ${data?.total || 0} backups${hasFilters ? ' · filtrados' : ''}`}</span>
        <span data-testid="backup-history-sort">Más recientes primero</span>
      </div>
      <div aria-busy={loading} className="min-h-32">
        {loading ? (
          <div role="status" data-testid="backup-history-loading" className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400"><Loader2 className="w-5 h-5 animate-spin" />Cargando historial…</div>
        ) : error ? (
          <div role="alert" data-testid="backup-history-error" className="flex flex-wrap items-center gap-3 py-8 text-sm text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" /><span>{error}</span><Button variant="outline" size="sm" onClick={refresh} data-testid="backup-history-retry">Reintentar</Button>
          </div>
        ) : invalidDates ? null : data?.items.length ? (
          <BackupHistoryTable items={data.items} onDownload={onDownload} onDelete={onDelete} />
        ) : (
          <p data-testid="backup-history-empty" className="py-12 text-center text-sm text-zinc-400">{hasFilters ? 'No hay backups que coincidan con los filtros.' : 'No hay backups registrados.'}</p>
        )}
      </div>
      <BackupHistoryPagination {...history} disabled={unavailable} />
    </section>
  );
};