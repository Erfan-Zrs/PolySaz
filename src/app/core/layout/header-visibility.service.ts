import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeaderVisibilityService {
  readonly hidden = signal(false);
}
