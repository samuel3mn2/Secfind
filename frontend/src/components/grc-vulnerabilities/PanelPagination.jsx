import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PanelPagination = ({ prefix, page, pages, total, size, onChange, disabled = false }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs text-zinc-400" data-testid={`${prefix}-pagination`}>
    <span data-testid={`${prefix}-range`}>{total ? (page - 1) * size + 1 : 0}–{Math.min(page * size, total)} de {total}</span>
    <nav className="flex items-center gap-2" aria-label="Páginas de resultados">
      <Button variant="outline" size="icon" className="h-9 w-9 border-zinc-700" aria-label="Página anterior" title="Página anterior" data-testid={`${prefix}-prev`} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="tabular-nums" data-testid={`${prefix}-page`}>{page} / {pages}</span>
      <Button variant="outline" size="icon" className="h-9 w-9 border-zinc-700" aria-label="Página siguiente" title="Página siguiente" data-testid={`${prefix}-next`} disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </nav>
  </div>
);