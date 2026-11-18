import { CanvasTexture, SRGBColorSpace } from 'three';
import { PhoneSpec } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { previewCanvasSize } from '../../../core/utils/print-zone';
import { sideFeatures } from '../../../core/utils/side-features';
import { drawPrintTemplate, traceSideFeature } from '../utils/print-template';

export type DrawDesign = (ctx: CanvasRenderingContext2D, pxPerMm: number) => void;

export function createPrintTexture(
  spec: PhoneSpec,
  zone: PrintZone,
  maxLongSidePx: number,
  drawDesign: DrawDesign,
  showTemplate: boolean,
): CanvasTexture {
  const size = previewCanvasSize(zone, maxLongSidePx);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d')!;
  const pxPerMm = size.width / zone.widthMm;

  ctx.imageSmoothingQuality = 'high';
  drawDesign(ctx, pxPerMm);
  if (zone.wrapMm > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    for (const feature of sideFeatures(spec, 'hole')) {
      traceSideFeature(ctx, feature, spec, zone, pxPerMm);
    }
    ctx.fill();
    ctx.restore();
  }
  if (showTemplate) drawTemplateOverlay(ctx, spec, zone, pxPerMm);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawTemplateOverlay(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
): void {
  drawPrintTemplate(ctx, spec, zone, pxPerMm, {
    cutLine: '#e0218a',
    bleedFill: 'rgba(224, 33, 138, 0.25)',
    cutoutFill: 'rgba(255, 140, 0, 0.35)',
    cutoutStroke: '#ff8c00',
    grid: 'rgba(30, 90, 255, 0.55)',
    lineWidthPx: Math.max(2, pxPerMm * 0.4),
  });

  const cx = ctx.canvas.width / 2;
  const top = (zone.bleedMm + zone.wrapMm + 4) * pxPerMm;
  ctx.fillStyle = '#1e5aff';
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx - 4 * pxPerMm, top + 6 * pxPerMm);
  ctx.lineTo(cx + 4 * pxPerMm, top + 6 * pxPerMm);
  ctx.closePath();
  ctx.fill();
}

export function previewMaxLongSide(): number {
  return Math.min(screen.width, screen.height) < 768 ? 1024 : 2048;
}
