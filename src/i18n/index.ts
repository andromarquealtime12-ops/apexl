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

// Domain-scoped bundles (seller / driver / buyer + notifications)
import sellerFr from "./locales/seller.fr.json";
import sellerHt from "./locales/seller.ht.json";
import sellerEs from "./locales/seller.es.json";
import sellerEn from "./locales/seller.en.json";
import sellerPt from "./locales/seller.pt.json";
import sellerDe from "./locales/seller.de.json";
import sellerIt from "./locales/seller.it.json";
import sellerZh from "./locales/seller.zh.json";
import sellerAr from "./locales/seller.ar.json";
import driverFr from "./locales/driver.fr.json";
import driverHt from "./locales/driver.ht.json";
import driverEs from "./locales/driver.es.json";
import driverEn from "./locales/driver.en.json";
import driverPt from "./locales/driver.pt.json";
import driverDe from "./locales/driver.de.json";
import driverIt from "./locales/driver.it.json";
import driverZh from "./locales/driver.zh.json";
import driverAr from "./locales/driver.ar.json";
import buyerFr from "./locales/buyerx.fr.json";
import buyerHt from "./locales/buyerx.ht.json";
import buyerEs from "./locales/buyerx.es.json";
import buyerEn from "./locales/buyerx.en.json";
import buyerPt from "./locales/buyerx.pt.json";
import buyerDe from "./locales/buyerx.de.json";
import buyerIt from "./locales/buyerx.it.json";
import buyerZh from "./locales/buyerx.zh.json";
import buyerAr from "./locales/buyerx.ar.json";
import restoFr from "./locales/restaurant.fr.json";
import restoHt from "./locales/restaurant.ht.json";
import restoEs from "./locales/restaurant.es.json";
import restoEn from "./locales/restaurant.en.json";
import restoPt from "./locales/restaurant.pt.json";
import restoDe from "./locales/restaurant.de.json";
import restoIt from "./locales/restaurant.it.json";
import restoZh from "./locales/restaurant.zh.json";
import restoAr from "./locales/restaurant.ar.json";


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
      fr: { translation: { ...fr, ...sellerFr, ...driverFr, ...buyerFr, ...restoFr } },
      ht: { translation: { ...ht, ...sellerHt, ...driverHt, ...buyerHt, ...restoHt } },
      es: { translation: { ...es, ...sellerEs, ...driverEs, ...buyerEs, ...restoEs } },
      en: { translation: { ...en, ...sellerEn, ...driverEn, ...buyerEn, ...restoEn } },
      pt: { translation: { ...pt, ...sellerPt, ...driverPt, ...buyerPt, ...restoPt } },
      de: { translation: { ...de, ...sellerDe, ...driverDe, ...buyerDe, ...restoDe } },
      it: { translation: { ...it, ...sellerIt, ...driverIt, ...buyerIt, ...restoIt } },
      zh: { translation: { ...zh, ...sellerZh, ...driverZh, ...buyerZh, ...restoZh } },
      ar: { translation: { ...ar, ...sellerAr, ...driverAr, ...buyerAr, ...restoAr } },
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
