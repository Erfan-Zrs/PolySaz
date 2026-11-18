import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LANGUAGES } from '../../../../core/i18n/languages';
import { LanguageService } from '../../../../core/i18n/language.service';
import { THEME_PREFERENCES, ThemePreference } from '../../../../core/theme/theme';
import { ThemeService } from '../../../../core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [TranslocoDirective, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly languages = LANGUAGES;
  protected readonly themes = THEME_PREFERENCES;
  protected readonly links = ['products', 'blog', 'info'] as const;
  protected readonly menuOpen = signal(false);

  constructor() {
    const subscription = inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.menuOpen.set(false);
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onLanguageChange(event: Event): void {
    this.language.switchTo((event.target as HTMLSelectElement).value);
  }

  protected onTheme(preference: ThemePreference): void {
    this.theme.setPreference(preference);
  }
}
