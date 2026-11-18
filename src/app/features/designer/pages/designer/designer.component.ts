import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { HeaderVisibilityService } from '../../../../core/layout/header-visibility.service';
import { CaseColor } from '../../../../core/models/phone-spec.model';
import { ProductSpecService } from '../../../../core/services/product-spec.service';
import { LocalNumberPipe } from '../../../../shared/pipes/local-number.pipe';
import {
  DesignCanvasService,
  MAX_SIZE_PERCENT,
  MIN_SIZE_PERCENT,
  VIEW_ZOOM_STEP,
} from '../../fabric/design-canvas.service';
import { LayerListComponent } from '../../components/layer-list/layer-list.component';
import { ShapeEditorComponent } from '../../components/shape-editor/shape-editor.component';
import {
  ShapePickerComponent,
  ShapeRequest,
} from '../../components/shape-picker/shape-picker.component';
import { TextEditorComponent } from '../../components/text-editor/text-editor.component';
import { DesignerStateService, PendingLayers } from '../../services/designer-state.service';
import { createPrintTexture, previewMaxLongSide } from '../../three/print-texture';
import { SceneService } from '../../three/scene.service';
import { InvalidImageError } from '../../utils/load-image';

const CASE_SWATCHES: Record<CaseColor, string> = {
  clear: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(200,215,230,0.6))',
  black: '#1b1c1f',
  white: '#f1f1ee',
};

const SWIPE_PX = 12;

type DesignerView = '3d' | 'edit';
type PanelTab = 'case' | 'design' | 'adjust';

@Component({
  selector: 'app-designer',
  imports: [
    TranslocoDirective,
    LocalNumberPipe,
    LayerListComponent,
    TextEditorComponent,
    ShapePickerComponent,
    ShapeEditorComponent,
  ],
  providers: [SceneService, DesignCanvasService],
  templateUrl: './designer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto_auto] wide:grid-cols-[300px_minmax(0,1fr)_300px] wide:grid-rows-[minmax(0,1fr)]',
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(wheel)': 'onWheel($event)',
  },
})
export class DesignerComponent {
  protected readonly products = inject(ProductSpecService);
  protected readonly state = inject(DesignerStateService);
  protected readonly scene = inject(SceneService);
  protected readonly design = inject(DesignCanvasService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly header = inject(HeaderVisibilityService);
  protected readonly swatches = CASE_SWATCHES;
  protected readonly minSize = MIN_SIZE_PERCENT;
  protected readonly maxSize = MAX_SIZE_PERCENT;
  protected readonly tabs: readonly PanelTab[] = ['case', 'design', 'adjust'];
  protected readonly tab = signal<PanelTab>('case');
  protected readonly toolbarOpen = signal(true);
  protected readonly zoomStep = VIEW_ZOOM_STEP;
  private swipeY: number | null = null;

  private readonly requestedView = signal<DesignerView>('3d');
  protected readonly view = computed<DesignerView>(() =>
    this.scene.webglAvailable() ? this.requestedView() : 'edit',
  );
  protected readonly uploadError = signal<'invalid' | null>(null);
  protected readonly lowDpi = computed(() => {
    const dpi = this.design.selectedImageDpi();
    const zone = this.state.printZone();
    return dpi !== null && !!zone && dpi < zone.dpi / 2 ? dpi : null;
  });

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly sceneHost = viewChild.required<ElementRef<HTMLElement>>('sceneHost');
  private readonly flatHost = viewChild.required<ElementRef<HTMLElement>>('flatHost');
  private readonly textEditor = viewChild(TextEditorComponent);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.header.hidden.set(false));
    afterNextRender(() => {
      this.scene.init(this.sceneHost().nativeElement);
      this.design.init(this.flatHost().nativeElement);
      effect(
        () => {
          const pending = this.state.pendingLayers();
          if (!pending || !this.state.printZone()) return;
          untracked(() => {
            this.state.pendingLayers.set(null);
            void this.addPendingLayers(pending);
          });
        },
        { injector: this.injector },
      );
    });

