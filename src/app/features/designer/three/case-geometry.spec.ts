import { Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { PhoneSpec } from '../../../core/models/phone-spec.model';
import { computePrintZone } from '../../../core/utils/print-zone';
import { sideFeatureRectMm } from '../../../core/utils/side-features';
import { backUv, buildCaseGeometries, caseDimensions, cutoutBounds } from './case-geometry';

const SPEC: PhoneSpec = {
  id: 'test',
  brand: 'Test',
  name: 'Phone',
  verified: false,
  body: { width: 70, height: 150, cornerRadius: 9, depth: 8 },
  caseWall: 1.5,
  cameraCutouts: [
    { shape: 'pill', x: 8, y: 8, w: 22, h: 48 },
    { shape: 'circle', x: 40, y: 10, w: 10, h: 10 },
  ],
  printZone: { dpi: 300, bleed: 2 },
  caseColors: ['clear'],
};

describe('case geometry', () => {
  const g = buildCaseGeometries(SPEC, computePrintZone(SPEC));
  const zone = g.zone;

  it('maps the print zone corners to UV 0 and 1', () => {
    expect(backUv(-zone.widthMm / 2, -zone.heightMm / 2, zone)).toEqual([0, 0]);
    expect(backUv(zone.widthMm / 2, zone.heightMm / 2, zone)).toEqual([1, 1]);
    expect(backUv(0, 0, zone)).toEqual([0.5, 0.5]);
  });

  it('puts the cut line at bleed / size in UV space', () => {
    const [u, v] = backUv(-zone.caseWidthMm / 2, zone.caseHeightMm / 2, zone);
    expect(u).toBeCloseTo(2 / 77, 10);
    expect(v).toBeCloseTo(1 - 2 / 157, 10);
  });

  it('keeps print-layer UVs inside the cut line', () => {
    const uv = g.printLayer.getAttribute('uv');
    let minU = 1,
      maxU = 0,
      minV = 1,
      maxV = 0;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    expect(minU).toBeGreaterThanOrEqual(2 / 77 - 1e-9);
    expect(maxU).toBeLessThanOrEqual(1 - 2 / 77 + 1e-9);
    expect(minV).toBeGreaterThanOrEqual(2 / 157 - 1e-9);
    expect(maxV).toBeLessThanOrEqual(1 - 2 / 157 + 1e-9);
  });

  it('builds the back plate at the exact outer size and wall thickness', () => {
    const box = new Box3().setFromBufferAttribute(g.backPlate.getAttribute('position') as never);
    expect(box.max.x - box.min.x).toBeCloseTo(73, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(153, 5);
    expect(box.max.z).toBeCloseTo(SPEC.caseWall, 5);
  });

  it('converts top-left spec coordinates to case space (y up)', () => {
    const dims = caseDimensions(SPEC);
    const b = cutoutBounds(SPEC.cameraCutouts[0], dims);
    expect(b.left).toBeCloseTo(-36.5 + 8, 10);
    expect(b.bottom + b.h).toBeCloseTo(76.5 - 8, 10);
  });

  it('makes one camera island per cutout', () => {
    expect(g.cameraIslands.length).toBe(2);
  });

  it('has no side print band unless the zone wraps', () => {
    expect(g.sidePrintBand).toBeNull();
  });
});

describe('wrapped case geometry', () => {
  const zone = computePrintZone(SPEC, true);
  const g = buildCaseGeometries(SPEC, zone);
  const band = g.sidePrintBand!;

  function flatOffset(u: number, v: number): number {
    const x = u * zone.widthMm - zone.widthMm / 2;
    const y = v * zone.heightMm - zone.heightMm / 2;
    const r = g.dims.outerRadius;
    const qx = Math.max(-(g.dims.outerWidth / 2 - r), Math.min(g.dims.outerWidth / 2 - r, x));
    const qy = Math.max(-(g.dims.outerHeight / 2 - r), Math.min(g.dims.outerHeight / 2 - r, y));
    return Math.hypot(x - qx, y - qy) - r;
  }

  it('builds a side print band', () => {
    expect(band).not.toBeNull();
    expect(band.getIndex()!.count).toBeGreaterThan(0);
  });

  it('starts the band where the back print layer ends and stops at the cut line', () => {
    const uv = band.getAttribute('uv');
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      const d = flatOffset(uv.getX(i), uv.getY(i));
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    expect(min).toBeCloseTo(-g.dims.bevel, 3);
    expect(max).toBeCloseTo(zone.wrapMm, 3);
  });

  it('keeps all band UVs inside the bleed', () => {
    const uv = band.getAttribute('uv');
    const [bu, bv] = [zone.bleedMm / zone.widthMm, zone.bleedMm / zone.heightMm];
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(bu - 1e-6);
      expect(uv.getX(i)).toBeLessThanOrEqual(1 - bu + 1e-6);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(bv - 1e-6);
      expect(uv.getY(i)).toBeLessThanOrEqual(1 - bv + 1e-6);
    }
  });

  it('wraps the band just outside the case, from the back face to the front edge', () => {
    const box = new Box3().setFromBufferAttribute(band.getAttribute('position') as never);
    expect(box.max.x - box.min.x).toBeCloseTo(g.dims.outerWidth + 0.04, 2);
    expect(box.max.z).toBeCloseTo(SPEC.caseWall + 0.02, 5);
    expect(box.min.z).toBeLessThan(-SPEC.body.depth);
  });
});

describe('case geometry with phone details', () => {
  const DETAILED: PhoneSpec = {
    ...SPEC,
    cameraLenses: [
      { kind: 'lens', x: 19, y: 19, d: 12 },
      { kind: 'flash', x: 45, y: 15, d: 4 },
    ],
    sideFeatures: [
      { kind: 'usb', side: 'bottom', at: 36.5, length: 11, width: 4 },
      { kind: 'button', side: 'left', at: 40, length: 20, width: 4.5 },
    ],
  };
  const zone = computePrintZone(DETAILED, true);
  const g = buildCaseGeometries(DETAILED, zone);
  const dims = g.dims;
  const usb = DETAILED.sideFeatures![0];

  function rimHitAt(x: number): boolean {
    const rim = new Mesh(g.rim, new MeshBasicMaterial({ side: DoubleSide }));
    const z = -dims.bevel - DETAILED.body.depth / 2;
    const ray = new Raycaster(new Vector3(x, -dims.outerHeight / 2 - 5, z), new Vector3(0, 1, 0));
    ray.far = 7;
    return ray.intersectObject(rim).length > 0;
  }

  it('cuts a hole through the rim for the USB port, and only there', () => {
    expect(rimHitAt(-dims.outerWidth / 2 + usb.at)).toBe(false);
    expect(rimHitAt(-dims.outerWidth / 2 + usb.at + 10)).toBe(true);
  });

  it('builds a raised cover for the button, standing out of the left side', () => {
    const box = new Box3().setFromBufferAttribute(
      g.buttonCovers!.getAttribute('position') as never,
    );
    expect(box.min.x).toBeCloseTo(-dims.outerWidth / 2 - 0.6, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(20, 5);
  });

  it('maps the button cover onto its unrolled rect in the print zone', () => {
    const uv = g.buttonCovers!.getAttribute('uv');
    const rect = sideFeatureRectMm(DETAILED.sideFeatures![1], DETAILED, zone);
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < uv.count; i++) {
      const y = (1 - uv.getY(i)) * zone.heightMm;
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
    }
    expect(minY).toBeCloseTo(rect.y, 3);
    expect(maxY).toBeCloseTo(rect.y + rect.h, 3);
  });

  it('builds lens and port details per material', () => {
    expect(g.phoneDetails.glass).not.toBeNull();
    expect(g.phoneDetails.flash).not.toBeNull();
    expect(g.phoneDetails.dark).not.toBeNull();
    expect(g.phoneDetails.metal).not.toBeNull();
    expect(g.phoneDetails.lensCore).not.toBeNull();
  });
});
