import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { HeaderVisibilityService } from '../../../../core/layout/header-visibility.service';
import { FooterComponent } from '../../components/footer/footer.component';
import { HeaderComponent } from '../../components/header/header.component';

@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, TranslocoDirective],
  templateUrl: './shell-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-dvh flex-col', '[class.h-dvh]': 'fullscreen()' },
})
export class ShellLayoutComponent {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly header = inject(HeaderVisibilityService);

  protected readonly fullscreen = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => isFullscreen(this.router.routerState.snapshot.root)),
    ),
    { initialValue: false },
  );

  constructor() {
    let previousPath: string | null = null;
    let popstate = false;
    const subscription = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) popstate = e.navigationTrigger === 'popstate';
      if (!(e instanceof NavigationEnd)) return;
      const tree = this.router.parseUrl(e.urlAfterRedirects);
      const segments = tree.root.children['primary']?.segments.slice(1) ?? [];
      const path = segments.map((s) => s.path).join('/');
      if (previousPath !== null && path !== previousPath && !popstate && !tree.fragment) {
        this.document.defaultView?.scrollTo({ top: 0 });
      }
      previousPath = path;
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected focusMain(): void {
    this.document.getElementById('main')?.focus();
  }
}

function isFullscreen(route: ActivatedRouteSnapshot | null): boolean {
  for (let r = route; r; r = r.firstChild) {
    if (r.data['fullscreen'] === true) return true;
  }
  return false;
}
