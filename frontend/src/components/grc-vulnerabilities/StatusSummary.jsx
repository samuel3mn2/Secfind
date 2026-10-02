import { Check, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS_COLORS, STATUS_ORDER, slug } from './constants';

export const StatusSummary = ({ items = [], selected, onToggle, onClear, onDetails, loading }) => {
  const merged = new Map(items.map(item => [item.valor, item.total]));
  selected.forEach(value => { if (!merged.has(value)) merged.set(value, 0); });
  const rank = value => STATUS_ORDER.indexOf(value) < 0 ? STATUS_ORDER.length : STATUS_ORDER.indexOf(value);
  const options = [...merged].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'es'));
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6" aria-busy={loading} data-testid="panel-estatus">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white" data-testid="status-summary-title">Estatus de las vulnerabilidades</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onDetails} disabled={loading} data-testid="status-view-details" className="text-zinc-300"><Eye className="mr-2 h-4 w-4" />Ver detalle</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400" onClick={onClear} disabled={!selected.length} aria-label="Limpiar estatus" title="Limpiar estatus" data-testid="clear-status-filter"><RotateCcw className="h-4 w-4" /></Button>
        </div>
      </header>
      <div role="group" aria-label="Filtrar por estatus" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {options.map(([value, count]) => {
          const active = selected.includes(value);
          return <button key={value} type="button" aria-pressed={active} onClick={() => onToggle(value)} disabled={loading} data-testid={`status-option-${slug(value)}`}
            className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${active ? 'border-cyan-400 bg-cyan-400/10' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'}`}>
            <span className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-xs [overflow-wrap:anywhere]" style={{ color: STATUS_COLORS[value] || '#a1a1aa' }}>{value}</span>{active && <Check className="h-4 w-4 shrink-0 text-cyan-300" />}</span>
            <strong className="mt-2 block text-xl font-semibold tabular-nums text-white" data-testid={`status-count-${slug(value)}`}>{loading ? '—' : count}</strong>
          </button>;
        })}
      </div>
      {!options.length && <p className="py-3 text-sm text-zinc-400" role="status" data-testid="status-summary-empty">{loading ? 'Cargando estatus…' : 'No hay estatus para esta selección.'}</p>}
    </section>
  );
};