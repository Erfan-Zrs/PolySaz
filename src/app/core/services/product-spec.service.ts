import { httpResource } from '@angular/common/http';
import { computed, Injectable } from '@angular/core';
import { PhoneSpec } from '../models/phone-spec.model';

@Injectable({ providedIn: 'root' })
export class ProductSpecService {
  private readonly resource = httpResource<PhoneSpec[]>(() => 'assets/products/phone-cases.json', {
    defaultValue: [],
  });

  readonly specs = this.resource.value.asReadonly();
  readonly isLoading = this.resource.isLoading;
  readonly error = this.resource.error;

  readonly byId = computed(() => new Map(this.specs().map((s) => [s.id, s])));
}
