export interface PhoneSpec {
  readonly id: string;
  readonly brand: string;
  readonly name: string;
  readonly verified: boolean;
  readonly body: PhoneBody;
  readonly caseWall: number;
  readonly cameraCutouts: readonly CameraCutout[];
  readonly cameraLenses?: readonly CameraLens[];
  readonly sideFeatures?: readonly SideFeature[];
  readonly printZone: PrintZoneConfig;
  readonly caseColors: readonly CaseColor[];
}

export interface PhoneBody {
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
  readonly depth: number;
}

export type CutoutShape = 'pill' | 'rect' | 'circle';

export interface CameraCutout {
  readonly shape: CutoutShape;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly r?: number;
}

export type CameraLensKind = 'lens' | 'flash' | 'sensor';

export interface CameraLens {
  readonly kind: CameraLensKind;
  readonly x: number;
  readonly y: number;
  readonly d: number;
}

export type CaseSide = 'top' | 'bottom' | 'left' | 'right';

export type SideFeatureKind = 'button' | 'usb' | 'jack' | 'speaker' | 'mic' | 'sim';

export interface SideFeature {
  readonly kind: SideFeatureKind;
  readonly side: CaseSide;
  readonly at: number;
  readonly length: number;
  readonly width: number;
  readonly depthAt?: number;
}

export interface PrintZoneConfig {
  readonly dpi: number;
  readonly bleed: number;
}

export type CaseColor = 'clear' | 'black' | 'white';
