import { inject, Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { formatDate } from '../../core/i18n/format';

@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(
    value: Date | number | string | null | undefined,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    if (value == null || value === '') return '';
    return formatDate(value, this.language.lang(), options);
  }
}
