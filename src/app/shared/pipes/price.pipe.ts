import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { formatPriceAmount } from '../../core/i18n/format';

@Pipe({ name: 'price', pure: false })
export class PricePipe implements PipeTransform {
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  transform(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '';
    const lang = this.language.lang();
    const amount = formatPriceAmount(value, lang);
    return this.transloco.translate('common.price.toman', { amount }, lang);
  }
}
