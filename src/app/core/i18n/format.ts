import { getLanguage } from './languages';


const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(lang: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = getLanguage(lang).numberLocale;
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = numberFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, f);
  }
  return f;
}

export function formatNumber(
  value: number,
  lang: string,
  options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 },
): string {
  return numberFormatter(lang, options).format(value);
}

export function formatPriceAmount(value: number, lang: string): string {
  return numberFormatter(lang, { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(
  value: Date | number | string,
  lang: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  const locale = getLanguage(lang).dateLocale;
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, f);
  }
  return f.format(value instanceof Date ? value : new Date(value));
}
