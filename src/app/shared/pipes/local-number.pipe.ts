import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatNumber } from '../../core/i18n/format';

@Pipe({ name: 'localNumber', pure: false })
export class LocalNumberPipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: number | null | undefined, maximumFractionDigits = 2): string {
    if (value == null || Number.isNaN(value)) return '';
    return formatNumber(value, this.language.lang(), { maximumFractionDigits });
  }
}
