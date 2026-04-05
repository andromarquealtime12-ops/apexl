import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_CITIES } from "@/utils/cities";

interface CitySelectProps {
  country: "DO" | "HT" | string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function CitySelect({ country, value, onValueChange, placeholder = "Sélectionnez une ville" }: CitySelectProps) {
  const cities = country === "HT" ? ALL_CITIES.HT : ALL_CITIES.DO;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {cities.map(city => (
          <SelectItem key={city} value={city}>{city}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
