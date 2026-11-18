import { DestroyRef, effect, inject, Injectable, NgZone, signal } from '@angular/core';
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Texture,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CaseColor, PhoneSpec } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { SCENE_THEMES, SceneTheme } from '../../../core/theme/scene-theme';
import { ThemeService } from '../../../core/theme/theme.service';
import {
  buildCaseGeometries,
  CaseGeometries,
  DEFAULT_QUALITY,
  disposeCaseGeometries,
  GeometryQuality,
} from './case-geometry';
import { CaseMaterialSet, createCaseMaterials, disposeCaseMaterials } from './case-materials';
import { createDisplayStand, DisplayStand } from './display-stand';

const FOV = 30;
const CAMERA_NEAR = 10;
const CAMERA_FAR = 3000;
const DRAG_DAMPING = 0.92;

export interface SceneOptions {
  readonly background: 'theme' | 'transparent';
  readonly controls: 'orbit' | 'turntable';
  readonly stand?: boolean;
}

const DEFAULT_OPTIONS: SceneOptions = { background: 'theme', controls: 'orbit' };

@Injectable()
export class SceneService {
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);

  readonly webglAvailable = signal(true);
  readonly ready = signal(false);

  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private controls?: OrbitControls;
  private resizeObserver?: ResizeObserver;
  private readonly scene = new Scene();
  private readonly caseGroup = new Group();
  private readonly casePivot = new Group();
  private readonly materials: CaseMaterialSet = createCaseMaterials();
  private readonly shadowCatcher = new Mesh(
    new PlaneGeometry(1000, 1000),
    new ShadowMaterial({ opacity: 0.2 }),
  );
  private geometries?: CaseGeometries;
  private stand?: DisplayStand;
  private meshes?: {
    plate: Mesh;
    rim: Mesh;
    prints: Mesh[];
    phone: Mesh;
    islands: Mesh[];
    covers: Mesh | null;
  };
  private specId?: string;
  private caseColor: CaseColor = 'clear';
  private frameQueued = false;
  private quality: GeometryQuality = DEFAULT_QUALITY;
  private options = DEFAULT_OPTIONS;
  private baseRotation = { x: 0, y: 0 };
  private dragYaw = 0;
  private dragVelocity = 0;
  private dragPointer: number | null = null;
  private dragLastX = 0;
  private inertiaFrame = 0;

  constructor() {
    effect(() => this.applySceneTheme(SCENE_THEMES[this.theme.resolved()]));
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  init(host: HTMLElement, options: SceneOptions = DEFAULT_OPTIONS): boolean {
    this.options = options;
    const transparent = options.background === 'transparent';
    const turntable = options.controls === 'turntable';
    return this.zone.runOutsideAngular(() => {
      let renderer: WebGLRenderer;
      try {
        renderer = new WebGLRenderer({
          antialias: true,
          alpha: transparent,
          powerPreference: turntable ? 'default' : 'high-performance',
        });
      } catch {
        this.webglAvailable.set(false);
        return false;
      }
      this.renderer = renderer;
      const isSmallScreen = Math.min(screen.width, screen.height) < 768;
      if (isSmallScreen) this.quality = { curveSegments: 10, bevelSegments: 2 };

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = NeutralToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.touchAction = turntable ? 'pan-y' : 'none';
      host.appendChild(renderer.domElement);

      const pmrem = new PMREMGenerator(renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.7;
      pmrem.dispose();

      const key = new DirectionalLight(0xffffff, 1.6);
      key.position.set(120, 260, 320);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -150;
      key.shadow.camera.right = 150;
      key.shadow.camera.top = 150;
      key.shadow.camera.bottom = -150;
      key.shadow.camera.far = 1000;
      key.shadow.radius = 4;
      this.scene.add(key, new HemisphereLight(0xffffff, 0x888888, 0.6));

      this.shadowCatcher.rotation.x = -Math.PI / 2;
      this.shadowCatcher.receiveShadow = true;
      this.shadowCatcher.visible = !transparent;
      this.casePivot.add(this.caseGroup);
      this.scene.add(this.shadowCatcher, this.casePivot);

      this.camera = new PerspectiveCamera(FOV, 1, CAMERA_NEAR, CAMERA_FAR);
      if (turntable) {
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', this.onDragStart);
        canvas.addEventListener('pointermove', this.onDragMove);
        canvas.addEventListener('pointerup', this.onDragEnd);
        canvas.addEventListener('pointercancel', this.onDragEnd);
      } else {
        this.controls = new OrbitControls(this.camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.minDistance = 120;
        this.controls.maxDistance = 1200;
        this.controls.addEventListener('change', () => this.requestRender());
      }

      this.resizeObserver = new ResizeObserver(() => this.resize(host));
      this.resizeObserver.observe(host);
      this.resize(host);

      this.applySceneTheme(SCENE_THEMES[this.theme.resolved()]);
      if (this.geometries) {
        this.rebuildMeshes();
        this.frameCase();
      }
      this.zone.run(() => this.ready.set(true));
      return true;
    });
  }

  setSpec(spec: PhoneSpec, zone: PrintZone): void {
    if (this.geometries) disposeCaseGeometries(this.geometries);
    this.geometries = buildCaseGeometries(spec, zone, this.quality);
    const phoneChanged = this.specId !== spec.id;
    this.specId = spec.id;
    if (this.renderer) {
      this.rebuildMeshes();
      if (phoneChanged) this.frameCase();
    }
  }

  setCaseColor(color: CaseColor): void {
    this.caseColor = color;
    if (this.meshes) {
      const material = this.materials.case[color];
      this.meshes.plate.material = material;
      this.meshes.rim.material = material;
      if (this.meshes.covers) this.meshes.covers.material = material;
      this.requestRender();
    }
  }

  setCaseRotation(x: number, y: number): void {
    this.baseRotation = { x, y };
    this.applyCaseRotation();
  }

  relaxDrag(share: number): void {
    if (this.dragPointer !== null || this.inertiaFrame) return;
    const yaw = Math.atan2(Math.sin(this.dragYaw), Math.cos(this.dragYaw));
    if (Math.abs(yaw) < 1e-4) return;
    this.dragYaw = yaw * (1 - share);
    this.applyCaseRotation();
  }

  private applyCaseRotation(): void {
    this.casePivot.rotation.set(this.baseRotation.x, this.baseRotation.y + this.dragYaw, 0);
    this.requestRender();
  }

  private readonly onDragStart = (e: PointerEvent): void => {
    if (this.dragPointer !== null || e.button !== 0) return;
    this.dragPointer = e.pointerId;
    this.dragLastX = e.clientX;
    this.dragVelocity = 0;
    cancelAnimationFrame(this.inertiaFrame);
    this.inertiaFrame = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  private readonly onDragMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragPointer) return;
    const height = (e.currentTarget as HTMLElement).clientHeight || 1;
    const delta = ((e.clientX - this.dragLastX) / height) * Math.PI * 2;
    this.dragLastX = e.clientX;
    this.dragYaw += delta;
    this.dragVelocity = this.dragVelocity * 0.5 + delta * 0.5;
    this.applyCaseRotation();
  };

  private readonly onDragEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragPointer) return;
    this.dragPointer = null;
    this.inertiaFrame = requestAnimationFrame(this.coast);
  };

  private readonly coast = (): void => {
    this.dragVelocity *= DRAG_DAMPING;
    if (Math.abs(this.dragVelocity) < 1e-4) {
      this.inertiaFrame = 0;
      return;
    }
    this.dragYaw += this.dragVelocity;
    this.applyCaseRotation();
    this.inertiaFrame = requestAnimationFrame(this.coast);
  };

  setPrintTexture(texture: Texture | null): void {
    const material = this.materials.print;
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
    this.meshes?.prints.forEach((m) => (m.visible = texture !== null));
    this.requestRender();
  }

  requestRender(): void {
    if (this.frameQueued || !this.renderer) return;
    this.frameQueued = true;
    this.zone.runOutsideAngular(() => requestAnimationFrame(this.renderFrame));
  }

  private readonly renderFrame = () => {
    this.frameQueued = false;
    if (!this.renderer || !this.camera) return;
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private rebuildMeshes(): void {
    const g = this.geometries!;
    this.caseGroup.clear();
    const caseMaterial = this.materials.case[this.caseColor];
    const plate = new Mesh(g.backPlate, caseMaterial);
    const rim = new Mesh(g.rim, caseMaterial);
    const coverPrint = g.sidePrintBand ? g.buttonCovers : null;
    const prints = [g.printLayer, g.sidePrintBand, coverPrint]
      .filter((geo) => geo !== null)
      .map((geo) => new Mesh(geo, this.materials.print));
    const phone = new Mesh(g.phoneBody, this.materials.phoneBody);
    const islands = g.cameraIslands.map((geo) => new Mesh(geo, this.materials.cameraIsland));
    const covers = g.buttonCovers ? new Mesh(g.buttonCovers, caseMaterial) : null;
    const m = this.materials;
    const details = (
      [
        [g.phoneDetails.dark, m.cameraIsland],
        [g.phoneDetails.metal, m.phoneMetal],
        [g.phoneDetails.glass, m.lensGlass],
        [g.phoneDetails.lensCore, m.lensCore],
        [g.phoneDetails.flash, m.flash],
      ] as const
    )
      .filter(([geo]) => geo !== null)
      .map(([geo, material]) => new Mesh(geo!, material));
    for (const print of prints) {
      print.visible = this.materials.print.map !== null;
      print.renderOrder = 1;
    }
    for (const mesh of [plate, rim, phone, ...islands, ...(covers ? [covers] : [])]) {
      mesh.castShadow = true;
    }
    this.caseGroup.add(plate, rim, phone, ...prints, ...islands, ...details);
    if (covers) this.caseGroup.add(covers);
    this.meshes = { plate, rim, prints, phone, islands, covers };
    this.casePivot.position.z = -g.dims.depth / 2;
    this.caseGroup.position.z = g.dims.depth / 2;
    if (this.options.stand) {
      if (this.stand) {
        this.scene.remove(this.stand.group);
        this.stand.dispose();
      }
      this.stand = createDisplayStand(g.dims);
      this.scene.add(this.stand.group);
    }
    this.shadowCatcher.position.y = -g.dims.outerHeight / 2 - this.belowCase() - 0.5;
    this.requestRender();
  }

  private frameCase(): void {
    if (!this.camera || !this.geometries) return;
    const outerWidth = Math.max(this.geometries.dims.outerWidth, this.stand?.width ?? 0);
    const below = this.belowCase();
    const outerHeight = this.geometries.dims.outerHeight + below;
    const halfFov = (FOV * Math.PI) / 360;
    const fitH = outerHeight / 2 / Math.tan(halfFov);
    const fitW = outerWidth / 2 / (Math.tan(halfFov) * this.camera.aspect);
    const distance = Math.max(fitH, fitW) * 1.25;
    this.camera.position.set(0, -below / 2, distance);
    this.camera.lookAt(0, -below / 2, 0);
    this.controls?.target.set(0, -below / 2, 0);
    this.controls?.update();
    this.requestRender();
  }

  private belowCase(): number {
    return this.stand?.heightBelowCase ?? 0;
  }

  private resize(host: HTMLElement): void {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private applySceneTheme(theme: SceneTheme): void {
    this.scene.background =
      this.options.background === 'transparent' ? null : new Color(theme.background);
    (this.shadowCatcher.material as ShadowMaterial).opacity = theme.shadowOpacity;
    this.requestRender();
  }

  private dispose(): void {
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    cancelAnimationFrame(this.inertiaFrame);
    if (this.geometries) disposeCaseGeometries(this.geometries);
    this.stand?.dispose();
    disposeCaseMaterials(this.materials);
    this.shadowCatcher.geometry.dispose();
    (this.shadowCatcher.material as ShadowMaterial).dispose();
    this.scene.environment?.dispose();
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
    this.renderer = undefined;
  }
}
