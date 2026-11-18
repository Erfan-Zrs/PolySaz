import { computed, inject, Injectable, signal } from '@angular/core';
import { CaseColor, PhoneSpec } from '../../../core/models/phone-spec.model';
import { ProductSpecService } from '../../../core/services/product-spec.service';
import { computePrintZone } from '../../../core/utils/print-zone';

export interface PendingLayers {
  readonly image?: File;
  readonly text?: string;
}

@Injectable({ providedIn: 'root' })
export class DesignerStateService {
  private readonly products = inject(ProductSpecService);

  readonly selectedPhoneId = signal<string | null>(null);
  private readonly requestedCaseColor = signal<CaseColor>('clear');
  readonly showTemplate = signal(false);
  readonly wrapSides = signal(false);
  readonly pendingLayers = signal<PendingLayers | null>(null);

  readonly spec = computed<PhoneSpec | undefined>(() => {
    const specs = this.products.specs();
    return this.products.byId().get(this.selectedPhoneId() ?? '') ?? specs[0];
  });

  readonly caseColor = computed<CaseColor>(() => {
    const spec = this.spec();
    const wanted = this.requestedCaseColor();
    return !spec || spec.caseColors.includes(wanted) ? wanted : spec.caseColors[0];
  });

  readonly printZone = computed(() => {
    const spec = this.spec();
    return spec ? computePrintZone(spec, this.wrapSides()) : undefined;
  });

  setCaseColor(color: CaseColor): void {
    this.requestedCaseColor.set(color);
  }
}
