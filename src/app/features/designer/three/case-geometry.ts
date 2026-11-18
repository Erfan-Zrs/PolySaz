import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Path,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import {
  CameraCutout,
  CameraLens,
  CaseSide,
  PhoneSpec,
  SideFeature,
} from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { caseEdgeRadius, RIM_LIP_MM } from '../../../core/utils/print-zone';
import {
  featureDepthAt,
  phoneSideParts,
  sideFeatures,
  unrolledSideOffsetMm,
} from '../../../core/utils/side-features';
import { LENS_SHARES } from './case-materials';

const PRINT_LAYER_OFFSET_MM = 0.02;
const PHONE_GAP_MM = 0.1;
const BUTTON_COVER_MM = 0.6;
const BUTTON_COVER_BEVEL_MM = 0.3;
const ISLAND_BELOW_FACE_MM = 0.3;

export interface CaseDimensions {
  readonly outerWidth: number;
  readonly outerHeight: number;
  readonly outerRadius: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly innerRadius: number;
  readonly wall: number;
  readonly depth: number;
  readonly bevel: number;
}

export interface CaseGeometries {
  readonly zone: PrintZone;
  readonly dims: CaseDimensions;
  readonly backPlate: BufferGeometry;
  readonly rim: BufferGeometry;
  readonly printLayer: BufferGeometry;
  readonly sidePrintBand: BufferGeometry | null;
  readonly phoneBody: BufferGeometry;
  readonly cameraIslands: readonly BufferGeometry[];
  readonly buttonCovers: BufferGeometry | null;
  readonly phoneDetails: PhoneDetailGeometries;
}

export interface PhoneDetailGeometries {
  readonly dark: BufferGeometry | null;
  readonly metal: BufferGeometry | null;
  readonly glass: BufferGeometry | null;
  readonly lensCore: BufferGeometry | null;
  readonly flash: BufferGeometry | null;
}

export interface GeometryQuality {
  readonly curveSegments: number;
  readonly bevelSegments: number;
}

export const DEFAULT_QUALITY: GeometryQuality = { curveSegments: 16, bevelSegments: 3 };

export function caseDimensions(spec: PhoneSpec): CaseDimensions {
  const wall = spec.caseWall;
  return {
    outerWidth: spec.body.width + 2 * wall,
    outerHeight: spec.body.height + 2 * wall,
    outerRadius: spec.body.cornerRadius + wall,
    innerWidth: spec.body.width,
    innerHeight: spec.body.height,
    innerRadius: spec.body.cornerRadius,
    wall,
    depth: spec.body.depth,
    bevel: caseEdgeRadius(wall),
  };
}

export function roundedRect(
  path: Path,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Path {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) {
    path.moveTo(x, y);
    path.lineTo(x + w, y);
    path.lineTo(x + w, y + h);
    path.lineTo(x, y + h);
    path.lineTo(x, y);
    return path;
  }
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - rr);
  path.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x + rr, y + h);
  path.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + rr);
  path.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return path;
}

export function outlineShape(width: number, height: number, radius: number, inset = 0): Shape {
  const w = width - 2 * inset;
  const h = height - 2 * inset;
  return roundedRect(new Shape(), -w / 2, -h / 2, w, h, radius - inset) as Shape;
}

export function cutoutBounds(cutout: CameraCutout, dims: CaseDimensions, grow = 0) {
  const left = -dims.outerWidth / 2 + cutout.x - grow;
  const top = dims.outerHeight / 2 - cutout.y + grow;
  const w = cutout.w + 2 * grow;
  const h = cutout.h + 2 * grow;
  return { left, bottom: top - h, w, h };
}

export function cutoutPath(cutout: CameraCutout, dims: CaseDimensions, grow = 0): Path {
  const { left, bottom, w, h } = cutoutBounds(cutout, dims, grow);
  const path = new Path();
  switch (cutout.shape) {
    case 'circle': {
      const r = Math.min(w, h) / 2;
      path.absarc(left + w / 2, bottom + h / 2, r, 0, Math.PI * 2, false);
      return path;
    }
    case 'pill':
      return roundedRect(path, left, bottom, w, h, Math.min(w, h) / 2);
    case 'rect':
      return roundedRect(path, left, bottom, w, h, (cutout.r ?? 2) + grow);
  }
}

export function backUv(x: number, y: number, zone: PrintZone): [number, number] {
  return [(x + zone.widthMm / 2) / zone.widthMm, (y + zone.heightMm / 2) / zone.heightMm];
}

