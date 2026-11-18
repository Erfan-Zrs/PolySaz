import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';
import { BlogPost } from '../../data/blog-posts';
import { showcaseById, SHOWCASE_DESIGNS } from '../../showcase/showcase-designs';
import { CasePosterComponent } from '../case-poster/case-poster.component';

@Component({
  selector: 'app-blog-card',
  imports: [TranslocoDirective, RouterLink, LocalDatePipe, LocalNumberPipe, CasePosterComponent],
  templateUrl: './blog-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class BlogCardComponent {
  readonly post = input.required<BlogPost>();
  protected readonly language = inject(LanguageService);
  protected readonly cover = computed(() => showcaseById(this.post().cover) ?? SHOWCASE_DESIGNS[0]);
}
