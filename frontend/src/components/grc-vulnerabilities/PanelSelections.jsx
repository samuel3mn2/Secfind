import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { label, slug } from './constants';

export const PanelSelections = ({ risks, severities, onRisk, onSeverity, onClear, prefix = 'panel-selection' }) => (
  <div className="flex flex-wrap items-center gap-2" data-testid={prefix}>
    {[['riesgo', risks, onRisk], ['severidad', severities, onSeverity]].map(([kind, items, toggle]) => items.map(value => (
      <button key={`${kind}-${value}`} type="button" onClick={() => toggle(value)} data-testid={`${prefix}-${kind}-${slug(value)}`}
        className="flex min-h-8 max-w-full items-center gap-2 rounded border border-cyan-600/40 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-500/20" aria-label={`Quitar ${kind} ${label(value)}`}>
        <span className="break-words">{kind === 'riesgo' ? 'Riesgo' : 'Severidad'}: {label(value)}</span><X className="h-3 w-3 shrink-0" />
      </button>
    )))}
    {Boolean(risks.length || severities.length) && <Button variant="ghost" size="sm" onClick={onClear} data-testid={`${prefix}-clear-all`} className="text-zinc-400">Limpiar selección</Button>}
  </div>
);