export function applyPrintZoneUvs(geometry: BufferGeometry, zone: PrintZone): void {
  const pos = geometry.getAttribute('position');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [u, v] = backUv(pos.getX(i), pos.getY(i), zone);
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

const SIDE_NORMALS: Record<CaseSide, readonly [number, number]> = {
  top: [0, 1],
  bottom: [0, -1],
  left: [-1, 0],
  right: [1, 0],
};

export function sideFeatureMatrix(
  feature: SideFeature,
  spec: PhoneSpec,
  dims: CaseDimensions,
  out = 0,
): Matrix4 {
  const [nx, ny] = SIDE_NORMALS[feature.side];
  const [hw, hh] = [dims.outerWidth / 2, dims.outerHeight / 2];
  const [x, y] = nx === 0 ? [-hw + feature.at, ny * hh] : [nx * hw, hh - feature.at];
  const z = -dims.bevel - featureDepthAt(feature, spec);
  return new Matrix4()
    .makeBasis(new Vector3(-ny, nx, 0), new Vector3(0, 0, 1), new Vector3(nx, ny, 0))
    .setPosition(x + nx * out, y + ny * out, z);
}

export function sideUv(
  x: number,
  y: number,
  z: number,
  side: CaseSide,
  spec: PhoneSpec,
  dims: CaseDimensions,
  zone: PrintZone,
): [number, number] {
  const d = unrolledSideOffsetMm(spec, -z - dims.bevel);
  const [nx, ny] = SIDE_NORMALS[side];
  return nx === 0
    ? backUv(x, ny * (dims.outerHeight / 2 + d), zone)
    : backUv(nx * (dims.outerWidth / 2 + d), y, zone);
}

function pillShape(length: number, width: number): Shape {
  const r = Math.min(length, width) / 2;
  return roundedRect(new Shape(), -length / 2, -width / 2, length, width, r) as Shape;
}

function sidePart(
  shape: Shape,
  thickness: number,
  matrix: Matrix4,
  curveSegments: number,
): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments,
  });
  return geometry.applyMatrix4(matrix);
}

interface LensParts {
  readonly metal: BufferGeometry[];
  readonly glass: BufferGeometry[];
  readonly lensCore: BufferGeometry[];
  readonly flash: BufferGeometry[];
}

function lensParts(lens: CameraLens, dims: CaseDimensions, segments: number): LensParts {
  const x = -dims.outerWidth / 2 + lens.x;
  const y = dims.outerHeight / 2 - lens.y;
  const base = dims.wall - ISLAND_BELOW_FACE_MM - 0.1;
  const disc = (k: number, top: number) =>
    new CylinderGeometry((lens.d / 2) * k, (lens.d / 2) * k, top + 0.1, segments)
      .rotateX(Math.PI / 2)
      .translate(x, y, base + (top + 0.1) / 2);
  switch (lens.kind) {
    case 'lens':
      return {
        metal: [disc(1, 0.15)],
        glass: [disc(LENS_SHARES.glass, 0.2)],
        lensCore: [disc(LENS_SHARES.core, 0.22)],
        flash: [],
      };
    case 'flash':
      return {
        metal: [disc(1, 0.05)],
        glass: [],
        lensCore: [],
        flash: [disc(LENS_SHARES.glass, 0.1)],
      };
    case 'sensor':
      return { metal: [], glass: [disc(1, 0.1)], lensCore: [], flash: [] };
  }
}

function mergeParts(parts: BufferGeometry[]): BufferGeometry | null {
  if (parts.length === 0) return null;
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(flat);
  new Set([...parts, ...flat]).forEach((p) => p.dispose());
  return merged;
}

function subtract(target: BufferGeometry, cutter: BufferGeometry): BufferGeometry {
  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];
  evaluator.useGroups = false;
  const result = evaluator.evaluate(new Brush(target), new Brush(cutter), SUBTRACTION);
  target.dispose();
  return result.geometry;
}

