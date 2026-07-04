import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressSuggestion {
  address: string;      // display name
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  postcode?: string;
  state?: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  placeholder?: string;
  countryCodes?: string;   // e.g. "do,ht"
  className?: string;
  disabled?: boolean;
  id?: string;
}

// Very light shared cache to respect Nominatim usage policy
const cache = new Map<string, AddressSuggestion[]>();

async function searchNominatim(q: string, countryCodes: string): Promise<AddressSuggestion[]> {
  const key = `${countryCodes}|${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key)!;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  if (countryCodes) url.searchParams.set("countrycodes", countryCodes);

  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "fr" },
  });
  if (!res.ok) return [];
  const data = await res.json();

  const results: AddressSuggestion[] = (data || []).map((r: any) => ({
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    city:
      r.address?.city ||
      r.address?.town ||
      r.address?.village ||
      r.address?.municipality ||
      r.address?.county,
    country: r.address?.country,
    postcode: r.address?.postcode,
    state: r.address?.state,
  }));

  cache.set(key, results);
  return results;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Tapez une adresse…",
  countryCodes = "do,ht",
  className,
  disabled,
  id,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchNominatim(q, countryCodes);
        setSuggestions(results);
        setOpen(results.length > 0);
        setHighlight(-1);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, countryCodes]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = useCallback(
    (s: AddressSuggestion) => {
      onChange(s.address);
      onSelect(s);
      setOpen(false);
    },
    [onChange, onSelect]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (!open || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat}-${s.lng}-${i}`}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-accent",
                i === highlight && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-medium">{s.address.split(",")[0]}</p>
                <p className="truncate text-xs text-muted-foreground">{s.address}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-[10px] text-muted-foreground">
        Recherche via OpenStreetMap Nominatim
      </p>
    </div>
  );
}
