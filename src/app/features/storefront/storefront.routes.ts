import { Routes } from '@angular/router';

export const STOREFRONT_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'pages.home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'products',
    title: 'pages.products',
    loadComponent: () =>
      import('./pages/products/products.component').then((m) => m.ProductsComponent),
  },
  {
    path: 'blog',
    title: 'pages.blog',
    loadComponent: () => import('./pages/blog/blog.component').then((m) => m.BlogComponent),
  },
  {
    path: 'blog/:slug',
    title: 'pages.blog',
    loadComponent: () =>
      import('./pages/blog-post/blog-post.component').then((m) => m.BlogPostComponent),
  },
  {
    path: 'info',
    title: 'pages.info',
    loadComponent: () => import('./pages/info/info.component').then((m) => m.InfoComponent),
  },
];