export function buildSidePrintBand(
  dims: CaseDimensions,
  zone: PrintZone,
  quality: GeometryQuality = DEFAULT_QUALITY,
): BufferGeometry {
  const r = dims.outerRadius;
  const bt = dims.bevel;
  const rimDepth = dims.depth + RIM_LIP_MM;

  const outline: { x: number; y: number; nx: number; ny: number }[] = [];
  const arcSegments = quality.curveSegments * 2;
  const [cx, cy] = [dims.outerWidth / 2 - r, dims.outerHeight / 2 - r];
  const corners = [
    [cx, -cy],
    [cx, cy],
    [-cx, cy],
    [-cx, -cy],
  ];
  corners.forEach(([ox, oy], c) => {
    for (let k = 0; k <= arcSegments; k++) {
      const a = ((c - 1) * Math.PI) / 2 + (k / arcSegments) * (Math.PI / 2);
      const [nx, ny] = [Math.cos(a), Math.sin(a)];
      outline.push({ x: ox + r * nx, y: oy + r * ny, nx, ny });
    }
  });

  const profile: { off: number; z: number; no: number; nz: number; s: number }[] = [];
  const quarter = (Math.PI / 2) * bt;
  for (let k = 0; k <= quality.bevelSegments; k++) {
    const t = ((k / quality.bevelSegments) * Math.PI) / 2;
    const [sin, cos] = [Math.sin(t), Math.cos(t)];
    profile.push({
      off: -bt + bt * sin,
      z: dims.wall - bt + bt * cos,
      no: sin,
      nz: cos,
      s: t * bt,
    });
  }
  const wallLength = dims.wall - bt + rimDepth;
  for (let k = 0; k <= quality.bevelSegments; k++) {
    const t = ((k / quality.bevelSegments) * Math.PI) / 2;
    const [sin, cos] = [Math.sin(t), Math.cos(t)];
    profile.push({
      off: -bt + bt * cos,
      z: -rimDepth - bt * sin,
      no: cos,
      nz: -sin,
      s: quarter + wallLength + t * bt,
    });
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const o of outline) {
    for (const p of profile) {
      const out = p.off + PRINT_LAYER_OFFSET_MM * p.no;
      positions.push(o.x + o.nx * out, o.y + o.ny * out, p.z + PRINT_LAYER_OFFSET_MM * p.nz);
      normals.push(o.nx * p.no, o.ny * p.no, p.nz);
      uvs.push(...backUv(o.x + o.nx * (p.s - bt), o.y + o.ny * (p.s - bt), zone));
    }
  }

  const rows = profile.length;
  const index: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const next = (i + 1) % outline.length;
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = next * rows + j;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const band = new BufferGeometry();
  band.setAttribute('position', new Float32BufferAttribute(positions, 3));
  band.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  band.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  band.setIndex(index);
  return band;
}

