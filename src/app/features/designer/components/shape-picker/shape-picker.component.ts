import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { SHAPES, ShapeId } from '../../fabric/shapes';
import { ShapeIconComponent } from '../shape-icon/shape-icon.component';

export interface ShapeRequest {
  readonly shape: ShapeId;
  readonly filled: boolean;
}

@Component({
  selector: 'app-shape-picker',
  imports: [TranslocoDirective, ShapeIconComponent],
  templateUrl: './shape-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-start gap-2' },
})
export class ShapePickerComponent {
  readonly add = output<ShapeRequest>();

  protected readonly shapes = SHAPES;
  protected readonly filled = signal(true);
}
