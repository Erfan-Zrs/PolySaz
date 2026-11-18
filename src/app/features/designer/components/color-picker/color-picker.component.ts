import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CUSTOM_COLOR_SWATCH, PRINT_COLORS } from '../../fabric/print-colors';

@Component({
  selector: 'app-color-picker',
  imports: [TranslocoDirective],
  templateUrl: './color-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ColorPickerComponent {
  readonly color = input.required<string>();
  readonly label = input.required<string>();
  readonly colorChange = output<string>();

  protected readonly colors = PRINT_COLORS;
  protected readonly customSwatch = CUSTOM_COLOR_SWATCH;
  protected readonly isPresetColor = computed(() =>
    this.colors.some((c) => c.hex === this.color().toLowerCase()),
  );

  protected onCustomColor(event: Event): void {
    this.colorChange.emit((event.target as HTMLInputElement).value);
  }
}
