import { useMemo, useState } from 'react';
import { Monitor, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { appName, appKey } from './constants';

export const ApplicationSelector = ({ options, selected, onToggle, onClear, loading }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const all = new Map((options || []).map(item => [item.aplicacion, item.total]));
    selected.forEach(value => { if (!all.has(value)) all.set(value, 0); });
    return [...all].filter(([value]) => appName(value).toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))
      .sort(([a], [b]) => appName(a).localeCompare(appName(b), 'es'));
  }, [options, selected, search]);
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="application-selector">
      <span className="text-sm font-medium text-zinc-300" id="application-filter-label">Aplicaciones</span>
      <Popover open={open} onOpenChange={value => { setOpen(value); if (!value) setSearch(''); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-labelledby="application-filter-label application-filter-value" data-testid="application-filter-trigger" className="min-w-0 max-w-full justify-between gap-2 border-zinc-700 bg-zinc-900 text-white">
            <Monitor className="h-4 w-4 shrink-0 text-zinc-400" /><span id="application-filter-value" className="min-w-0 truncate">{selected.length ? `${selected.length} seleccionadas` : 'Todas las aplicaciones'}</span><ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" data-testid="application-filter-popover" className="w-80 max-w-[calc(100vw-2rem)] border-zinc-700 bg-zinc-900 p-0 text-white">
          <div className="border-b border-zinc-800 p-3"><Input autoFocus value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar aplicaciones para seleccionar" placeholder="Buscar aplicaciones…" data-testid="application-filter-search" className="border-zinc-700 bg-zinc-950 text-white" /></div>
          <div className="max-h-64 overflow-y-auto p-2" role="group" aria-label="Seleccionar aplicaciones" data-testid="application-filter-options" aria-busy={loading}>
            {items.map(([value, count]) => <label key={appKey(value)} className="flex min-w-0 cursor-pointer items-center gap-3 rounded p-2 transition-colors hover:bg-zinc-800">
              <Checkbox checked={selected.includes(value)} onCheckedChange={() => onToggle(value)} data-testid={`application-filter-option-${appKey(value)}`} aria-label={appName(value)} className="shrink-0 border-zinc-500" />
              <span className="min-w-0 flex-1 break-words text-sm [overflow-wrap:anywhere]">{appName(value)}</span><span data-testid={`application-filter-count-${appKey(value)}`} className="shrink-0 text-xs tabular-nums text-zinc-400">{loading ? '—' : count}</span>
            </label>)}
            {!items.length && <p className="p-4 text-center text-sm text-zinc-400" data-testid="application-filter-empty">{loading ? 'Cargando aplicaciones…' : 'No se encontraron aplicaciones.'}</p>}
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 p-2">
            <Button variant="ghost" size="sm" disabled={!selected.length} onClick={onClear} data-testid="application-filter-clear" className="text-zinc-400">Limpiar</Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid="application-filter-done" className="border-zinc-700">Listo</Button>
          </footer>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={onClear} data-testid="application-filter-reset" title="Mostrar todas las aplicaciones" aria-label="Mostrar todas las aplicaciones"><X className="h-4 w-4" /></Button>}
    </div>
  );
};