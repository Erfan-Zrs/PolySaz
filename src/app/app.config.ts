import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { provideI18n } from './core/i18n/transloco.config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled' }),
    ),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    provideI18n(),
  ],
};
