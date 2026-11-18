import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_LANGUAGE, findLanguage, getLanguage, LanguageDescriptor } from './languages';

export const LANGUAGE_STORAGE_KEY = 'polysaz.lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly directionality = inject(Directionality);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly currentLanguage = signal<LanguageDescriptor>(
    getLanguage(this.document.documentElement.lang || DEFAULT_LANGUAGE),
  );

  readonly language = this.currentLanguage.asReadonly();
  readonly lang = computed(() => this.currentLanguage().code);
  readonly dir = computed(() => this.currentLanguage().dir);

  initialLanguage(): string {
    const saved = readStorage(LANGUAGE_STORAGE_KEY);
    return findLanguage(saved)?.code ?? DEFAULT_LANGUAGE;
  }

  async activate(code: string): Promise<void> {
    const language = getLanguage(code);
    await firstValueFrom(this.transloco.load(language.code));
    this.transloco.setActiveLang(language.code);

    const root = this.document.documentElement;
    root.lang = language.code;
    root.dir = language.dir;
    if (this.directionality.value !== language.dir) {
      this.directionality.valueSignal.set(language.dir);
      this.directionality.change.emit(language.dir);
    }

    this.currentLanguage.set(language);
    writeStorage(LANGUAGE_STORAGE_KEY, language.code);
  }

  switchTo(code: string): Promise<boolean> {
    const tree = this.router.parseUrl(this.router.url);
    const primary = tree.root.children['primary'];
    if (primary && primary.segments.length > 0) {
      primary.segments[0].path = code;
      return this.router.navigateByUrl(tree);
    }
    return this.router.navigate(['/', code]);
  }
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}
