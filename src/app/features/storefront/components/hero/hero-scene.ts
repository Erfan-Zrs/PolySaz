import { createEnvironmentInjector, EnvironmentInjector, NgZone, signal } from '@angular/core';
import { CanvasTexture } from 'three';
import { PhoneSpec } from '../../../../core/models/phone-spec.model';
import { PrintZone } from '../../../../core/models/print-zone.model';
import { computePrintZone } from '../../../../core/utils/print-zone';
import { createPrintTexture, previewMaxLongSide } from '../../../designer/three/print-texture';
import { SceneService } from '../../../designer/three/scene.service';
import { drawShowcase, ensureShowcaseFont, ShowcaseDesign } from '../../showcase/showcase-designs';

const SWAY_YAW = 0.32;
const SWAY_YAW_PERIOD = 9000;
const SWAY_PITCH = 0.05;
const SWAY_PITCH_PERIOD = 13000;
const SPIN_MS = 1100;
const RETURN_DELAY_MS = 2500;
const RETURN_SHARE_PER_FRAME = 0.05;
const SWAY_EASE = 0.06;

const MAX_TEXTURE_PX = 1536;

export interface HeroSceneOptions {
  readonly reducedMotion: boolean;
}

export class HeroScene {
  readonly ready = signal(false);
  readonly grabbed = signal(false);

  private spec?: PhoneSpec;
  private printZone?: PrintZone;
  private design?: ShowcaseDesign;
  private shownDesign?: ShowcaseDesign;
  private name = '';
  private texture?: CanvasTexture;
  private textureQueued = false;

  private disposed = false;
  private active = false;
  private frame = 0;
  private swayAmount = 1;
  private dragging = false;
  private releasedAt = 0;
  private spinStart: number | null = null;
  private readonly startTime = performance.now();

  private constructor(
    private readonly injector: EnvironmentInjector,
    private readonly scene: SceneService,
    private readonly host: HTMLElement,
    private readonly ngZone: NgZone,
    private readonly options: HeroSceneOptions,
  ) {
    ngZone.runOutsideAngular(() => {
      host.addEventListener('pointerdown', this.onPointerDown);
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
    });
  }

  static create(
    host: HTMLElement,
    parent: EnvironmentInjector,
    options: HeroSceneOptions,
  ): HeroScene | null {
    const injector = createEnvironmentInjector([SceneService], parent);
    const scene = injector.get(SceneService);
    if (!scene.init(host, { background: 'transparent', controls: 'turntable', stand: true })) {
      injector.destroy();
      return null;
    }
    return new HeroScene(injector, scene, host, injector.get(NgZone), options);
  }

  setSpec(spec: PhoneSpec): void {
    if (this.spec?.id === spec.id) return;
    this.spec = spec;
    this.printZone = computePrintZone(spec, false);
    this.scene.setSpec(spec, this.printZone);
    if (this.shownDesign) this.scene.setCaseColor(this.shownDesign.caseColor);
    this.queueTexture();
  }

  setDesign(design: ShowcaseDesign, transition: boolean): void {
    if (this.design === design) return;
    this.design = design;
    if (!this.shownDesign || !transition || this.options.reducedMotion || !this.active) {
      this.showDesign(design);
      return;
    }
    this.spinStart = performance.now();
    this.ensureLoop();
  }

  setName(name: string): void {
    if (this.name === name) return;
    this.name = name;
    this.queueTexture();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active) this.ensureLoop();
    else this.finishSpin();
  }

  destroy(): void {
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.scene.setPrintTexture(null);
    this.texture?.dispose();
    this.injector.destroy();
  }

  private showDesign(design: ShowcaseDesign): void {
    this.shownDesign = design;
    this.scene.setCaseColor(design.caseColor);
    this.queueTexture();
  }

  private finishSpin(): void {
    if (this.spinStart === null) return;
    this.spinStart = null;
    if (this.design && this.design !== this.shownDesign) this.showDesign(this.design);
  }

  private queueTexture(): void {
    if (this.textureQueued) return;
    this.textureQueued = true;
    this.ngZone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.textureQueued = false;
        this.buildTexture();
      }),
    );
  }

  private buildTexture(): void {
    const { spec, printZone, shownDesign: design } = this;
    if (!spec || !printZone || !design || this.disposed) return;
    const name = this.name;
    const texture = createPrintTexture(
      spec,
      printZone,
      Math.min(previewMaxLongSide(), MAX_TEXTURE_PX),
      (ctx, pxPerMm) => drawShowcase(ctx, design, printZone, pxPerMm, name),
      false,
    );
    this.scene.setPrintTexture(texture);
    this.texture?.dispose();
    this.texture = texture;
    if (!this.ready()) this.ngZone.run(() => this.ready.set(true));
    void ensureShowcaseFont(design, name).then((loaded) => loaded && this.queueTexture());
  }

  private ensureLoop(): void {
    if (this.frame || !this.active) return;
    if (this.options.reducedMotion && this.spinStart === null) return;
    this.ngZone.runOutsideAngular(() => (this.frame = requestAnimationFrame(this.tick)));
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (!this.active || this.disposed) return;

    const idle = !this.dragging && now - this.releasedAt > RETURN_DELAY_MS;
    this.swayAmount += ((idle ? 1 : 0) - this.swayAmount) * SWAY_EASE;
    if (idle) this.scene.relaxDrag(RETURN_SHARE_PER_FRAME);

    let spin = 0;
    if (this.spinStart !== null) {
      const p = Math.min(1, (now - this.spinStart) / SPIN_MS);
      spin = easeInOut(p) * Math.PI * 2;
      if (p >= 0.5 && this.design && this.design !== this.shownDesign) {
        this.showDesign(this.design);
      }
      if (p >= 1) this.spinStart = null;
    }

    const t = now - this.startTime;
    const amount = this.options.reducedMotion ? 0 : this.swayAmount;
    const yaw = Math.sin((t / SWAY_YAW_PERIOD) * Math.PI * 2) * SWAY_YAW * amount;
    const pitch = Math.sin((t / SWAY_PITCH_PERIOD) * Math.PI * 2) * SWAY_PITCH * amount;
    this.scene.setCaseRotation(pitch, yaw + spin);
    this.ensureLoop();
  };

  private readonly onPointerDown = (): void => {
    this.dragging = true;
    this.ngZone.run(() => this.grabbed.set(true));
  };

  private readonly onPointerUp = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.releasedAt = performance.now();
    this.ngZone.run(() => this.grabbed.set(false));
  };
}

function easeInOut(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
