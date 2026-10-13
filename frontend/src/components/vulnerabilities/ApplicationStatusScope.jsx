import { StatusBadge } from '@/components/grc-vulnerabilities/StatusBadge';

export const ApplicationStatusScope = ({ matches, globalStatus, prefix }) => (
  <div className="min-w-0 space-y-2" data-testid={`${prefix}-application-statuses`}>
    {matches.map((item, index) => (
      <div key={item.aplicacion} className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={`${prefix}-match-${index}`}>
        <span className="break-words text-xs font-medium text-zinc-200 [overflow-wrap:anywhere]" data-testid={`${prefix}-application-${index}`}>{item.aplicacion}:</span>
        <StatusBadge status={item.estatus} testId={`${prefix}-status-${index}`} />
      </div>
    ))}
    <p className="break-words text-xs text-zinc-500" data-testid={`${prefix}-global-status`}>Global: {globalStatus || 'Sin estado'}</p>
  </div>
);