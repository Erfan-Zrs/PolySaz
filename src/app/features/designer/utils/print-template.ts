import { CameraCutout, PhoneSpec, SideFeature } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { sideFeatureRectMm, sideFeatures, ZoneRectMm } from '../../../core/utils/side-features';

export interface TemplateStyle {
  readonly cutLine: string;
  readonly bleedFill: string;
  readonly cutoutFill: string;
  readonly cutoutStroke: string;
  readonly grid?: string;
  readonly lineWidthPx: number;
}

function backOffsetMm(zone: PrintZone): number {
  return zone.bleedMm + zone.wrapMm;
}

export function cutoutPxRect(cutout: CameraCutout, zone: PrintZone, pxPerMm: number) {
  return {
    x: (backOffsetMm(zone) + cutout.x) * pxPerMm,
    y: (backOffsetMm(zone) + cutout.y) * pxPerMm,
    w: cutout.w * pxPerMm,
    h: cutout.h * pxPerMm,
  };
}

function cutoutRadiusMm(cutout: CameraCutout): number {
  switch (cutout.shape) {
    case 'pill':
    case 'circle':
      return Math.min(cutout.w, cutout.h) / 2;
    case 'rect':
      return cutout.r ?? 2;
  }
}

export function traceCutout(
  ctx: CanvasRenderingContext2D,
  cutout: CameraCutout,
  zone: PrintZone,
  pxPerMm: number,
): void {
  const r = cutoutPxRect(cutout, zone, pxPerMm);
  if (cutout.shape === 'circle') {
    const d = Math.min(r.w, r.h);
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, d / 2, 0, Math.PI * 2);
  } else {
    ctx.roundRect(r.x, r.y, r.w, r.h, cutoutRadiusMm(cutout) * pxPerMm);
  }
}

export function tracePill(ctx: CanvasRenderingContext2D, rect: ZoneRectMm, pxPerMm: number): void {
  const r = (Math.min(rect.w, rect.h) / 2) * pxPerMm;
  ctx.roundRect(rect.x * pxPerMm, rect.y * pxPerMm, rect.w * pxPerMm, rect.h * pxPerMm, r);
}

export function traceSideFeature(
  ctx: CanvasRenderingContext2D,
  feature: SideFeature,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
): void {
  tracePill(ctx, sideFeatureRectMm(feature, spec, zone), pxPerMm);
}

export function traceCutLine(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
): void {
  traceBackOutline(ctx, spec, zone, pxPerMm, zone.wrapMm);
}

export function traceBackOutline(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
  grow = 0,
): void {
  const b = (backOffsetMm(zone) - grow) * pxPerMm;
  ctx.roundRect(
    b,
    b,
    (zone.caseWidthMm + 2 * grow) * pxPerMm,
    (zone.caseHeightMm + 2 * grow) * pxPerMm,
    (spec.body.cornerRadius + spec.caseWall + grow) * pxPerMm,
  );
}

export function drawPrintTemplate(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
  style: TemplateStyle,
): void {
  const w = zone.widthMm * pxPerMm;
  const h = zone.heightMm * pxPerMm;
  ctx.save();

  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  traceCutLine(ctx, spec, zone, pxPerMm);
  ctx.fillStyle = style.bleedFill;
  ctx.fill('evenodd');

  if (style.grid) {
    ctx.save();
    ctx.beginPath();
    traceCutLine(ctx, spec, zone, pxPerMm);
    ctx.clip();
    ctx.beginPath();
    const first = (backOffsetMm(zone) % 10) - backOffsetMm(zone);
    for (let mm = first; mm < zone.widthMm; mm += 10) {
      const x = (backOffsetMm(zone) + mm) * pxPerMm;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let mm = first; mm < zone.heightMm; mm += 10) {
      const y = (backOffsetMm(zone) + mm) * pxPerMm;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.strokeStyle = style.grid;
    ctx.lineWidth = Math.max(1, style.lineWidthPx / 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  traceCutLine(ctx, spec, zone, pxPerMm);
  ctx.strokeStyle = style.cutLine;
  ctx.lineWidth = style.lineWidthPx;
  ctx.stroke();

  if (zone.wrapMm > 0) {
    ctx.beginPath();
    traceBackOutline(ctx, spec, zone, pxPerMm);
    ctx.setLineDash([style.lineWidthPx * 3, style.lineWidthPx * 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const cutout of spec.cameraCutouts) {
    ctx.beginPath();
    traceCutout(ctx, cutout, zone, pxPerMm);
    ctx.fillStyle = style.cutoutFill;
    ctx.fill();
    ctx.strokeStyle = style.cutoutStroke;
    ctx.lineWidth = style.lineWidthPx;
    ctx.stroke();
  }

  if (zone.wrapMm > 0) {
    for (const feature of sideFeatures(spec, 'hole')) {
      ctx.beginPath();
      traceSideFeature(ctx, feature, spec, zone, pxPerMm);
      ctx.fillStyle = style.cutoutFill;
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([style.lineWidthPx * 2, style.lineWidthPx * 2]);
    for (const feature of sideFeatures(spec, 'cover')) {
      ctx.beginPath();
      traceSideFeature(ctx, feature, spec, zone, pxPerMm);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}
