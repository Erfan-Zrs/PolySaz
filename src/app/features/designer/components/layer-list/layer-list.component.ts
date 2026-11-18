import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { DesignCanvasService } from '../../fabric/design-canvas.service';
import { ShapeIconComponent } from '../shape-icon/shape-icon.component';

@Component({
  selector: 'app-layer-list',
  imports: [TranslocoDirective, CdkDropList, CdkDrag, CdkDragHandle, ShapeIconComponent],
  templateUrl: './layer-list.component.html',
  styleUrl: './layer-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class LayerListComponent {
  protected readonly design = inject(DesignCanvasService);

  readonly layerSelected = output<number>();

  protected select(id: number): void {
    this.design.selectLayer(id);
    this.layerSelected.emit(id);
  }

  protected onDrop(event: CdkDragDrop<unknown, unknown, number>): void {
    this.design.moveLayer(event.item.data, event.currentIndex);
  }

  protected move(id: number, index: number, event: Event): void {
    event.preventDefault();
    this.design.moveLayer(id, index);
  }
}
