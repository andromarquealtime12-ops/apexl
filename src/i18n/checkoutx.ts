// Side-effect module: registers the "checkoutx" translation bundle for all
// supported languages. Imported from components that need it (e.g. Checkout
// page) instead of editing the central i18n/index.ts bootstrap.
import i18n from "i18next";

import fr from "./locales/checkoutx.fr.json";
import en from "./locales/checkoutx.en.json";
import es from "./locales/checkoutx.es.json";
import pt from "./locales/checkoutx.pt.json";
import de from "./locales/checkoutx.de.json";
import it from "./locales/checkoutx.it.json";
import ht from "./locales/checkoutx.ht.json";
import zh from "./locales/checkoutx.zh.json";
import ar from "./locales/checkoutx.ar.json";

const BUNDLES: Record<string, any> = { fr, en, es, pt, de, it, ht, zh, ar };

for (const [lng, bundle] of Object.entries(BUNDLES)) {
  i18n.addResourceBundle(lng, "translation", bundle, true, true);
}

export default i18n;
