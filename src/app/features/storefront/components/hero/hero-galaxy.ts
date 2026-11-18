import { NgZone, signal } from '@angular/core';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from 'three';

const PIXEL_RATIO_MAX = 1.5;
const BACKGROUND = 0x05060c;

const ARMS = 3;
const RADIUS = 5;
const CURL = 1.1;
const SCATTER = 0.32;
const STARS_WIDE = 36000;
const STARS_NARROW = 18000;
const BACKGROUND_STARS = 2500;
const CLOUDS = 140;
const CORE_COLOR = new Color(0xffd9a8);
const ARM_COLOR = new Color(0x6f7dff);
const CLOUD_COLORS = [new Color(0x8a5cff), new Color(0xff6fb5), new Color(0x4f8cff)];
const TURN_MS = 240_000;

const PROBE_WARMUP = 20;
const PROBE_FRAMES = 60;
const SLOW_FRAME_MS = 25;
const PAUSE_MS = 250;

export interface HeroGalaxyOptions {
  readonly reducedMotion: boolean;
}

const VERTEX_SHADER =  `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPointScale;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = max(1.0, aSize * uPointScale / -mvPosition.z);
    vColor = aColor;
    vAlpha = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase) + aPhase * 6.2832));
  }
`;

const FRAGMENT_SHADER =  `
  uniform float uOpacity;
  uniform float uFalloff;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), uFalloff) * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

export class HeroGalaxy {
  readonly ready = signal(false);
  readonly fast = signal<boolean | null>(null);

  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(50, 1, 0.1, 200);
  private readonly disc = new Group();
  private readonly materials: ShaderMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly glow: Sprite;
  private readonly resizeObserver: ResizeObserver;

  private active = false;
  private disposed = false;
  private frame = 0;
  private lastFrame = 0;
  private probed = 0;
  private readonly frameTimes: number[] = [];
  private readonly startTime = performance.now();

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly host: HTMLElement,
    private readonly ngZone: NgZone,
    private readonly options: HeroGalaxyOptions,
  ) {
    renderer.setClearColor(BACKGROUND, 1);
    renderer.domElement.classList.add('block', 'size-full');
    host.appendChild(renderer.domElement);

    this.camera.position.set(0, 3.4, 7.6);
    this.camera.lookAt(0, -0.4, 0);
    const tilt = new Group();
    tilt.rotation.set(0.18, 0, -0.32);
    tilt.add(this.disc);
    this.scene.add(tilt);

    const narrow = host.clientWidth < 640;
    this.disc.add(this.buildDisc(narrow ? STARS_NARROW : STARS_WIDE));
    this.disc.add(this.buildClouds());
    this.scene.add(this.buildBackgroundStars());
    this.glow = this.buildGlow();
    tilt.add(this.glow);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  static create(host: HTMLElement, ngZone: NgZone, options: HeroGalaxyOptions): HeroGalaxy | null {
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'default' });
    } catch {
      return null;
    }
    return ngZone.runOutsideAngular(() => new HeroGalaxy(renderer, host, ngZone, options));
  }

  setActive(active: boolean): void {
    this.active = active;
    this.lastFrame = 0;
    if (!active || this.disposed) return;
    if (this.options.reducedMotion) {
      this.render(this.startTime);
      this.markReady();
      return;
    }
    this.ensureLoop();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.glow.material.map?.dispose();
    this.glow.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private ensureLoop(): void {
    if (this.frame || !this.active || this.disposed || this.fast() === false) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (!this.active || this.disposed) return;
    this.render(now);
    this.markReady();
    if (this.fast() === null) this.probe(now);
    this.lastFrame = now;
    this.ensureLoop();
  };

  private markReady(): void {
    if (!this.ready()) this.ngZone.run(() => this.ready.set(true));
  }

  private probe(now: number): void {
    const delta = now - this.lastFrame;
    if (!this.lastFrame || delta > PAUSE_MS) return;
    if (++this.probed <= PROBE_WARMUP) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length < PROBE_FRAMES) return;

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const fast = median <= SLOW_FRAME_MS;
    if (!fast) cancelAnimationFrame(this.frame);
    this.ngZone.run(() => this.fast.set(fast));
  }

  private render(now: number): void {
    const t = now - this.startTime;
    this.disc.rotation.y = (t / TURN_MS) * Math.PI * 2;
    for (const material of this.materials) material.uniforms['uTime'].value = t / 1000;
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height || this.disposed) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.position.setLength(width < height ? 10.5 : 8.3);
    this.camera.updateProjectionMatrix();
    const pointScale = (height * pixelRatio) / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (const material of this.materials) material.uniforms['uPointScale'].value = pointScale;
    if (this.options.reducedMotion && this.active) this.render(this.startTime);
  }

  private buildDisc(count: number): Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const color = new Color();
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 1.7) * RADIUS;
      const angle = ((i % ARMS) / ARMS) * Math.PI * 2 + r * CURL;
      const spread = SCATTER * (0.25 + r * 0.6);
      positions[i * 3] = Math.cos(angle) * r + scatter() * spread;
      positions[i * 3 + 1] = scatter() * spread * 0.3 * (1 - (r / RADIUS) * 0.6);
      positions[i * 3 + 2] = Math.sin(angle) * r + scatter() * spread;

      color.copy(CORE_COLOR).lerp(ARM_COLOR, Math.min(1, r / (RADIUS * 0.7)));
      color.offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.1);
      color.toArray(colors, i * 3);
      sizes[i] = (0.012 + Math.random() * 0.03) * (r < 0.8 ? 1.6 : 1);
      phases[i] = Math.random();
    }
    return this.points({ positions, colors, sizes, phases }, 0.9, 2.2, 0.25);
  }

  private buildClouds(): Points {
    const positions = new Float32Array(CLOUDS * 3);
    const colors = new Float32Array(CLOUDS * 3);
    const sizes = new Float32Array(CLOUDS);
    const phases = new Float32Array(CLOUDS);
    for (let i = 0; i < CLOUDS; i++) {
      const r = 0.8 + Math.random() * (RADIUS - 1.2);
      const angle = ((i % ARMS) / ARMS) * Math.PI * 2 + r * CURL + scatter() * 0.3;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = scatter() * 0.1;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      CLOUD_COLORS[i % CLOUD_COLORS.length].toArray(colors, i * 3);
      sizes[i] = 0.9 + Math.random() * 1.1;
      phases[i] = 0;
    }
    return this.points({ positions, colors, sizes, phases }, 0.07, 1.6, 0);
  }

  private buildBackgroundStars(): Points {
    const positions = new Float32Array(BACKGROUND_STARS * 3);
    const colors = new Float32Array(BACKGROUND_STARS * 3);
    const sizes = new Float32Array(BACKGROUND_STARS);
    const phases = new Float32Array(BACKGROUND_STARS);
    const color = new Color();
    for (let i = 0; i < BACKGROUND_STARS; i++) {
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = s * Math.cos(theta) * dist;
      positions[i * 3 + 1] = u * dist;
      positions[i * 3 + 2] = s * Math.sin(theta) * dist;
      color.setHSL(0.6 + Math.random() * 0.1, 0.4, 0.75 + Math.random() * 0.25);
      color.toArray(colors, i * 3);
      sizes[i] = 0.12 + Math.random() * 0.25;
      phases[i] = Math.random();
    }
    return this.points({ positions, colors, sizes, phases }, 0.9, 2.5, 0.6);
  }

  private buildGlow(): Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 226, 190, 0.9)');
    gradient.addColorStop(0.25, 'rgba(255, 180, 140, 0.25)');
    gradient.addColorStop(1, 'rgba(120, 90, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const material = new SpriteMaterial({
      map: new CanvasTexture(canvas),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
    });
    const sprite = new Sprite(material);
    sprite.scale.setScalar(3.2);
    return sprite;
  }

  private points(
    data: {
      positions: Float32Array;
      colors: Float32Array;
      sizes: Float32Array;
      phases: Float32Array;
    },
    opacity: number,
    falloff: number,
    twinkle: number,
  ): Points {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('aColor', new Float32BufferAttribute(data.colors, 3));
    geometry.setAttribute('aSize', new Float32BufferAttribute(data.sizes, 1));
    geometry.setAttribute('aPhase', new Float32BufferAttribute(data.phases, 1));
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPointScale: { value: 1 },
        uOpacity: { value: opacity },
        uFalloff: { value: falloff },
        uTwinkle: { value: this.options.reducedMotion ? 0 : twinkle },
      },
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    return new Points(geometry, material);
  }
}

function scatter(): number {
  return Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? -1 : 1);
}
