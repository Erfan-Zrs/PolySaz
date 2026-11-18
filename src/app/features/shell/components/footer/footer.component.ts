import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';

interface FooterLink {
  readonly key: string;
  readonly path: string;
  readonly fragment?: string;
}

@Component({
  selector: 'app-footer',
  imports: [TranslocoDirective, RouterLink, LocalDatePipe],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  protected readonly language = inject(LanguageService);
  protected readonly today = new Date();
  protected readonly columns: readonly { key: string; links: readonly FooterLink[] }[] = [
    {
      key: 'shop',
      links: [
        { key: 'nav.products', path: 'products' },
        { key: 'nav.design', path: 'design' },
      ],
    },
    {
      key: 'learn',
      links: [
        { key: 'nav.blog', path: 'blog' },
        { key: 'footer.about', path: 'info', fragment: 'about' },
        { key: 'footer.how', path: 'info', fragment: 'how' },
      ],
    },
    {
      key: 'help',
      links: [
        { key: 'footer.shipping', path: 'info', fragment: 'shipping' },
        { key: 'footer.faq', path: 'info', fragment: 'faq' },
        { key: 'footer.contact', path: 'info', fragment: 'contact' },
      ],
    },
  ];
}
