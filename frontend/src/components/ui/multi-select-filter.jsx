import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export function MultiSelectFilter({
  options = [],
  selected = [],
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  allLabel = "Todas",
  className,
  disabled = false,
  maxDisplay = 2,
  "data-testid": testId
}) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Clear search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchValue("");
    }
  }, [open]);

  // Filter options based on search - use useMemo for better performance
  const filteredOptions = React.useMemo(() => {
    if (!searchValue.trim()) return options;
    const searchLower = searchValue.toLowerCase().trim();
    return options.filter(option => 
      option.toLowerCase().includes(searchLower)
    );
  }, [options, searchValue]);

  // Handle select/deselect
  const handleToggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // Handle select all / clear all
  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  // Get display text
  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    if (selected.length <= maxDisplay) return selected.join(", ");
    return `${selected.length} seleccionados`;
  };

  const isAllSelected = selected.length === options.length && options.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "justify-between bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white min-w-[140px]",
            selected.length === 0 && "text-zinc-400",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate text-sm">
            {getDisplayText()}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {selected.length > 0 && (
              <Badge 
                variant="secondary" 
                className="h-5 px-1.5 bg-indigo-600 text-white text-xs"
                onClick={handleClear}
              >
                {selected.length}
                <X className="w-3 h-3 ml-1 cursor-pointer" />
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 bg-zinc-900 border-zinc-700" align="start">
        {/* Search Input */}
        <div className="flex items-center border-b border-zinc-700 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
          <input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="flex h-10 w-full bg-transparent py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
            autoFocus
          />
          {searchValue && (
            <X 
              className="h-4 w-4 text-zinc-500 cursor-pointer hover:text-white" 
              onClick={() => setSearchValue("")}
            />
          )}
        </div>

        {/* Select All Option - only show when not searching */}
        {!searchValue && (
          <div 
            className="flex items-center gap-2 p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={isAllSelected}
              className="border-zinc-600"
            />
            <span className={cn(
              "text-sm font-medium",
              isAllSelected ? "text-indigo-400" : "text-zinc-300"
            )}>
              {allLabel}
            </span>
            {isAllSelected && (
              <span className="text-xs text-zinc-500 ml-auto">
                (Limpiar)
              </span>
            )}
          </div>
        )}

        {/* Options List */}
        <ScrollArea className="h-[250px]" key={searchValue}>
          <div className="p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <div
                    key={option}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                      isSelected ? "bg-indigo-950/50" : "hover:bg-zinc-800"
                    )}
                    onClick={() => handleToggle(option)}
                    title={option}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="border-zinc-600 shrink-0"
                    />
                    <span className={cn(
                      "text-sm break-words whitespace-normal flex-1",
                      isSelected ? "text-white" : "text-zinc-300"
                    )}>
                      {option}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {selected.length > 0 && (
          <div className="flex items-center justify-between p-2 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">
              {selected.length} de {options.length} seleccionados
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
              onClick={() => { onChange([]); setOpen(false); }}
            >
              Limpiar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
