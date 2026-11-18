import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';

@Component({
  selector: 'app-info',
  imports: [TranslocoDirective, RouterLink, LocalNumberPipe],
  templateUrl: './info.component.html',
  styleUrl: './info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoComponent {
  protected readonly language = inject(LanguageService);
  protected readonly sections = ['about', 'how', 'shipping', 'faq', 'contact'] as const;
  protected readonly steps = ['pick', 'design', 'deliver'] as const;
  protected readonly faq = ['material', 'quality', 'time', 'photo', 'return'] as const;
}
