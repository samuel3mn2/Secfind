import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { label, slug, appName, appKey } from './constants';

export const PanelSelections = ({ risks, severities, applications = [], statuses = [], onRisk, onSeverity, onApplication, onStatus, onClear, prefix = 'panel-selection' }) => (
  <div className="flex flex-wrap items-center gap-2" data-testid={prefix}>
    {[
      ['riesgo', 'Riesgo', risks, onRisk], ['severidad', 'Severidad', severities, onSeverity],
      ['aplicacion', 'Aplicación', applications, onApplication], ['estatus', 'Estatus', statuses, onStatus],
    ].map(([kind, title, items, toggle]) => items.map(value => (
      <button key={`${kind}-${kind === 'aplicacion' ? appKey(value) : value}`} type="button" onClick={() => toggle(value)} data-testid={`${prefix}-${kind}-${kind === 'aplicacion' ? appKey(value) : slug(value)}`}
        className="flex min-h-8 max-w-full items-center gap-2 rounded border border-cyan-600/40 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-500/20" aria-label={`Quitar ${title} ${kind === 'aplicacion' ? appName(value) : label(value)}`}>
        <span className="min-w-0 break-words [overflow-wrap:anywhere]">{title}: {kind === 'aplicacion' ? appName(value) : label(value)}</span><X className="h-3 w-3 shrink-0" />
      </button>
    )))}
    {Boolean(risks.length || severities.length || applications.length || statuses.length) && <Button variant="ghost" size="sm" onClick={onClear} data-testid={`${prefix}-clear-all`} className="text-zinc-400">Limpiar selección</Button>}
  </div>
);