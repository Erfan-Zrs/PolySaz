import { isDevMode } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { TranslocoHttpLoader } from './transloco-http.loader';

export function provideI18n() {
  return provideTransloco({
    config: {
      availableLangs: LANGUAGES.map((l) => l.code),
      defaultLang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: { logMissingKey: true, useFallbackTranslation: true },
    },
    loader: TranslocoHttpLoader,
  });
}
