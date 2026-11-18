import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { findLanguage } from './languages';
import { LanguageService } from './language.service';

export const languageGuard: CanActivateFn = async (route) => {
  const languageService = inject(LanguageService);
  const code = route.paramMap.get('lang');
  if (!findLanguage(code)) {
    return inject(Router).parseUrl(`/${languageService.initialLanguage()}`);
  }
  await languageService.activate(code!);
  return true;
};
