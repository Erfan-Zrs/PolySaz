import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProductSpecService } from '../../../../core/services/product-spec.service';
import { DesignerStateService } from '../../../designer/services/designer-state.service';
import { ProductCardComponent } from '../../components/product-card/product-card.component';
import { SHOWCASE_DESIGNS, ShowcaseCategory } from '../../showcase/showcase-designs';

type CategoryFilter = 'all' | ShowcaseCategory;

@Component({
  selector: 'app-products',
  imports: [TranslocoDirective, ProductCardComponent],
  templateUrl: './products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent {
  protected readonly products = inject(ProductSpecService);
  protected readonly state = inject(DesignerStateService);
  protected readonly categories: readonly CategoryFilter[] = [
    'all',
    'abstract',
    'pattern',
    'nature',
  ];
  protected readonly category = signal<CategoryFilter>('all');
  protected readonly designs = computed(() => {
    const category = this.category();
    return category === 'all'
      ? SHOWCASE_DESIGNS
      : SHOWCASE_DESIGNS.filter((d) => d.category === category);
  });

  protected onPhoneChange(event: Event): void {
    this.state.selectedPhoneId.set((event.target as HTMLSelectElement).value);
  }
}
