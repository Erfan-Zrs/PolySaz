import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { languageGuard } from './core/i18n/language.guard';
import { LanguageService } from './core/i18n/language.service';
import { ShellLayoutComponent } from './features/shell/layouts/shell-layout/shell-layout.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => `/${inject(LanguageService).initialLanguage()}`,
  },
  {
    path: ':lang',
    canActivate: [languageGuard],
    component: ShellLayoutComponent,
    children: [
      {
        path: 'design',
        title: 'pages.design',
        data: { fullscreen: true },
        loadChildren: () =>
          import('./features/designer/designer.routes').then((m) => m.DESIGNER_ROUTES),
      },
      {
        path: '',
        loadChildren: () =>
          import('./features/storefront/storefront.routes').then((m) => m.STOREFRONT_ROUTES),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
