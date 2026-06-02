import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import ht from "./locales/ht.json";
import es from "./locales/es.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ht", label: "Kreyòl", flag: "🇭🇹" },
  { code: "es", label: "Español", flag: "🇩🇴" },
  { code: "en", label: "English", flag: "🇺🇸" },
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
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "ht", "es", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ayiti_lang",
    },
  });

export default i18n;
