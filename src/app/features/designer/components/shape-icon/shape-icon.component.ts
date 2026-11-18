import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { shapeById, ShapeId } from '../../fabric/shapes';

@Component({
  selector: 'app-shape-icon',
  templateUrl: './shape-icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class ShapeIconComponent {
  readonly shape = input.required<ShapeId>();
  readonly filled = input(false);

  protected readonly def = computed(() => shapeById(this.shape()));
  protected readonly viewBox = computed(() => {
    const { width, height } = this.def();
    const side = Math.max(width, height) * 1.1;
    return `${(width - side) / 2} ${(height - side) / 2} ${side} ${side}`;
  });
}
