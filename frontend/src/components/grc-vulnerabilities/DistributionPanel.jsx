import { Check, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { label, slug } from './constants';

export const DistributionPanel = ({ title, prefix, items, colors, selected, onToggle, onClear, onDetails, loading }) => {
  const visible = (items || []).filter(item => item.valor !== 'Sin clasificar' || item.total > 0 || selected.includes(item.valor));
  const max = Math.max(1, ...visible.map(item => item.total));
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6" data-testid={`panel-${prefix}`} aria-busy={loading}>
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-white" data-testid={`${prefix}-heading`}>{title}</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-zinc-400" disabled={!selected.length} onClick={onClear} title="Limpiar selección" aria-label={`Limpiar ${prefix}`} data-testid={`clear-${prefix}-filter`}><RotateCcw className="h-4 w-4" /></Button>
      </header>
      <div className="my-5 flex min-h-[260px] flex-1 flex-col justify-around gap-2" role="group" aria-label={title}>
        {visible.map(item => {
          const active = selected.includes(item.valor);
          return (
            <button key={item.valor} type="button" aria-pressed={active} aria-label={`${label(item.valor)}: ${item.total} vulnerabilidades`}
              data-testid={`${prefix}-bar-${slug(item.valor)}`} disabled={loading} onClick={() => onToggle(item.valor)}
              className={`grid min-h-12 grid-cols-[76px_minmax(0,1fr)_40px_16px] items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 sm:grid-cols-[88px_minmax(0,1fr)_48px_16px] ${active ? 'border-cyan-400 bg-cyan-400/10' : 'border-transparent hover:border-zinc-600 hover:bg-zinc-800/50'}`}>
              <span className="break-words text-zinc-300">{label(item.valor)}</span>
              <span className="h-9 min-w-0 overflow-hidden rounded-sm bg-zinc-800/60" aria-hidden="true"><span className="block h-full rounded-r-sm transition-[width,opacity] duration-200" style={{ width: `${item.total ? Math.max(2, item.total / max * 100) : 0}%`, backgroundColor: colors[item.valor], opacity: selected.length && !active ? 0.45 : 1 }} /></span>
              <span className="text-right text-sm font-semibold tabular-nums text-white" data-testid={`${prefix}-count-${slug(item.valor)}`}>{loading ? '—' : item.total}</span>
              {active && <Check className="h-4 w-4 text-cyan-300" />}
            </button>
          );
        })}
        {loading && !visible.length && <p role="status" className="text-sm text-zinc-400" data-testid={`${prefix}-loading`}>Cargando distribución…</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-3">
        <span className="text-xs text-zinc-400" data-testid={`${prefix}-selection-count`}>{selected.length ? `${selected.length} seleccionados` : 'Todos los niveles'}</span>
        <Button variant="ghost" size="sm" className="text-zinc-300" disabled={loading} onClick={onDetails} data-testid={`${prefix}-view-details`}><Eye className="mr-2 h-4 w-4" />Ver detalle</Button>
      </div>
    </section>
  );
};