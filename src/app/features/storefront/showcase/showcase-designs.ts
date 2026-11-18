import { CaseColor } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { textDirection } from '../../../core/utils/text-direction';

export type ShowcaseId =
  'aura' | 'marble' | 'sunset' | 'girih' | 'waves' | 'terrazzo' | 'botanical' | 'memphis';
export type ShowcaseCategory = 'abstract' | 'pattern' | 'nature';

export interface ShowcaseText {
  readonly color: string;
  readonly family: string;
  readonly weight: number;
  readonly glow?: string;
}

export interface ShowcaseDesign {
  readonly id: ShowcaseId;
  readonly category: ShowcaseCategory;
  readonly price: number;
  readonly caseColor: CaseColor;
  readonly tint: readonly [string, string];
  readonly text: ShowcaseText;
  readonly paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

export const SHOWCASE_DESIGNS: readonly ShowcaseDesign[] = [
  {
    id: 'aura',
    category: 'abstract',
    price: 470_000,
    caseColor: 'white',
    tint: ['#eca48c', '#b8a4e2'],
    text: { color: '#3a3346', family: 'Vazirmatn', weight: 700 },
    paint: paintAura,
  },
  {
    id: 'marble',
    category: 'pattern',
    price: 490_000,
    caseColor: 'white',
    tint: ['#d8cfc0', '#b8924a'],
    text: { color: '#3b3a37', family: 'Noto Naskh Arabic', weight: 700 },
    paint: paintMarble,
  },
  {
    id: 'girih',
    category: 'pattern',
    price: 520_000,
    caseColor: 'black',
    tint: ['#17474d', '#c9a25a'],
    text: { color: '#efe6d2', family: 'Noto Naskh Arabic', weight: 700, glow: '#0c2a2e' },
    paint: paintGirih,
  },
  {
    id: 'waves',
    category: 'nature',
    price: 470_000,
    caseColor: 'white',
    tint: ['#8fbdd3', '#e8b384'],
    text: { color: '#0c3c5e', family: 'Vazirmatn', weight: 800 },
    paint: paintWaves,
  },
  {
    id: 'terrazzo',
    category: 'pattern',
    price: 450_000,
    caseColor: 'white',
    tint: ['#e76f51', '#2a9d8f'],
    text: { color: '#21404d', family: 'Lalezar', weight: 400 },
    paint: paintTerrazzo,
  },
  {
    id: 'botanical',
    category: 'nature',
    price: 490_000,
    caseColor: 'black',
    tint: ['#52b788', '#f7c59f'],
    text: { color: '#e3f5e6', family: 'Noto Naskh Arabic', weight: 700, glow: '#0d2a1f' },
    paint: paintBotanical,
  },
  {
    id: 'sunset',
    category: 'abstract',
    price: 490_000,
    caseColor: 'black',
    tint: ['#ff7a59', '#b8336a'],
    text: { color: '#ffffff', family: 'Lalezar', weight: 400, glow: '#ff3d9a' },
    paint: paintSunset,
  },
  {
    id: 'memphis',
    category: 'abstract',
    price: 450_000,
    caseColor: 'white',
    tint: ['#3a86ff', '#ff006e'],
    text: { color: '#1d1d1f', family: 'Lalezar', weight: 400 },
    paint: paintMemphis,
  },
];

export const HERO_DESIGNS: readonly ShowcaseDesign[] = SHOWCASE_DESIGNS.slice(4, 8);

export function showcaseById(id: string | null | undefined): ShowcaseDesign | undefined {
  return SHOWCASE_DESIGNS.find((d) => d.id === id);
}

export const NAME_MAX_LENGTH = 24;
const NAME_SIZE_MM = 10;
const NAME_MIN_SIZE_MM = 4.5;
const NAME_WIDTH_SHARE = 0.78;
const NAME_Y_SHARE = 0.74;

export function drawShowcase(
  ctx: CanvasRenderingContext2D,
  design: ShowcaseDesign,
  zone: PrintZone,
  pxPerMm: number,
  name: string,
): void {
  const w = Math.round(zone.widthMm * pxPerMm);
  const h = Math.round(zone.heightMm * pxPerMm);
  ctx.drawImage(paintedBackground(design, w, h), 0, 0, w, h);

  const text = name.trim();
  if (!text) return;
  const t = design.text;
  const backTop = (zone.bleedMm + zone.wrapMm) * pxPerMm;
  const cx = w / 2;
  const cy = backTop + zone.caseHeightMm * NAME_Y_SHARE * pxPerMm;
  const maxWidth = zone.caseWidthMm * NAME_WIDTH_SHARE * pxPerMm;

  ctx.save();
  ctx.direction = textDirection(text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = NAME_SIZE_MM * pxPerMm;
  ctx.font = nameFont(t, size);
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size = Math.max(NAME_MIN_SIZE_MM * pxPerMm, (size * maxWidth) / measured);
    ctx.font = nameFont(t, size);
  }
  if (t.glow) {
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = size * 0.35;
  }
  ctx.fillStyle = t.color;
  ctx.fillText(text, cx, cy, maxWidth);
  ctx.restore();
}

function nameFont(t: ShowcaseText, sizePx: number): string {
  return `${t.weight} ${sizePx}px "${t.family}"`;
}

export async function ensureShowcaseFont(design: ShowcaseDesign, name: string): Promise<boolean> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  const text = name.trim();
  if (!fonts || !text) return false;
  const font = nameFont(design.text, 16);
  if (fonts.check(font, text)) return false;
  try {
    await fonts.load(font, text);
    return true;
  } catch {
    return false;
  }
}

