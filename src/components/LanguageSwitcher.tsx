import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { Globe, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const active = i18n.language?.split("-")[0] ?? "en";
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === active) ?? SUPPORTED_LANGUAGES[0];

  const changeLanguage = async (code: string) => {
    i18n.changeLanguage(code);
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        await supabase
          .from("profiles")
          .update({ language: code } as any)
          .eq("user_id", data.user.id);
      }
    } catch {
      /* language still applied locally */
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 rounded-none"
          aria-label={t("nav.language", "Language")}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-xs uppercase tracking-wider font-medium">
            {current.code}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-none">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-normal">
          {t("nav.language", "Language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((l) => {
          const selected = active === l.code;
          return (
            <DropdownMenuItem
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={`cursor-pointer flex items-center justify-between ${
                selected ? "bg-accent" : ""
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-base leading-none">{l.flag}</span>
                <span className="text-sm">{l.label}</span>
              </span>
              {selected && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
