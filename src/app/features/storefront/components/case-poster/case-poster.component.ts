import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  untracked,
} from '@angular/core';
import { PhoneSpec } from '../../../../core/models/phone-spec.model';
import { PrintZone } from '../../../../core/models/print-zone.model';
import { computePrintZone } from '../../../../core/utils/print-zone';
import { traceBackOutline, traceCutout } from '../../../designer/utils/print-template';
import { drawShowcase, ensureShowcaseFont, ShowcaseDesign } from '../../showcase/showcase-designs';

const PADDING_SHARE = 0.06;

const ISLAND = '#121316';
const LENS_RING = '#2b2d33';
const LENS_GLASS = '#07080b';
const FLASH = '#f1e7c9';

@Component({
  selector: 'app-case-poster',
  templateUrl: './case-poster.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block', '[attr.shape]': 'shape()' },
})
export class CasePosterComponent {
  readonly spec = input<PhoneSpec>();
  readonly design = input.required<ShowcaseDesign>();
  readonly name = input('');
  readonly shape = input<'case' | 'cover'>('case');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private canvas?: HTMLCanvasElement;
  private frameQueued = false;

  constructor() {
    afterNextRender(() => {
      this.canvas = this.host.querySelector('canvas')!;
      const observer = new ResizeObserver(() => this.queueDraw());
      this.zone.runOutsideAngular(() => observer.observe(this.host));
      this.destroyRef.onDestroy(() => observer.disconnect());
      this.queueDraw();
    });

    effect(() => {
      const design = this.design();
      const name = this.name();
      this.spec();
      this.shape();
      untracked(() => {
        this.queueDraw();
        void ensureShowcaseFont(design, name).then((loaded) => loaded && this.queueDraw());
      });
    });
  }

  private queueDraw(): void {
    if (this.frameQueued || !this.canvas) return;
    this.frameQueued = true;
    this.zone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.frameQueued = false;
        this.draw();
      }),
    );
  }

  private draw(): void {
    const canvas = this.canvas;
    if (!canvas || this.destroyRef.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.host.clientWidth * dpr);
    const height = Math.round(this.host.clientHeight * dpr);
    if (width === 0 || height === 0) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    const design = this.design();
    const spec = this.spec();
    if (this.shape() === 'cover' || !spec) {
      design.paint(ctx, width, height);
      return;
    }

    const zone = computePrintZone(spec, false);
    const pad = Math.min(width, height) * PADDING_SHARE;
    const pxPerMm = Math.min(
      (width - 2 * pad) / zone.caseWidthMm,
      (height - 2 * pad) / zone.caseHeightMm,
    );
    const ox = (width - zone.caseWidthMm * pxPerMm) / 2 - zone.bleedMm * pxPerMm;
    const oy = (height - zone.caseHeightMm * pxPerMm) / 2 - zone.bleedMm * pxPerMm;
    ctx.translate(ox, oy);

    ctx.save();
    ctx.beginPath();
    traceBackOutline(ctx, spec, zone, pxPerMm);
    ctx.clip();
    drawShowcase(ctx, design, zone, pxPerMm, this.name());
    this.drawCamera(ctx, spec, zone, pxPerMm);
    this.drawGloss(ctx, zone, pxPerMm);
    ctx.restore();

    ctx.beginPath();
    traceBackOutline(ctx, spec, zone, pxPerMm, -0.6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.8 * pxPerMm;
    ctx.stroke();
    ctx.beginPath();
    traceBackOutline(ctx, spec, zone, pxPerMm);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = Math.max(1, 0.3 * pxPerMm);
    ctx.stroke();
  }

  private drawCamera(
    ctx: CanvasRenderingContext2D,
    spec: PhoneSpec,
    zone: PrintZone,
    pxPerMm: number,
  ): void {
    ctx.fillStyle = ISLAND;
    for (const cutout of spec.cameraCutouts) {
      ctx.beginPath();
      traceCutout(ctx, cutout, zone, pxPerMm);
      ctx.fill();
    }
    const offset = zone.bleedMm * pxPerMm;
    for (const lens of spec.cameraLenses ?? []) {
      const x = offset + lens.x * pxPerMm;
      const y = offset + lens.y * pxPerMm;
      const r = (lens.d / 2) * pxPerMm;
      if (lens.kind === 'flash') {
        ctx.fillStyle = FLASH;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = LENS_RING;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = LENS_GLASS;
      ctx.beginPath();
      ctx.arc(x, y, r * (lens.kind === 'sensor' ? 0.6 : 0.78), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(140, 170, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawGloss(ctx: CanvasRenderingContext2D, zone: PrintZone, pxPerMm: number): void {
    const w = zone.widthMm * pxPerMm;
    const h = zone.heightMm * pxPerMm;
    const gloss = ctx.createLinearGradient(0, 0, w, h * 0.6);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    gloss.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
    gloss.addColorStop(0.36, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, w, h);
  }
}