export function renderShowcaseFile(design: ShowcaseDesign, zone: PrintZone): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = zone.widthPx;
  canvas.height = zone.heightPx;
  design.paint(canvas.getContext('2d')!, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], `${design.id}.png`, { type: 'image/png' }));
      else reject(new Error('Could not render the design.'));
    }, 'image/png'),
  );
}

const CACHE_LIMIT = 8;
const backgrounds = new Map<string, HTMLCanvasElement>();

function paintedBackground(design: ShowcaseDesign, w: number, h: number): HTMLCanvasElement {
  const key = `${design.id}|${w}x${h}`;
  let canvas = backgrounds.get(key);
  if (canvas) {
    backgrounds.delete(key);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    design.paint(canvas.getContext('2d')!, canvas.width, canvas.height);
    if (backgrounds.size >= CACHE_LIMIT) backgrounds.delete(backgrounds.keys().next().value!);
  }
  backgrounds.set(key, canvas);
  return canvas;
}

function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintAura(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#f3eee8';
  ctx.fillRect(0, 0, w, h);
  const blobs: [x: number, y: number, r: number, rgb: string][] = [
    [0.2, 0.18, 0.75, '236, 164, 140'],
    [0.85, 0.35, 0.7, '184, 164, 226'],
    [0.3, 0.62, 0.65, '150, 192, 226'],
    [0.8, 0.88, 0.6, '240, 204, 132'],
  ];
  for (const [bx, by, br, rgb] of blobs) {
    const x = bx * w;
    const y = by * h;
    const r = br * w;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb}, 1)`);
    g.addColorStop(0.55, `rgba(${rgb}, 0.5)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function paintMarble(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#f6f4f0');
  base.addColorStop(1, '#e9e5de');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const rnd = random(23);
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = (25 + rnd() * 35) * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(160, 154, 144, 0.22)');
    g.addColorStop(1, 'rgba(160, 154, 144, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const vein = (color: string, alpha: number, width: number, steps: number) => {
    let x = rnd() * w * 1.2 - w * 0.2;
    let y = rnd() * h * 0.6 - h * 0.1;
    let a = Math.PI * (0.25 + rnd() * 0.2);
    const points: [number, number][] = [[x, y]];
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.45;
      x += Math.cos(a) * 3 * u;
      y += Math.sin(a) * 3 * u;
      points.push([x, y]);
    }
    for (const [k, pass] of [
      [4, 0.25],
      [1.8, 0.5],
      [0.6, 1],
    ]) {
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha * pass;
      ctx.lineWidth = width * k * u;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  for (let i = 0; i < 9; i++) vein('#8a857c', 0.5, 0.35 + rnd() * 0.5, 40 + rnd() * 40);
  for (let i = 0; i < 14; i++) vein('#a39e94', 0.4, 0.15 + rnd() * 0.2, 15 + rnd() * 20);
  vein('#b8924a', 1, 0.35, 70);
  vein('#b8924a', 0.8, 0.25, 50);
}

function paintSunset(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  const horizon = h * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#140a33');
  sky.addColorStop(0.45, '#4b1468');
  sky.addColorStop(0.8, '#b8336a');
  sky.addColorStop(1, '#ff7a59');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  const rnd = random(7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  for (let i = 0; i < 70; i++) {
    const r = rnd() * 0.45 * u + 0.15 * u;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * horizon * 0.55, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const sunR = 34 * u;
  const sunY = horizon - sunR * 0.35;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sun.addColorStop(0, '#ffe36e');
  sun.addColorStop(0.6, '#ff8a5c');
  sun.addColorStop(1, '#ff3d9a');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, horizon);
  ctx.clip();
  ctx.shadowColor = 'rgba(255, 120, 90, 0.8)';
  ctx.shadowBlur = 12 * u;
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w / 2, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) {
    const y = sunY + i * 5.2 * u;
    ctx.fillRect(0, y, w, 0.7 * u + i * 0.45 * u);
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.restore();

  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, '#2a0b45');
  ground.addColorStop(1, '#0b0620');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = 'rgba(255, 61, 154, 0.85)';
  ctx.lineWidth = 0.5 * u;
  ctx.beginPath();
  for (let i = -12; i <= 12; i++) {
    ctx.moveTo(w / 2 + i * 3 * u, horizon);
    ctx.lineTo(w / 2 + i * 22 * u, h);
  }
  for (let i = 1; i < 14; i++) {
    const y = horizon + (h - horizon) * Math.pow(i / 13, 2.1);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#ffd1e8';
  ctx.fillRect(0, horizon - 0.3 * u, w, 0.6 * u);
}

function paintGirih(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  ctx.fillStyle = '#123b40';
  ctx.fillRect(0, 0, w, h);
  const cell = 25 * u;
  const star = (cx: number, cy: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.72;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.lineJoin = 'round';
  for (let row = -1; row * cell < h + cell; row++) {
    for (let col = -1; col * cell < w + cell; col++) {
      const cx = col * cell + (row % 2 ? cell / 2 : 0);
      const cy = row * cell * 0.86;
      star(cx, cy, cell * 0.46);
      ctx.fillStyle = '#17474d';
      ctx.fill();
      ctx.lineWidth = 0.7 * u;
      ctx.strokeStyle = '#e8dcc0';
      ctx.stroke();
      star(cx, cy, cell * 0.25);
      ctx.lineWidth = 0.5 * u;
      ctx.strokeStyle = '#c9a25a';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = '#c9a25a';
      ctx.fill();
      const dx = cx + cell / 2;
      const dy = cy + cell * 0.43;
      ctx.beginPath();
      ctx.moveTo(dx, dy - cell * 0.13);
      ctx.lineTo(dx + cell * 0.09, dy);
      ctx.lineTo(dx, dy + cell * 0.13);
      ctx.lineTo(dx - cell * 0.09, dy);
      ctx.closePath();
      ctx.lineWidth = 0.5 * u;
      ctx.strokeStyle = '#c9a25a';
      ctx.stroke();
    }
  }
  const shade = ctx.createLinearGradient(0, h * 0.5, 0, h);
  shade.addColorStop(0, 'rgba(12, 42, 46, 0)');
  shade.addColorStop(1, 'rgba(12, 42, 46, 0.85)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

function paintWaves(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#fdf6e9');
  sky.addColorStop(0.55, '#e3eef3');
  sky.addColorStop(1, '#d2e4ec');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#e8b384';
  ctx.beginPath();
  ctx.arc(w * 0.7, h * 0.16, 11 * u, 0, Math.PI * 2);
  ctx.fill();

  const layers = ['#bcd9e6', '#8fbdd3', '#6198b8', '#3f7699', '#2a5674'];
  layers.forEach((color, i) => {
    const base = h * (0.3 + i * 0.1);
    const amp = (3 + i * 1.6) * u;
    const len = (34 - i * 3) * u;
    const phase = i * 1.7;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 2; x += 2) {
      ctx.lineTo(
        x,
        base + Math.sin(x / len + phase) * amp + Math.sin(x / (len * 0.37)) * amp * 0.25,
      );
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= w + 2; x += 2) {
      const y = base + Math.sin(x / len + phase) * amp + Math.sin(x / (len * 0.37)) * amp * 0.25;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = (0.5 + i * 0.15) * u;
    ctx.stroke();
  });
  const band = ctx.createLinearGradient(0, h * 0.64, 0, h * 0.86);
  band.addColorStop(0, 'rgba(253, 246, 233, 0)');
  band.addColorStop(0.5, 'rgba(253, 246, 233, 0.82)');
  band.addColorStop(1, 'rgba(253, 246, 233, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.64, w, h * 0.22);
}

function paintTerrazzo(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  ctx.fillStyle = '#f3ece2';
  ctx.fillRect(0, 0, w, h);
  const colors = ['#e76f51', '#2a9d8f', '#264653', '#e9c46a', '#f4a261', '#c9b8a8'];
  const rnd = random(42);
  const chips = Math.round((w * h) / (u * u * 32));
  for (let i = 0; i < chips; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = (rnd() < 0.15 ? 3.5 : 1.2) * u * (0.6 + rnd());
    const sides = 5 + Math.floor(rnd() * 3);
    const turn = rnd() * Math.PI;
    ctx.beginPath();
    for (let s = 0; s < sides; s++) {
      const a = turn + (s / sides) * Math.PI * 2;
      const rr = r * (0.6 + rnd() * 0.5);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(243, 236, 226, 0.9)';
  ctx.beginPath();
  ctx.roundRect(w * 0.08, h * 0.68, w * 0.84, h * 0.12, 4 * u);
  ctx.fill();
}

function paintBotanical(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  ctx.fillStyle = '#163b2c';
  ctx.fillRect(0, 0, w, h);
  const greens = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#1b4332'];
  const rnd = random(11);
  const leaves = Math.round((w * h) / (u * u * 90));
  for (let i = 0; i < leaves; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = (8 + rnd() * 10) * u;
    const angle = rnd() * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
    ctx.fillStyle = greens[Math.floor(rnd() * greens.length)];
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.strokeStyle = 'rgba(216, 243, 220, 0.35)';
    ctx.lineWidth = 0.35 * u;
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < leaves / 10; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = (1.2 + rnd()) * u;
    ctx.fillStyle = '#f7c59f';
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const shade = ctx.createLinearGradient(0, h * 0.55, 0, h);
  shade.addColorStop(0, 'rgba(13, 42, 31, 0)');
  shade.addColorStop(1, 'rgba(13, 42, 31, 0.8)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
}

function paintMemphis(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const u = w / 100;
  ctx.fillStyle = '#fff1e6';
  ctx.fillRect(0, 0, w, h);
  const colors = ['#ff006e', '#3a86ff', '#ffbe0b', '#8338ec', '#06d6a0'];
  const rnd = random(5);
  const shapes = Math.round((w * h) / (u * u * 140));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < shapes; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const s = (3 + rnd() * 4) * u;
    const color = colors[Math.floor(rnd() * colors.length)];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * u;
    switch (i % 4) {
      case 0:
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) {
          const px = (k / 16) * s * 2 - s;
          const py = Math.sin((k / 16) * Math.PI * 3) * s * 0.25;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      case 1:
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(s * 0.55, s * 0.4);
        ctx.lineTo(-s * 0.55, s * 0.4);
        ctx.closePath();
        ctx.fill();
        break;
      case 2:
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        ctx.fillStyle = '#1d1d1f';
        for (let gx = 0; gx < 3; gx++) {
          for (let gy = 0; gy < 3; gy++) {
            ctx.beginPath();
            ctx.arc((gx - 1) * s * 0.3, (gy - 1) * s * 0.3, 0.45 * u, 0, Math.PI * 2);
            ctx.fill();
          }
        }
    }
    ctx.restore();
  }
  ctx.fillStyle = '#fff1e6';
  ctx.strokeStyle = '#1d1d1f';
  ctx.lineWidth = 0.8 * u;
  ctx.beginPath();
  ctx.roundRect(w * 0.1, h * 0.68, w * 0.8, h * 0.12, 3 * u);
  ctx.fill();
  ctx.stroke();
}
