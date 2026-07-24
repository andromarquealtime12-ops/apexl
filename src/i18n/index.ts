import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import ht from "./locales/ht.json";
import es from "./locales/es.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "fr", label: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "es", label: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "pt", label: "Português", flag: "🇧🇷", dir: "ltr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "it", label: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "ht", label: "Kreyòl", flag: "🇭🇹", dir: "ltr" },
  { code: "zh", label: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      ht: { translation: ht },
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
      de: { translation: de },
      it: { translation: it },
      zh: { translation: zh },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "apex_lang",
    },
  });

// Apply document lang + dir when the language changes (RTL support for Arabic).
const applyDocumentDir = (lng: string) => {
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === lng.split("-")[0]);
  if (typeof document !== "undefined") {
    document.documentElement.lang = meta?.code ?? "en";
    document.documentElement.dir = meta?.dir ?? "ltr";
  }
};
applyDocumentDir(i18n.language || "en");
i18n.on("languageChanged", applyDocumentDir);

export default i18n;
