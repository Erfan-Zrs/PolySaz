import { ShowcaseId } from '../showcase/showcase-designs';

export interface BlogPost {
  readonly slug: string;
  readonly date: string;
  readonly readMinutes: number;
  readonly paragraphs: number;
  readonly cover: ShowcaseId;
}

export const BLOG_POSTS: readonly BlogPost[] = [
  { slug: 'photo-for-print', date: '2026-10-04', readMinutes: 4, paragraphs: 4, cover: 'waves' },
  { slug: 'persian-typography', date: '2026-09-18', readMinutes: 5, paragraphs: 4, cover: 'girih' },
  { slug: 'clear-or-color', date: '2026-08-30', readMinutes: 3, paragraphs: 3, cover: 'terrazzo' },
];

export function blogPostBySlug(slug: string | null | undefined): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
