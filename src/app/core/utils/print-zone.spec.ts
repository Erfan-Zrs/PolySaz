import { PhoneSpec } from '../models/phone-spec.model';
import { computePrintZone, mmToPx, previewCanvasSize, RIM_LIP_MM } from './print-zone';

const A55: PhoneSpec = {
  id: 'samsung-galaxy-a55',
  brand: 'Samsung',
  name: 'Galaxy A55',
  verified: false,
  body: { width: 77.4, height: 161.1, cornerRadius: 9, depth: 8.2 },
  caseWall: 1.5,
  cameraCutouts: [{ shape: 'pill', x: 8, y: 8, w: 22, h: 48, r: 11 }],
  printZone: { dpi: 300, bleed: 2 },
  caseColors: ['clear', 'black', 'white'],
};

describe('print zone math', () => {
  it('converts mm to px at 300 DPI', () => {
    expect(mmToPx(25.4, 300)).toBe(300);
    expect(mmToPx(10, 300)).toBe(118);
    expect(mmToPx(0, 300)).toBe(0);
  });

  it('adds 2 × wall to the body and 2 × bleed to the case back', () => {
    const z = computePrintZone(A55);
    expect(z.caseWidthMm).toBeCloseTo(80.4, 10);
    expect(z.caseHeightMm).toBeCloseTo(164.1, 10);
    expect(z.widthMm).toBeCloseTo(84.4, 10);
    expect(z.heightMm).toBeCloseTo(168.1, 10);
  });

  it('gives the exact print pixel size: px = round(mm / 25.4 × 300)', () => {
    const z = computePrintZone(A55);
    expect(z.widthPx).toBe(997);
    expect(z.heightPx).toBe(1985);
    expect(z.dpi).toBe(300);
  });

  it('scales the preview canvas to the long side, keeping aspect ratio', () => {
    const z = computePrintZone(A55);
    const mobile = previewCanvasSize(z, 1024);
    expect(mobile.height).toBe(1024);
    expect(mobile.width).toBe(Math.round((84.4 / 168.1) * 1024));
    expect(previewCanvasSize(z, 2048).height).toBe(2048);
  });

  it('adds the unrolled sides around the back when wrapping', () => {
    const z = computePrintZone(A55, true);
    const wrap = 1.5 + 8.2 + RIM_LIP_MM + 0.6 * (Math.PI - 2);
    expect(z.wrapMm).toBeCloseTo(wrap, 10);
    expect(z.caseWidthMm).toBeCloseTo(80.4, 10);
    expect(z.widthMm).toBeCloseTo(80.4 + 2 * (wrap + 2), 10);
    expect(z.heightMm).toBeCloseTo(164.1 + 2 * (wrap + 2), 10);
    expect(computePrintZone(A55).wrapMm).toBe(0);
  });
});
