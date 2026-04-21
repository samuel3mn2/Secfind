import * as React from "react";
import { Check, ChevronsUpDown, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados",
  allowCreate = false,
  onCreateNew,
  className,
  disabled = false,
  "data-testid": testId
}) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  // Filter options based on search
  const filteredOptions = options.filter(option => {
    const label = typeof option === "object" ? option.label : option;
    return label.toLowerCase().includes(searchValue.toLowerCase());
  });

  // Get display value
  const displayValue = React.useMemo(() => {
    if (!value) return "";
    const found = options.find(opt => {
      const optValue = typeof opt === "object" ? opt.value : opt;
      return optValue === value;
    });
    return found ? (typeof found === "object" ? found.label : found) : value;
  }, [value, options]);

  const handleSelect = (selectedValue) => {
    onChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
    setSearchValue("");
  };

  const handleCreateNew = () => {
    if (onCreateNew && searchValue.trim()) {
      onCreateNew(searchValue.trim());
      setOpen(false);
      setSearchValue("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800 hover:text-white",
            !value && "text-zinc-500",
            className
          )}
          data-testid={testId}
        >
          <span className="truncate">
            {displayValue || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-zinc-900 border-zinc-700" align="start">
        <Command className="bg-zinc-900">
          <div className="flex items-center border-b border-zinc-700 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
            <input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm text-white placeholder:text-zinc-500 outline-none"
            />
          </div>
          <CommandList className="max-h-[200px] overflow-y-auto">
            {filteredOptions.length === 0 && !allowCreate && (
              <div className="py-6 text-center text-sm text-zinc-500">
                {emptyText}
              </div>
            )}
            {filteredOptions.length === 0 && allowCreate && searchValue.trim() && (
              <div className="p-2">
                <button
                  onClick={handleCreateNew}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-indigo-400 hover:bg-zinc-800"
                >
                  <Plus className="h-4 w-4" />
                  Crear "{searchValue.trim()}"
                </button>
              </div>
            )}
            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const optValue = typeof option === "object" ? option.value : option;
                  const optLabel = typeof option === "object" ? option.label : option;
                  const optSubtext = typeof option === "object" ? option.subtext : null;
                  
                  return (
                    <CommandItem
                      key={optValue}
                      value={optValue}
                      onSelect={() => handleSelect(optValue)}
                      className="text-white hover:bg-zinc-800 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === optValue ? "opacity-100 text-indigo-400" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{optLabel}</span>
                        {optSubtext && (
                          <span className="text-xs text-zinc-500">{optSubtext}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
