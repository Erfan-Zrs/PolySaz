import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  resolveTheme,
  ThemePreference,
} from './theme';

export const THEME_STORAGE_KEY = 'polysaz.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly systemPrefersDark = signal(this.media?.matches ?? false);
  private readonly preferenceState = signal<ThemePreference>(readPreference());

  readonly preference = this.preferenceState.asReadonly();
  readonly resolved = computed(() =>
    resolveTheme(this.preferenceState(), this.systemPrefersDark()),
  );

  constructor() {
    if (this.media) {
      const onChange = (e: MediaQueryListEvent) => this.systemPrefersDark.set(e.matches);
      this.media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));
    }

    effect(() => {
      const theme = this.resolved();
      const root = this.document.documentElement;
      root.dataset['theme'] = theme;
      root.style.colorScheme = theme;
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
    }
  }
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}
