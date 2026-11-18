export type ShapeId =
  | 'line'
  | 'square'
  | 'rounded'
  | 'circle'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'hexagon'
  | 'star'
  | 'heart'
  | 'arrow';

export interface ShapeDef {
  readonly id: ShapeId;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly line: boolean;
  readonly join: 'miter' | 'round';
}

const K = 0.5523;

function polygon(points: readonly (readonly [number, number])[]): string {
  return `${points.map(([x, y], i) => `${i ? 'L' : 'M'} ${round(x)} ${round(y)}`).join(' ')} Z`;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function radial(count: number, radii: readonly number[]): [number, number][] {
  return Array.from({ length: count * radii.length }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / (count * radii.length);
    const r = radii[i % radii.length];
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });
}

function toOrigin(points: [number, number][]): [number, number][] {
  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  return points.map(([x, y]) => [x - minX, y - minY]);
}

function size(points: [number, number][]): { width: number; height: number } {
  return {
    width: round(Math.max(...points.map(([x]) => x))),
    height: round(Math.max(...points.map(([, y]) => y))),
  };
}

function polygonShape(id: ShapeId, points: [number, number][], join: ShapeDef['join']): ShapeDef {
  const p = toOrigin(points);
  return { id, path: polygon(p), ...size(p), line: false, join };
}

const R = 20;
const c = R * K;

export const SHAPES: readonly ShapeDef[] = [
  { id: 'line', path: 'M 0 0 L 100 0', width: 100, height: 0, line: true, join: 'round' },
  polygonShape(
    'square',
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    'miter',
  ),
  {
    id: 'rounded',
    path:
      `M ${R} 0 L ${100 - R} 0 C ${100 - R + c} 0 100 ${R - c} 100 ${R} ` +
      `L 100 ${100 - R} C 100 ${100 - R + c} ${100 - R + c} 100 ${100 - R} 100 ` +
      `L ${R} 100 C ${R - c} 100 0 ${100 - R + c} 0 ${100 - R} ` +
      `L 0 ${R} C 0 ${R - c} ${R - c} 0 ${R} 0 Z`,
    width: 100,
    height: 100,
    line: false,
    join: 'round',
  },
  {
    id: 'circle',
    path:
      'M 50 0 C 77.62 0 100 22.38 100 50 C 100 77.62 77.62 100 50 100 ' +
      'C 22.38 100 0 77.62 0 50 C 0 22.38 22.38 0 50 0 Z',
    width: 100,
    height: 100,
    line: false,
    join: 'round',
  },
  polygonShape(
    'triangle',
    [
      [50, 0],
      [100, 86.6],
      [0, 86.6],
    ],
    'round',
  ),
  polygonShape(
    'rightTriangle',
    [
      [0, 0],
      [100, 100],
      [0, 100],
    ],
    'round',
  ),
  polygonShape(
    'diamond',
    [
      [50, 0],
      [100, 50],
      [50, 100],
      [0, 50],
    ],
    'miter',
  ),
  polygonShape('hexagon', radial(6, [50]), 'miter'),
  polygonShape('star', radial(5, [50, 19.1]), 'round'),
  {
    id: 'heart',
    path:
      'M 50 90 C 20 70 0 52 0 30 C 0 13 13 0 28 0 C 38 0 46 6 50 15 ' +
      'C 54 6 62 0 72 0 C 87 0 100 13 100 30 C 100 52 80 70 50 90 Z',
    width: 100,
    height: 90,
    line: false,
    join: 'round',
  },
  polygonShape(
    'arrow',
    [
      [0, 35],
      [60, 35],
      [60, 10],
      [100, 50],
      [60, 90],
      [60, 65],
      [0, 65],
    ],
    'miter',
  ),
];

export function shapeById(id: ShapeId): ShapeDef {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}
