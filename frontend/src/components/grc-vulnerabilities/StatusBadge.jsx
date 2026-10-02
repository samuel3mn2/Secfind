import { STATUS_COLORS } from './constants';

export const StatusBadge = ({ status, count, testId, prominent = false }) => {
  const value = status?.trim() || 'Sin estado';
  const color = STATUS_COLORS[value] || '#a1a1aa';
  return (
    <span data-testid={testId} className={`inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-1 ${prominent ? 'text-sm font-semibold' : 'text-xs'}`}
      style={{ color, backgroundColor: `${color}14`, borderColor: `${color}55` }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{value}</span>
      {count !== undefined && <strong className="tabular-nums text-zinc-100">{count}</strong>}
    </span>
  );
};