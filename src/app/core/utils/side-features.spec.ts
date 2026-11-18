import { PhoneSpec, SideFeature } from '../models/phone-spec.model';
import { caseEdgeRadius, computePrintZone, RIM_LIP_MM } from './print-zone';
import { phoneSideParts, sideFeatureRectMm, unrolledSideOffsetMm } from './side-features';

const USB: SideFeature = { kind: 'usb', side: 'bottom', at: 40, length: 11, width: 4 };

const SPEC: PhoneSpec = {
  id: 'test',
  brand: 'Test',
  name: 'Phone',
  verified: false,
  body: { width: 77, height: 161, cornerRadius: 9, depth: 8 },
  caseWall: 1.5,
  cameraCutouts: [],
  sideFeatures: [USB],
  printZone: { dpi: 300, bleed: 2 },
  caseColors: ['clear'],
};

describe('side features', () => {
  const zone = computePrintZone(SPEC, true);

  it('unrolls the side so the rim front edge lands one rounded edge short of the cut line', () => {
    const r = caseEdgeRadius(SPEC.caseWall);
    const front = unrolledSideOffsetMm(SPEC, SPEC.body.depth + RIM_LIP_MM - r);
    expect(front + (Math.PI / 2) * r).toBeCloseTo(zone.wrapMm, 10);
  });

  it('places a bottom feature below the back, centred along the side', () => {
    const rect = sideFeatureRectMm(USB, SPEC, zone);
    const off = zone.bleedMm + zone.wrapMm;
    const d = unrolledSideOffsetMm(SPEC, SPEC.body.depth / 2);
    expect(rect.x + rect.w / 2).toBeCloseTo(off + 40, 10);
    expect(rect.y + rect.h / 2).toBeCloseTo(off + zone.caseHeightMm + d, 10);
    expect([rect.w, rect.h]).toEqual([11, 4]);
  });

  it('turns features on the left and right sides', () => {
    const left = sideFeatureRectMm({ ...USB, side: 'left', at: 60 }, SPEC, zone);
    expect([left.w, left.h]).toEqual([4, 11]);
    expect(left.x + left.w).toBeLessThan(zone.bleedMm + zone.wrapMm);
    expect(left.y + left.h / 2).toBeCloseTo(zone.bleedMm + zone.wrapMm + 60, 10);
  });

  it('keeps the phone parts inside the case hole', () => {
    for (const kind of ['usb', 'jack', 'mic', 'speaker'] as const) {
      const f: SideFeature = { ...USB, kind };
      for (const p of phoneSideParts(f)) {
        expect(Math.abs(p.at) + p.length / 2).toBeLessThanOrEqual(f.length / 2);
        expect(p.width).toBeLessThanOrEqual(f.width);
      }
    }
  });
});
