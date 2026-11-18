import { CaseSide, PhoneSpec } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import {
  phoneSideParts,
  sideCasePart,
  sideFeatureMarkerMm,
  sideFeatureRectMm,
  sideFeatures,
} from '../../../core/utils/side-features';
import { cssColor, LENS_SHARES, PHONE_COLORS } from '../three/case-materials';
import { tracePill, traceCutout, traceSideFeature } from './print-template';

const SIDE_ANGLES: Record<CaseSide, number> = {
  top: Math.PI,
  bottom: 0,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};

export function drawCameraDetails(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
): void {
  ctx.save();
  ctx.fillStyle = cssColor(PHONE_COLORS.dark);
  for (const cutout of spec.cameraCutouts) {
    ctx.beginPath();
    traceCutout(ctx, cutout, zone, pxPerMm);
    ctx.fill();
  }

  const off = zone.bleedMm + zone.wrapMm;
  for (const lens of spec.cameraLenses ?? []) {
    const [x, y, r] = [(off + lens.x) * pxPerMm, (off + lens.y) * pxPerMm, (lens.d / 2) * pxPerMm];
    const disc = (share: number, color: string) => {
      ctx.beginPath();
      ctx.arc(x, y, r * share, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    switch (lens.kind) {
      case 'lens':
        disc(1, cssColor(PHONE_COLORS.metal));
        disc(LENS_SHARES.glass, cssColor(PHONE_COLORS.glass));
        disc(LENS_SHARES.core, cssColor(PHONE_COLORS.lensCore));
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();
        break;
      case 'flash':
        disc(1, cssColor(PHONE_COLORS.metal));
        disc(LENS_SHARES.glass, cssColor(PHONE_COLORS.flash));
        break;
      case 'sensor':
        disc(1, cssColor(PHONE_COLORS.glass));
        break;
    }
  }
  ctx.restore();
}

export function drawSideDetails(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
): void {
  ctx.save();
  for (const feature of sideFeatures(spec, 'hole')) {
    ctx.beginPath();
    traceSideFeature(ctx, feature, spec, zone, pxPerMm);
    ctx.fillStyle = cssColor(PHONE_COLORS.body);
    ctx.fill();

    const rect = sideFeatureRectMm(feature, spec, zone);
    ctx.save();
    ctx.translate((rect.x + rect.w / 2) * pxPerMm, (rect.y + rect.h / 2) * pxPerMm);
    ctx.rotate(SIDE_ANGLES[feature.side]);
    const parts = [...phoneSideParts(feature)].sort((a, b) => a.layer - b.layer);
    for (const part of parts) {
      ctx.beginPath();
      tracePill(
        ctx,
        { x: part.at - part.length / 2, y: -part.width / 2, w: part.length, h: part.width },
        pxPerMm,
      );
      ctx.fillStyle = cssColor(PHONE_COLORS[part.color]);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawSideMarkers(
  ctx: CanvasRenderingContext2D,
  spec: PhoneSpec,
  zone: PrintZone,
  pxPerMm: number,
  color: string,
  lineWidthPx: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  for (const feature of sideFeatures(spec)) {
    const part = sideCasePart(feature);
    if (part === 'none') continue;
    ctx.beginPath();
    tracePill(ctx, sideFeatureMarkerMm(feature, zone, 0.8, 1.6), pxPerMm);
    if (part === 'cover') ctx.fill();
    else ctx.stroke();
  }
  ctx.restore();
}
