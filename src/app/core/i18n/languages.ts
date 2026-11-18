
export interface LanguageDescriptor {
  readonly code: string;
  readonly dir: 'rtl' | 'ltr';
  readonly nativeName: string;
  readonly numberLocale: string;
  readonly dateLocale: string;
}

export const LANGUAGES: readonly LanguageDescriptor[] = [
  {
    code: 'fa',
    dir: 'rtl',
    nativeName: 'فارسی',
    numberLocale: 'fa-IR',
    dateLocale: 'fa-IR-u-ca-persian',
  },
  {
    code: 'en',
    dir: 'ltr',
    nativeName: 'English',
    numberLocale: 'en-US',
    dateLocale: 'en-US',
  },
];

export const DEFAULT_LANGUAGE = 'fa';

export function findLanguage(code: string | null | undefined): LanguageDescriptor | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function getLanguage(code: string): LanguageDescriptor {
  return findLanguage(code) ?? findLanguage(DEFAULT_LANGUAGE)!;
}
