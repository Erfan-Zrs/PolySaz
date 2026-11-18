import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { BlogCardComponent } from '../../components/blog-card/blog-card.component';
import { BLOG_POSTS } from '../../data/blog-posts';

@Component({
  selector: 'app-blog',
  imports: [TranslocoDirective, BlogCardComponent],
  templateUrl: './blog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogComponent {
  protected readonly posts = BLOG_POSTS;
}
