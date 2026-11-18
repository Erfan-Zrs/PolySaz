import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  DesignCanvasService,
  SelectedTextStyle,
  TextAlign,
} from '../../fabric/design-canvas.service';
import { TEXT_FONTS, textFontById } from '../../fabric/text-fonts';
import { ColorPickerComponent } from '../color-picker/color-picker.component';

type ToggleKey = 'bold' | 'italic' | 'underline';

@Component({
  selector: 'app-text-editor',
  imports: [TranslocoDirective, ColorPickerComponent],
  templateUrl: './text-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-3' },
})
export class TextEditorComponent {
  private readonly design = inject(DesignCanvasService);

  readonly textStyle = input.required<SelectedTextStyle>();

  protected readonly fonts = TEXT_FONTS;
  protected readonly toggles: readonly ToggleKey[] = ['bold', 'italic', 'underline'];
  protected readonly aligns: readonly TextAlign[] = ['left', 'center', 'right'];
  protected readonly fontFamily = computed(() =>
    cssFamily(textFontById(this.textStyle().font).family),
  );
  protected readonly cssFamily = cssFamily;

  private readonly textInput = viewChild.required<ElementRef<HTMLTextAreaElement>>('textInput');

  focusText(): void {
    const el = this.textInput().nativeElement;
    el.focus();
    el.select();
  }

  protected onText(event: Event): void {
    this.design.setSelectedTextStyle({ text: (event.target as HTMLTextAreaElement).value });
  }

  protected toggle(key: ToggleKey): void {
    this.design.setSelectedTextStyle({ [key]: !this.textStyle()[key] });
  }

  protected update(change: Partial<SelectedTextStyle>): void {
    this.design.setSelectedTextStyle(change);
  }
}

function cssFamily(family: string): string {
  return `'${family}', 'Vazirmatn', sans-serif`;
}
