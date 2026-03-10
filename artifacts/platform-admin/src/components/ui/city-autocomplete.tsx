import * as React from "react";
import { Check, ChevronsUpDown, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
}

function extractCityName(r: NominatimResult): string {
  return (
    r.address?.city ||
    r.address?.town ||
    r.address?.village ||
    r.address?.municipality ||
    r.display_name.split(",")[0].trim()
  );
}

function extractCountry(r: NominatimResult): string {
  if (r.address?.country) return r.address.country;
  const parts = r.display_name.split(",");
  return parts[parts.length - 1].trim();
}

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "Начните вводить город...",
  className,
  disabled,
}: CityAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value);
  const [results, setResults] = React.useState<NominatimResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  const search = React.useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "json");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("accept-language", "ru,en");
        url.searchParams.set("limit", "10");
        const res = await fetch(url.toString(), {
          signal: abortRef.current.signal,
          headers: { "User-Agent": "RentrailPlatformAdmin/1.0" },
        });
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between rounded-xl border border-input bg-card px-4 font-normal shadow-sm text-sm hover:bg-card",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="relative">
            <CommandInput
              placeholder="Поиск города..."
              value={query}
              onValueChange={(q) => {
                setQuery(q);
                search(q);
              }}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <CommandList>
            {!loading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>Город не найден</CommandEmpty>
            )}
            {!loading && query.length < 2 && (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Введите минимум 2 символа
              </div>
            )}
            {results.map((r) => {
              const city = extractCityName(r);
              const country = extractCountry(r);
              return (
                <CommandItem
                  key={r.place_id}
                  value={String(r.place_id)}
                  onSelect={() => {
                    onChange(city);
                    setQuery(city);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === city ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{city}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {country}
                    </span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
