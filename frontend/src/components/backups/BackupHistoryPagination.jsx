import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const BackupHistoryPagination = ({ data, query, disabled, changePage, changeFilter }) => {
  const page = data?.pagina || 1;
  const pages = data?.total_paginas || 1;
  const controls = [
    ['first', 'Primera página', ChevronsLeft, 1, page <= 1],
    ['previous', 'Página anterior', ChevronLeft, page - 1, page <= 1],
    ['next', 'Página siguiente', ChevronRight, page + 1, page >= pages],
    ['last', 'Última página', ChevronsRight, pages, page >= pages],
  ];
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-800 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid="backup-history-pagination">
      <div className="flex items-center gap-3">
        <Label htmlFor="backup-page-size" className="text-sm text-zinc-400">Por página</Label>
        <Select value={String(query.limite)} onValueChange={value => changeFilter('limite', Number(value))}>
          <SelectTrigger id="backup-page-size" data-testid="backup-history-page-size" className="w-20 border-zinc-700 bg-zinc-900 text-white"><SelectValue /></SelectTrigger>
          <SelectContent data-testid="backup-history-page-size-options" className="bg-zinc-900 border-zinc-700 text-white">
            {[10, 25, 50].map(size => <SelectItem key={size} value={String(size)} data-testid={`backup-history-page-size-${size}`}>{size}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <nav aria-label="Páginas del historial de backups" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-zinc-400" data-testid="backup-history-page-indicator">{disabled ? 'Página —' : `Página ${page} de ${pages}`}</span>
        {controls.map(([key, label, Icon, target, atLimit]) => (
          <Button key={key} variant="outline" size="icon" className="h-8 w-8 border-zinc-700" title={label} aria-label={label}
            data-testid={`backup-history-${key}-page`} disabled={disabled || atLimit} onClick={() => changePage(target)}>
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </nav>
    </div>
  );
};