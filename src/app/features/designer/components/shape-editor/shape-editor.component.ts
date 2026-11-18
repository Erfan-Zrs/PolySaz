import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';
import {
  DesignCanvasService,
  MAX_SHAPE_STROKE_MM,
  MIN_SHAPE_STROKE_MM,
  SelectedShapeStyle,
} from '../../fabric/design-canvas.service';
import { ColorPickerComponent } from '../color-picker/color-picker.component';

@Component({
  selector: 'app-shape-editor',
  imports: [TranslocoDirective, LocalNumberPipe, ColorPickerComponent],
  templateUrl: './shape-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-start gap-3' },
})
export class ShapeEditorComponent {
  protected readonly design = inject(DesignCanvasService);

  readonly shapeStyle = input.required<SelectedShapeStyle>();

  protected readonly minStroke = MIN_SHAPE_STROKE_MM;
  protected readonly maxStroke = MAX_SHAPE_STROKE_MM;

  protected onStrokeInput(event: Event): void {
    this.design.setSelectedShapeStyle({
      strokeWidthMm: (event.target as HTMLInputElement).valueAsNumber,
    });
  }
}
