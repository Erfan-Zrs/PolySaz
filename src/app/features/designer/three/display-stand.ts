import {
  BufferGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  Vector2,
} from 'three';
import { CaseDimensions } from './case-geometry';

const HEIGHT = 6;
const EDGE_RADIUS = 2;
const CASE_LIFT_MM = 0.6;
const RADIUS_SHARE = 0.95;
const SEGMENTS = 96;

export interface DisplayStand {
  readonly group: Group;
  readonly heightBelowCase: number;
  readonly width: number;
  dispose(): void;
}

export function createDisplayStand(dims: CaseDimensions): DisplayStand {
  const radius = dims.outerWidth * RADIUS_SHARE;
  const puck = new LatheGeometry(puckProfile(radius), SEGMENTS);
  const inlayRadius = radius - EDGE_RADIUS - 3;
  const inlay = new CylinderGeometry(inlayRadius, inlayRadius, 0.4, SEGMENTS);
  inlay.translate(0, HEIGHT + 0.05, 0);

  const aluminium = new MeshPhysicalMaterial({
    color: 0xe4e7eb,
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 2.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.35,
  });
  const rubber = new MeshPhysicalMaterial({ color: 0x1f2124, metalness: 0, roughness: 0.75 });

  const puckMesh = new Mesh(puck, aluminium);
  const inlayMesh = new Mesh(inlay, rubber);
  puckMesh.receiveShadow = inlayMesh.receiveShadow = true;
  puckMesh.castShadow = true;

  const group = new Group();
  group.add(puckMesh, inlayMesh);
  group.position.set(0, -dims.outerHeight / 2 - CASE_LIFT_MM - HEIGHT, -dims.depth / 2);

  const geometries: BufferGeometry[] = [puck, inlay];
  return {
    group,
    heightBelowCase: HEIGHT + CASE_LIFT_MM,
    width: radius * 2,
    dispose() {
      geometries.forEach((g) => g.dispose());
      aluminium.dispose();
      rubber.dispose();
    },
  };
}

function puckProfile(radius: number): Vector2[] {
  const points = [new Vector2(0, 0), new Vector2(radius - 1, 0), new Vector2(radius, 1)];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    points.push(
      new Vector2(
        radius - EDGE_RADIUS + Math.cos(a) * EDGE_RADIUS,
        HEIGHT - EDGE_RADIUS + Math.sin(a) * EDGE_RADIUS,
      ),
    );
  }
  points.push(new Vector2(0, HEIGHT));
  return points;
}
