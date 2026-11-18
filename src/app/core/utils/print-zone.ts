import { PhoneSpec } from '../models/phone-spec.model';
import { PrintZone } from '../models/print-zone.model';

export const MM_PER_INCH = 25.4;

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

export const RIM_LIP_MM = 0.8;

export function caseEdgeRadius(wall: number): number {
  return Math.min(0.6, wall / 2.5);
}


export function sideWrapMm(spec: PhoneSpec): number {
  const r = caseEdgeRadius(spec.caseWall);
  return spec.caseWall + spec.body.depth + RIM_LIP_MM + r * (Math.PI - 2);
}

export function computePrintZone(spec: PhoneSpec, wrap = false): PrintZone {
  const caseWidthMm = spec.body.width + 2 * spec.caseWall;
  const caseHeightMm = spec.body.height + 2 * spec.caseWall;
  const wrapMm = wrap ? sideWrapMm(spec) : 0;
  const bleedMm = spec.printZone.bleed;
  const widthMm = caseWidthMm + 2 * (wrapMm + bleedMm);
  const heightMm = caseHeightMm + 2 * (wrapMm + bleedMm);
  const dpi = spec.printZone.dpi;
  return {
    caseWidthMm,
    caseHeightMm,
    wrapMm,
    bleedMm,
    widthMm,
    heightMm,
    dpi,
    widthPx: mmToPx(widthMm, dpi),
    heightPx: mmToPx(heightMm, dpi),
  };
}


export function previewCanvasSize(
  zone: PrintZone,
  maxLongSidePx: number,
): { width: number; height: number } {
  const scale = maxLongSidePx / Math.max(zone.widthMm, zone.heightMm);
  return {
    width: Math.round(zone.widthMm * scale),
    height: Math.round(zone.heightMm * scale),
  };
}