export function buildCaseGeometries(
  spec: PhoneSpec,
  zone: PrintZone,
  quality: GeometryQuality = DEFAULT_QUALITY,
): CaseGeometries {
  const dims = caseDimensions(spec);
  const bt = dims.bevel;
  const { curveSegments, bevelSegments } = quality;

  const plateShape = outlineShape(dims.outerWidth, dims.outerHeight, dims.outerRadius);
  plateShape.holes = spec.cameraCutouts.map((c) => cutoutPath(c, dims));
  let backPlate: BufferGeometry = new ExtrudeGeometry(plateShape, {
    depth: dims.wall - bt,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bt,
    bevelOffset: -bt,
    bevelSegments,
    curveSegments,
  });

  const rimShape = outlineShape(dims.outerWidth, dims.outerHeight, dims.outerRadius);
  rimShape.holes = [outlineShape(dims.innerWidth, dims.innerHeight, dims.innerRadius)];
  const rimDepth = dims.depth + RIM_LIP_MM;
  let rim: BufferGeometry = new ExtrudeGeometry(rimShape, {
    depth: rimDepth,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bt,
    bevelOffset: -bt,
    bevelSegments,
    curveSegments,
  });
  rim.translate(0, 0, -rimDepth);

  const holes = sideFeatures(spec, 'hole');
  if (holes.length > 0) {
    const cutter = mergeParts(
      holes.map((f) =>
        sidePart(
          pillShape(f.length, f.width),
          dims.wall + 2,
          sideFeatureMatrix(f, spec, dims, -dims.wall - 1),
          curveSegments,
        ),
      ),
    )!;
    rim = subtract(rim, cutter);
    if (holes.some((f) => featureDepthAt(f, spec) < f.width / 2)) {
      backPlate = subtract(backPlate, cutter);
    }
    cutter.dispose();
  }

  const cb = BUTTON_COVER_BEVEL_MM;
  const buttonCovers = mergeParts(
    sideFeatures(spec, 'cover').map((f) => {
      const cover = new ExtrudeGeometry(pillShape(f.length, f.width), {
        depth: BUTTON_COVER_MM + 0.4 - 2 * cb,
        bevelEnabled: true,
        bevelThickness: cb,
        bevelSize: cb,
        bevelOffset: -cb,
        bevelSegments,
        curveSegments,
      });
      cover.applyMatrix4(sideFeatureMatrix(f, spec, dims, cb - 0.4));
      const pos = cover.getAttribute('position');
      const uv = cover.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) {
        const [u, v] = sideUv(pos.getX(i), pos.getY(i), pos.getZ(i), f.side, spec, dims, zone);
        uv.setXY(i, u, v);
      }
      return cover;
    }),
  );

  const printShape = outlineShape(dims.outerWidth, dims.outerHeight, dims.outerRadius, bt);
  printShape.holes = spec.cameraCutouts.map((c) => cutoutPath(c, dims, bt));
  const printLayer = new ShapeGeometry(printShape, curveSegments);
  printLayer.translate(0, 0, dims.wall + PRINT_LAYER_OFFSET_MM);
  applyPrintZoneUvs(printLayer, zone);
  const sidePrintBand = zone.wrapMm > 0 ? buildSidePrintBand(dims, zone, quality) : null;

  const phoneBevel = Math.min(1, dims.depth / 4);
  const phoneShape = outlineShape(
    dims.innerWidth,
    dims.innerHeight,
    dims.innerRadius,
    PHONE_GAP_MM,
  );
  const phoneBody = new ExtrudeGeometry(phoneShape, {
    depth: dims.depth - PHONE_GAP_MM - 2 * phoneBevel,
    bevelEnabled: true,
    bevelThickness: phoneBevel,
    bevelSize: phoneBevel,
    bevelOffset: -phoneBevel,
    bevelSegments,
    curveSegments,
  });
  phoneBody.translate(0, 0, -bt - dims.depth + phoneBevel);

  const islandDepth = PHONE_GAP_MM + bt + dims.wall - ISLAND_BELOW_FACE_MM;
  const cameraIslands = spec.cameraCutouts.map((c) => {
    const island = new Shape(cutoutPath(c, dims, -0.4).getPoints(curveSegments));
    const geometry = new ExtrudeGeometry(island, {
      depth: islandDepth,
      bevelEnabled: false,
      curveSegments,
    });
    geometry.translate(0, 0, -bt - PHONE_GAP_MM);
    return geometry;
  });

  const parts = {
    dark: [] as BufferGeometry[],
    metal: [] as BufferGeometry[],
    glass: [] as BufferGeometry[],
    lensCore: [] as BufferGeometry[],
    flash: [] as BufferGeometry[],
  };
  for (const lens of spec.cameraLenses ?? []) {
    const p = lensParts(lens, dims, curveSegments * 2);
    parts.metal.push(...p.metal);
    parts.glass.push(...p.glass);
    parts.lensCore.push(...p.lensCore);
    parts.flash.push(...p.flash);
  }
  for (const f of sideFeatures(spec)) {
    const onPhone = sideFeatureMatrix(f, spec, dims, -dims.wall - PHONE_GAP_MM);
    for (const part of phoneSideParts(f)) {
      const at = new Matrix4().makeTranslation(part.at, 0, 0).premultiply(onPhone);
      const thickness = part.layer === 0 ? 0.04 : 0.07;
      const shape = pillShape(part.length, part.width);
      parts[part.color].push(sidePart(shape, thickness, at, curveSegments));
    }
  }
  const phoneDetails: PhoneDetailGeometries = {
    dark: mergeParts(parts.dark),
    metal: mergeParts(parts.metal),
    glass: mergeParts(parts.glass),
    lensCore: mergeParts(parts.lensCore),
    flash: mergeParts(parts.flash),
  };

  return {
    zone,
    dims,
    backPlate,
    rim,
    printLayer,
    sidePrintBand,
    phoneBody,
    cameraIslands,
    buttonCovers,
    phoneDetails,
  };
}

export function disposeCaseGeometries(g: CaseGeometries): void {
  g.backPlate.dispose();
  g.rim.dispose();
  g.printLayer.dispose();
  g.sidePrintBand?.dispose();
  g.phoneBody.dispose();
  g.cameraIslands.forEach((i) => i.dispose());
  g.buttonCovers?.dispose();
  Object.values(g.phoneDetails).forEach((d) => d?.dispose());
}
