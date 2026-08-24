import { fr, es, pt, de, it, zhCN, ar, enUS } from "date-fns/locale";

const localeMap: Record<string, typeof enUS> = {

  fr,
  es,
  pt,
  de,
  it,
  "zh-CN": zhCN,
  zh: zhCN,
  ar,
  enUS,
  en: enUS,
  ht: enUS,
};

export function getDateFnsLocale(lng: string) {
  const base = (lng || "en").split("-")[0];
  return localeMap[lng] || localeMap[base] || enUS;
}
