import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";

interface NominatimResult {
  place_id: number;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function extractStreet(r: NominatimResult): string {
  const parts: string[] = [];
  if (r.address?.road) parts.push(r.address.road);
  if (r.address?.house_number) parts.push(r.address.house_number);
  return parts.length > 0
    ? parts.join(", ")
    : r.display_name.split(",")[0].trim();
}

function extractSubtitle(r: NominatimResult): string {
  const city = r.address?.city || r.address?.town || r.address?.village || "";
  const country = r.address?.country || "";
  return [city, country].filter(Boolean).join(", ");
}

interface AddressAutocompleteProps extends Omit<
  React.ComponentProps<"input">,
  "onChange"
> {
  value: string;
  onChange: (address: string) => void;
  city?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  city,
  placeholder = "Начните вводить улицу...",
  className,
  disabled,
  ...props
}: AddressAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<NominatimResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const search = React.useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q || q.trim().length < 3) {
        setResults([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        try {
          const url = new URL("https://nominatim.openstreetmap.org/search");
          const queryStr = city ? `${q}, ${city}` : q;
          url.searchParams.set("q", queryStr);
          url.searchParams.set("format", "json");
          url.searchParams.set("addressdetails", "1");
          url.searchParams.set("accept-language", "ru,en");
          url.searchParams.set("limit", "7");
          const res = await fetch(url.toString(), {
            signal: abortRef.current.signal,
            headers: { "User-Agent": "RentrailPlatformAdmin/1.0" },
          });
          const data = (await res.json()) as NominatimResult[];
          setResults(data.filter((r) => r.address?.road));
          setOpen(true);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 500);
    },
    [city],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    search(e.target.value);
  }

  function handleSelect(r: NominatimResult) {
    const street = extractStreet(r);
    onChange(street);
    setOpen(false);
    setResults([]);
  }

  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <input
            {...props}
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "flex h-10 w-full rounded-xl border border-input bg-card px-4 py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              loading && "pr-10",
              className,
            )}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-56 overflow-y-auto py-1">
          {results.map((r) => {
            const street = extractStreet(r);
            const subtitle = extractSubtitle(r);
            return (
              <button
                key={r.place_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(r);
                }}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium">{street}</span>
                  {subtitle && (
                    <span className="truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
