import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';
import { DesignerStateService } from '../../../designer/services/designer-state.service';
import { BlogCardComponent } from '../../components/blog-card/blog-card.component';
import { HeroComponent } from '../../components/hero/hero.component';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { BLOG_POSTS } from '../../data/blog-posts';
import { SHOWCASE_DESIGNS } from '../../showcase/showcase-designs';

@Component({
  selector: 'app-home',
  imports: [
    TranslocoDirective,
    RouterLink,
    LocalNumberPipe,
    HeroComponent,
    ProductCardComponent,
    BlogCardComponent,
  ],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly language = inject(LanguageService);
  protected readonly state = inject(DesignerStateService);
  protected readonly featured = SHOWCASE_DESIGNS.slice(4, 8);
  protected readonly posts = BLOG_POSTS;
  protected readonly steps = ['pick', 'design', 'deliver'] as const;
  protected readonly features = ['print', 'fonts', 'fit', 'shipping'] as const;
}
