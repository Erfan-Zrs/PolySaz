import { Routes } from '@angular/router';

export const DESIGNER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/designer/designer.component').then((m) => m.DesignerComponent),
  },
  { path: '**', redirectTo: '' },
];
