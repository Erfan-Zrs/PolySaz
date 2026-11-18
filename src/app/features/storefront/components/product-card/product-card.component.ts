import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { PhoneSpec } from '../../../../core/models/phone-spec.model';
import { PricePipe } from '../../../../shared/pipes/price.pipe';
import { CustomizeService } from '../../services/customize.service';
import { ShowcaseDesign } from '../../showcase/showcase-designs';
import { CasePosterComponent } from '../case-poster/case-poster.component';

@Component({
  selector: 'app-product-card',
  imports: [TranslocoDirective, PricePipe, CasePosterComponent],
  templateUrl: './product-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ProductCardComponent {
  readonly design = input.required<ShowcaseDesign>();
  readonly spec = input<PhoneSpec>();
  private readonly customizer = inject(CustomizeService);
  protected readonly busy = signal(false);

  protected async onCustomize(): Promise<void> {
    this.busy.set(true);
    try {
      await this.customizer.customize(this.design());
    } finally {
      this.busy.set(false);
    }
  }
}
