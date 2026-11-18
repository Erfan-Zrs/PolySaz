import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { CaseColor } from '../../../core/models/phone-spec.model';

export const PHONE_COLORS = {
  body: 0x4a4e57,
  dark: 0x0d0e11,
  metal: 0x9aa0a8,
  glass: 0x05060a,
  lensCore: 0x1c2740,
  flash: 0xf2e6c8,
} as const;

export const LENS_SHARES = { glass: 0.8, core: 0.35 } as const;

export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export const FLAT_CASE_COLORS: Record<CaseColor, string> = {
  clear: cssColor(PHONE_COLORS.body),
  black: '#1b1c1f',
  white: '#f1f1ee',
};

export interface CaseMaterialSet {
  readonly case: Record<CaseColor, MeshPhysicalMaterial>;
  readonly phoneBody: MeshStandardMaterial;
  readonly cameraIsland: MeshStandardMaterial;
  readonly phoneMetal: MeshStandardMaterial;
  readonly lensGlass: MeshStandardMaterial;
  readonly lensCore: MeshStandardMaterial;
  readonly flash: MeshStandardMaterial;
  readonly print: MeshStandardMaterial;
}

export function createCaseMaterials(): CaseMaterialSet {
  return {
    case: {
      clear: new MeshPhysicalMaterial({
        color: new Color(0xffffff),
        metalness: 0,
        roughness: 0.12,
        transmission: 0.95,
        thickness: 1.5,
        ior: 1.5,
        side: DoubleSide,
      }),
      black: new MeshPhysicalMaterial({
        color: new Color(0x1b1c1f),
        roughness: 0.55,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      }),
      white: new MeshPhysicalMaterial({
        color: new Color(0xf1f1ee),
        roughness: 0.5,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      }),
    },
    phoneBody: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.body),
      metalness: 0.35,
      roughness: 0.38,
    }),
    cameraIsland: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.dark),
      metalness: 0.2,
      roughness: 0.25,
    }),
    phoneMetal: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.metal),
      metalness: 0.85,
      roughness: 0.3,
    }),
    lensGlass: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.glass),
      metalness: 0.5,
      roughness: 0.05,
    }),
    lensCore: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.lensCore),
      metalness: 0.6,
      roughness: 0.1,
    }),
    flash: new MeshStandardMaterial({
      color: new Color(PHONE_COLORS.flash),
      roughness: 0.35,
    }),
    print: new MeshStandardMaterial({
      color: new Color(0xffffff),
      roughness: 0.45,
      metalness: 0,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  };
}

export function disposeCaseMaterials(set: CaseMaterialSet): void {
  Object.values(set.case).forEach((m) => m.dispose());
  set.phoneBody.dispose();
  set.cameraIsland.dispose();
  set.phoneMetal.dispose();
  set.lensGlass.dispose();
  set.lensCore.dispose();
  set.flash.dispose();
  set.print.dispose();
}