    effect(() => {
      const spec = this.state.spec();
      const zone = this.state.printZone();
      if (!spec || !zone || !this.scene.ready()) return;
      untracked(() => this.scene.setSpec(spec, zone));
    });

    effect(() => {
      const spec = this.state.spec();
      const zone = this.state.printZone();
      if (spec && zone) untracked(() => this.design.setProduct(spec, zone));
    });

    effect(() => {
      const color = this.state.caseColor();
      untracked(() => this.design.setCaseColor(color));
      if (this.scene.ready()) untracked(() => this.scene.setCaseColor(color));
    });

    effect(() => {
      const selected = this.design.hasSelection();
      untracked(() => {
        if (selected) this.tab.set('adjust');
        else if (this.tab() === 'adjust') this.tab.set('design');
      });
    });

    effect((onCleanup) => {
      const spec = this.state.spec();
      const zone = this.state.printZone();
      const show = this.state.showTemplate();
      this.design.version();
      if (!spec || !zone || !this.scene.ready() || this.view() !== '3d') return;
      const texture = untracked(() =>
        createPrintTexture(spec, zone, previewMaxLongSide(), this.design.drawDesign, show),
      );
      untracked(() => this.scene.setPrintTexture(texture));
      onCleanup(() => texture.dispose());
    });
  }

  protected onStagePointerDown(): void {
    this.header.hidden.set(true);
  }

  protected onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.swipeY = event.touches.length === 1 && this.overPanels(event) ? touch.clientY : null;
  }

  protected onTouchMove(event: TouchEvent): void {
    const y = event.touches[0]?.clientY;
    if (this.swipeY === null || y === undefined || Math.abs(y - this.swipeY) < SWIPE_PX) return;
    this.header.hidden.set(y < this.swipeY);
    this.swipeY = y;
  }

  protected onWheel(event: WheelEvent): void {
    if (event.deltaY && this.overPanels(event)) this.header.hidden.set(event.deltaY > 0);
  }

  private overPanels(event: Event): boolean {
    return !this.stage().nativeElement.contains(event.target as Node);
  }

  protected onPhoneChange(event: Event): void {
    this.state.selectedPhoneId.set((event.target as HTMLSelectElement).value);
  }

  protected onCaseColor(color: CaseColor): void {
    this.state.setCaseColor(color);
  }

  protected onToggleWrap(event: Event): void {
    this.state.wrapSides.set((event.target as HTMLInputElement).checked);
  }

  protected toggleTemplate(): void {
    this.state.showTemplate.update((show) => !show);
  }

  protected setView(view: DesignerView): void {
    this.requestedView.set(view);
  }

  protected onSizeInput(event: Event): void {
    this.design.setSelectedSize((event.target as HTMLInputElement).valueAsNumber);
  }

  protected onAngleInput(event: Event): void {
    this.design.setSelectedAngle((event.target as HTMLInputElement).valueAsNumber);
  }

  protected async onAddText(): Promise<void> {
    await this.design.addText(
      this.transloco.translate('designer.text.default'),
      this.textColorOnCase(),
    );
    afterNextRender(() => this.textEditor()?.focusText(), { injector: this.injector });
  }

  protected onAddShape({ shape, filled }: ShapeRequest): void {
    this.design.addShape(shape, filled, this.textColorOnCase());
  }

  private async addPendingLayers({ image, text }: PendingLayers): Promise<void> {
    if (image) await this.design.addImage(image);
    if (text) await this.design.addText(text, image ? '#ffffff' : this.textColorOnCase());
  }

  private textColorOnCase(): string {
    return this.state.caseColor() === 'black' ? '#ffffff' : '#000000';
  }

  protected async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadError.set(null);
    try {
      await this.design.addImage(file);
    } catch (error) {
      if (!(error instanceof InvalidImageError)) throw error;
      this.uploadError.set('invalid');
    }
  }
}
