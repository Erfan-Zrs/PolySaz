import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { map } from 'rxjs';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';
import { CasePosterComponent } from '../../components/case-poster/case-poster.component';
import { blogPostBySlug } from '../../data/blog-posts';
import { showcaseById } from '../../showcase/showcase-designs';

@Component({
  selector: 'app-blog-post',
  imports: [TranslocoDirective, RouterLink, LocalDatePipe, LocalNumberPipe, CasePosterComponent],
  templateUrl: './blog-post.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostComponent {
  protected readonly language = inject(LanguageService);
  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('slug'))),
  );
  protected readonly post = computed(() => blogPostBySlug(this.slug()));
  protected readonly cover = computed(() => showcaseById(this.post()?.cover));
  protected readonly paragraphs = computed(() =>
    Array.from({ length: this.post()?.paragraphs ?? 0 }, (_, i) => `p${i + 1}`),
  );
}
