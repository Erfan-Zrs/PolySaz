import { PhoneSpec, SideFeature, SideFeatureKind } from '../models/phone-spec.model';
import { PrintZone } from '../models/print-zone.model';
import { caseEdgeRadius } from './print-zone';

export type SideCasePart = 'hole' | 'cover' | 'none';

const CASE_PARTS: Record<SideFeatureKind, SideCasePart> = {
  button: 'cover',
  usb: 'hole',
  jack: 'hole',
  speaker: 'hole',
  mic: 'hole',
  sim: 'none',
};

export function sideCasePart(feature: SideFeature): SideCasePart {
  return CASE_PARTS[feature.kind];
}

export function sideFeatures(spec: PhoneSpec, part?: SideCasePart): readonly SideFeature[] {
  const all = spec.sideFeatures ?? [];
  return part ? all.filter((f) => sideCasePart(f) === part) : all;
}

export interface PhoneSidePart {
  readonly color: 'dark' | 'metal';
  readonly at: number;
  readonly length: number;
  readonly width: number;
  readonly layer: 0 | 1;
}

export function phoneSideParts(f: SideFeature): readonly PhoneSidePart[] {
  const fit = (size: number, inCase: number, margin: number) =>
    Math.max(0.3, Math.min(size, inCase - margin));
  const round = (color: PhoneSidePart['color'], at: number, d: number, layer: 0 | 1 = 0) =>
    ({ color, at, length: d, width: d, layer }) as const;
  const across = Math.min(f.length, f.width);
  switch (f.kind) {
    case 'usb': {
      const [length, width] = [fit(8.4, f.length, 1), fit(2.6, f.width, 0.6)];
      return [
        { color: 'dark', at: 0, length, width, layer: 0 },
        { color: 'metal', at: 0, length: length * 0.78, width: width * 0.3, layer: 1 },
      ];
    }
    case 'jack':
      return [round('dark', 0, fit(3.5, across, 0.6))];
    case 'mic':
      return [round('dark', 0, fit(1, across, 0.4))];
    case 'speaker': {
      const d = fit(1.2, f.width, 0.8);
      const pitch = d * 1.7;
      const count = Math.max(1, Math.floor((f.length - 1.5 - d) / pitch) + 1);
      const first = (-(count - 1) * pitch) / 2;
      return Array.from({ length: count }, (_, i) => round('dark', first + i * pitch, d));
    }
    case 'sim':
      return [
        { color: 'metal', at: 0, length: f.length, width: f.width, layer: 0 },
        round('dark', f.length / 2 - Math.min(2, f.length / 4), 0.9, 1),
      ];
    case 'button':
      return [
        {
          color: 'metal',
          at: 0,
          length: fit(f.length, f.length, 2),
          width: fit(f.width, f.width, 1),
          layer: 0,
        },
      ];
  }
}

export function featureDepthAt(feature: SideFeature, spec: PhoneSpec): number {
  return feature.depthAt ?? spec.body.depth / 2;
}

export function unrolledSideOffsetMm(spec: PhoneSpec, depthAt: number): number {
  const r = caseEdgeRadius(spec.caseWall);
  return (Math.PI / 2) * r - r + spec.caseWall + depthAt;
}

export interface ZoneRectMm {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function sideFeatureRectMm(
  feature: SideFeature,
  spec: PhoneSpec,
  zone: PrintZone,
): ZoneRectMm {
  const off = zone.bleedMm + zone.wrapMm;
  const d = unrolledSideOffsetMm(spec, featureDepthAt(feature, spec));
  const along = off + feature.at - feature.length / 2;
  const across = feature.width / 2;
  switch (feature.side) {
    case 'top':
      return { x: along, y: off - d - across, w: feature.length, h: feature.width };
    case 'bottom':
      return {
        x: along,
        y: off + zone.caseHeightMm + d - across,
        w: feature.length,
        h: feature.width,
      };
    case 'left':
      return { x: off - d - across, y: along, w: feature.width, h: feature.length };
    case 'right':
      return {
        x: off + zone.caseWidthMm + d - across,
        y: along,
        w: feature.width,
        h: feature.length,
      };
  }
}

export function sideFeatureMarkerMm(
  feature: SideFeature,
  zone: PrintZone,
  gapMm: number,
  thicknessMm: number,
): ZoneRectMm {
  const off = zone.bleedMm + zone.wrapMm;
  const along = off + feature.at - feature.length / 2;
  const out = gapMm + thicknessMm;
  switch (feature.side) {
    case 'top':
      return { x: along, y: off - out, w: feature.length, h: thicknessMm };
    case 'bottom':
      return { x: along, y: off + zone.caseHeightMm + gapMm, w: feature.length, h: thicknessMm };
    case 'left':
      return { x: off - out, y: along, w: thicknessMm, h: feature.length };
    case 'right':
      return { x: off + zone.caseWidthMm + gapMm, y: along, w: thicknessMm, h: feature.length };
  }
}
