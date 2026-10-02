import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Monitor, Search, Loader2, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelPagination } from './PanelPagination';
import { PanelSelections } from './PanelSelections';
import { RISK_COLORS, appName } from './constants';

const SIZE = 8;
export const AffectedApplications = ({ data, loading, risks, severities, onRisk, onSeverity, onClear, onOpen }) => {
  const [search, setSearch] = useState('');
  const [requestedPage, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [data]);
  const items = useMemo(() => (data?.aplicaciones || []).filter(item => appName(item.aplicacion).toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [data, search]);
  const pages = Math.max(1, Math.ceil(items.length / SIZE));
  const page = Math.min(requestedPage, pages);
  const appCount = data?.aplicaciones.filter(item => item.aplicacion !== null).length || 0;
  return (
    <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6" data-testid="panel-aplicaciones-afectadas" aria-busy={loading}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white" data-testid="applications-heading">Aplicaciones afectadas</h2>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button" className="text-zinc-400" aria-label="Acerca del conteo por aplicación" data-testid="applications-count-info"><Info className="h-4 w-4" /></button></TooltipTrigger><TooltipContent data-testid="applications-count-tooltip" className="max-w-64 border-zinc-700 bg-zinc-800 text-white">Cada vulnerabilidad cuenta una vez por aplicación asociada. El total de vulnerabilidades no contiene duplicados.</TooltipContent></Tooltip></TooltipProvider>
          </div>
          <p className="mt-1 text-sm text-zinc-400" data-testid="applications-summary" aria-live="polite">{loading ? 'Actualizando resultados…' : `${appCount} aplicaciones · ${data?.total || 0} vulnerabilidades`}</p>
        </div>
        <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => onOpen({ tipo: 'todos' })} disabled={loading || !data?.total} data-testid="applications-view-all"><Eye className="mr-2 h-4 w-4" />Ver todas</Button>
      </header>
      <PanelSelections risks={risks} severities={severities} onRisk={onRisk} onSeverity={onSeverity} onClear={onClear} />
      <div className="relative my-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-500" />
        <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} aria-label="Buscar aplicación" placeholder="Buscar aplicación…" data-testid="search-aplicaciones-input" className="border-zinc-700 bg-zinc-900 pl-9 text-white" />
      </div>
      <div className="min-h-28" data-testid="applications-list">
        {loading ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400" data-testid="applications-loading"><Loader2 className="h-5 w-5 animate-spin" />Cargando aplicaciones…</div> : items.length ? items.slice((page - 1) * SIZE, page * SIZE).map((item, index) => (
          <button type="button" key={item.aplicacion ?? '__unassigned__'} onClick={() => onOpen({ tipo: 'aplicacion', aplicacion: item.aplicacion })}
            data-testid={`application-row-${(page - 1) * SIZE + index}`} data-application={item.aplicacion ?? ''}
            className="grid w-full grid-cols-[20px_minmax(0,1fr)_auto_16px] items-center gap-3 border-b border-zinc-800 px-1 py-4 text-left transition-colors hover:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 sm:gap-4">
            <Monitor className="h-5 w-5 text-zinc-500" />
            <div className="min-w-0"><span className="block break-words text-sm font-medium text-zinc-200 [overflow-wrap:anywhere]" data-testid={`application-name-${(page - 1) * SIZE + index}`}>{appName(item.aplicacion)}</span>
              <span className="mt-2 flex h-1.5 w-full max-w-80 overflow-hidden rounded-sm bg-zinc-800" aria-hidden="true">{Object.entries(item.niveles).filter(([, count]) => count > 0).map(([risk, count]) => <span key={risk} style={{ width: `${count / item.total * 100}%`, backgroundColor: RISK_COLORS[risk] }} />)}</span>
            </div>
            <span className="text-base font-semibold tabular-nums text-white" data-testid={`application-count-${(page - 1) * SIZE + index}`}>{item.total}</span><ChevronRight className="h-4 w-4 text-zinc-400" />
          </button>
        )) : <p className="py-10 text-center text-sm text-zinc-400" data-testid="applications-empty">{search ? 'No hay aplicaciones que coincidan con la búsqueda.' : 'No hay vulnerabilidades para esta selección.'}</p>}
      </div>
      <div className="mt-4"><PanelPagination prefix="apps" page={page} pages={pages} total={loading ? 0 : items.length} size={SIZE} onChange={setPage} disabled={loading} /></div>
    </section>
  );
};