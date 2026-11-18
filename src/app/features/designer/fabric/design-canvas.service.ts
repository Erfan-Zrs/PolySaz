import { DestroyRef, effect, inject, Injectable, NgZone, signal } from '@angular/core';
import { Canvas, FabricImage, FabricObject, FabricText, Path, Point, TMat2D } from 'fabric';
import { CaseColor, PhoneSpec } from '../../../core/models/phone-spec.model';
import { PrintZone } from '../../../core/models/print-zone.model';
import { MM_PER_INCH } from '../../../core/utils/print-zone';
import { SCENE_THEMES, SceneTheme } from '../../../core/theme/scene-theme';
import { ThemeService } from '../../../core/theme/theme.service';
import { FLAT_CASE_COLORS } from '../three/case-materials';
import { DrawDesign } from '../three/print-texture';
import { createThumbnail, loadImageFile } from '../utils/load-image';
import { sideFeatures } from '../../../core/utils/side-features';
import { drawCameraDetails, drawSideDetails, drawSideMarkers } from '../utils/phone-details';
import {
  traceBackOutline,
  traceCutLine,
  traceCutout,
  traceSideFeature,
} from '../utils/print-template';
import {
  DEFAULT_TEXT_FONT,
  ensureTextFont,
  TEXT_WEIGHT_BOLD,
  TEXT_WEIGHT_NORMAL,
  textDirection,
  TextFontId,
  textFontByFamily,
  textFontById,
} from './text-fonts';
import { ShapeDef, shapeById, ShapeId } from './shapes';

const VIEW_MARGIN_PX = 44;
const MIN_ZONE_VIEW_SHARE = 0.3;
const VIEW_ANIMATION_MS = 220;
const MIN_VIEW_ZOOM = MIN_ZONE_VIEW_SHARE;
const MAX_VIEW_ZOOM = 8;
export const VIEW_ZOOM_STEP = 1.5;
const SNAP_PX = 8;
const DUPLICATE_OFFSET_MM = 4;
const TEXT_FONT_SIZE_MM = 10;
const TEXT_MAX_WIDTH_SHARE = 0.8;
const TEXT_LAYER_NAME_MAX = 40;
const SHAPE_WIDTH_SHARE = 0.35;
const LINE_WIDTH_SHARE = 0.6;
const SHAPE_STROKE_MM = 2;
export const MIN_SHAPE_STROKE_MM = 0.5;
export const MAX_SHAPE_STROKE_MM = 10;
export const MIN_SIZE_PERCENT = 5;
export const MAX_SIZE_PERCENT = 400;

export interface SelectedTransform {
  readonly sizePercent: number;
  readonly angle: number;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface SelectedTextStyle {
  readonly text: string;
  readonly font: TextFontId;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly align: TextAlign;
  readonly color: string;
}

export interface SelectedShapeStyle {
  readonly shape: ShapeId;
  readonly line: boolean;
  readonly filled: boolean;
  readonly color: string;
  readonly strokeWidthMm: number;
}

export interface DesignLayer {
  readonly id: number;
  readonly kind: 'image' | 'text' | 'shape';
  readonly name: string;
  readonly thumbnail: string | null;
  readonly shape: ShapeId | null;
  readonly selected: boolean;
}

interface LayerInfo {
  readonly id: number;
  readonly name: string;
  readonly thumbnail: string | null;
  readonly shape: ShapeId | null;
}

interface PinchGesture {
  readonly target: FabricObject;
  readonly distance: number;
  readonly angle: number;
  readonly mid: Point;
  readonly scale: number;
  readonly aspect: number;
  readonly objectAngle: number;
  readonly center: Point;
}

interface ViewPinch {
  readonly distance: number;
  readonly zoom: number;
  readonly anchor: Point;
}

interface UserView {
  readonly zoom: number;
  readonly center: Point;
}

class DesignFabricCanvas extends Canvas {
  drawUnderlay?: (ctx: CanvasRenderingContext2D) => void;
  drawGuides?: (ctx: CanvasRenderingContext2D) => void;

  override _renderBackground(ctx: CanvasRenderingContext2D): void {
    this.drawUnderlay?.(ctx);
  }

  override _renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.drawGuides?.(ctx);
  }
}

@Injectable()
export class DesignCanvasService {
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);

  readonly version = signal(0);
  readonly hasSelection = signal(false);
  readonly selectedImageDpi = signal<number | null>(null);
  readonly selectedTransform = signal<SelectedTransform | null>(null);
  readonly selectedText = signal<SelectedTextStyle | null>(null);
  readonly selectedShape = signal<SelectedShapeStyle | null>(null);
  readonly layers = signal<readonly DesignLayer[]>([]);
  readonly zoomed = signal(false);

  private canvas?: DesignFabricCanvas;
  private resizeObserver?: ResizeObserver;
  private host?: HTMLElement;
  private spec?: PhoneSpec;
  private printZone?: PrintZone;
  private caseColor: CaseColor = 'clear';
  private sceneTheme: SceneTheme = SCENE_THEMES.light;
  private viewAnimation = 0;
  private snapped = { x: false, y: false };
  private readonly touches = new Map<number, Point>();
  private readonly gesturePointers = new Set<number>();
  private gesture?: PinchGesture;
  private viewPinch?: ViewPinch;
  private userView: UserView | null = null;
  private pan?: Point;
  private readonly layerInfo = new WeakMap<FabricObject, LayerInfo>();
  private nextLayerId = 1;

  constructor() {
    effect(() => {
      this.sceneTheme = SCENE_THEMES[this.theme.resolved()];
      this.canvas?.getObjects().forEach((o) => this.styleControls(o));
      this.canvas?.requestRenderAll();
    });
    inject(DestroyRef).onDestroy(() => this.dispose());
  }

  init(host: HTMLElement): void {
    this.zone.runOutsideAngular(() => {
      this.host = host;
      const el = document.createElement('canvas');
      host.appendChild(el);
      const canvas = new DesignFabricCanvas(el, {
        selection: false,
        preserveObjectStacking: true,
        controlsAboveOverlay: true,
        enablePointerEvents: true,
        skipOffscreen: false,
      });
      canvas.drawUnderlay = (ctx) => this.drawUnderlay(ctx);
      canvas.drawGuides = (ctx) => this.drawGuides(ctx);
      this.canvas = canvas;

      const changed = () => this.onDesignChanged();
      canvas.on('object:added', changed);
      canvas.on('object:removed', changed);
      canvas.on('object:modified', changed);
      canvas.on('object:moving', ({ target }) => this.snapToCentre(target));
      const selected = () => this.updateSelection();
      canvas.on('selection:created', selected);
      canvas.on('selection:updated', selected);
      canvas.on('selection:cleared', selected);
      canvas.on('mouse:up', () => {
        this.snapped = { x: false, y: false };
        this.pan = undefined;
        this.fitView(true);
      });
      canvas.on('mouse:down', ({ target, e }) => {
        if (!target && this.userView && !this.gesture && !this.viewPinch) {
          this.pan = this.hostPoint(e as PointerEvent);
        }
      });
      canvas.on('mouse:move', ({ e }) => {
        if (this.pan) this.panTo(this.hostPoint(e as PointerEvent));
      });

      host.addEventListener('pointerdown', this.onPointerDown, { capture: true });
      host.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('pointermove', this.onPointerMove, { capture: true });
      window.addEventListener('pointerup', this.onPointerUp, { capture: true });
      window.addEventListener('pointercancel', this.onPointerUp, { capture: true });

      this.resizeObserver = new ResizeObserver(() => this.fitView());
      this.resizeObserver.observe(host);
      this.fitView();
    });
  }

  setProduct(spec: PhoneSpec, zone: PrintZone): void {
    const previous = this.printZone;
    if (previous && this.canvas) {
      const dx = (zone.widthMm - previous.widthMm) / 2;
      const dy = (zone.heightMm - previous.heightMm) / 2;
      for (const object of this.canvas.getObjects()) {
        const background = this.coversZone(object, previous);
        const ratio = background
          ? this.coverScale(object, zone) / this.coverScale(object, previous)
          : 1;
        object.set({
          left: object.left + dx,
          top: object.top + dy,
          scaleX: object.scaleX * ratio,
          scaleY: object.scaleY * ratio,
        });
        object.setCoords();
      }
    }
    this.spec = spec;
    this.printZone = zone;
    this.userView = null;
    this.zoomed.set(false);
    this.fitView();
    this.onDesignChanged();
  }

  setCaseColor(color: CaseColor): void {
    this.caseColor = color;
    this.canvas?.requestRenderAll();
  }

  async addImage(file: File): Promise<void> {
    const source = await loadImageFile(file);
    const zone = this.printZone;
    if (!this.canvas || !zone) return;
    const image = new FabricImage(source, {
      originX: 'center',
      originY: 'center',
      objectCaching: false,
    });
    this.layerInfo.set(image, {
      id: this.nextLayerId++,
      name: file.name,
      thumbnail: createThumbnail(source),
      shape: null,
    });
    this.fitInto(image, zone.widthMm, zone.heightMm, 'cover');
    this.place(image);
  }

  async addText(content: string, color: string): Promise<void> {
    const font = DEFAULT_TEXT_FONT;
    await ensureTextFont(font.family, TEXT_WEIGHT_NORMAL, 'normal', content);
    const zone = this.printZone;
    if (!this.canvas || !zone) return;
    const text = new FabricText(content, {
      originX: 'center',
      originY: 'center',
      objectCaching: false,
      left: zone.widthMm / 2,
      top: zone.heightMm / 2,
      fontFamily: font.family,
      fontSize: TEXT_FONT_SIZE_MM,
      fontWeight: TEXT_WEIGHT_NORMAL,
      fill: color,
      textAlign: 'center',
      direction: textDirection(content),
    });
    const scale = Math.min(1, (zone.caseWidthMm * TEXT_MAX_WIDTH_SHARE) / text.width);
    text.set({ scaleX: scale, scaleY: scale });
    this.layerInfo.set(text, { id: this.nextLayerId++, name: '', thumbnail: null, shape: null });
    this.place(text);
  }

  addShape(id: ShapeId, filled: boolean, color: string): void {
    const zone = this.printZone;
    if (!this.canvas || !zone) return;
    const def = shapeById(id);
    const shape = new Path(def.path, {
      objectCaching: false,
      strokeUniform: true,
      strokeLineJoin: def.join,
      strokeLineCap: 'round',
      ...shapePaint(def, filled, color, SHAPE_STROKE_MM),
    });
    const share = def.line ? LINE_WIDTH_SHARE : SHAPE_WIDTH_SHARE;
    const scale = (zone.caseWidthMm * share) / def.width;
    shape.set({
      originX: 'center',
      originY: 'center',
      left: zone.widthMm / 2,
      top: zone.heightMm / 2,
      scaleX: scale,
      scaleY: scale,
    });
    this.layerInfo.set(shape, { id: this.nextLayerId++, name: '', thumbnail: null, shape: id });
    this.place(shape);
  }

  setSelectedShapeStyle(change: Partial<Omit<SelectedShapeStyle, 'shape' | 'line'>>): void {
    const object = this.canvas?.getActiveObject();
    const style = object && this.shapeStyleOf(object);
    if (!object || !style) return;
    const next = { ...style, ...change };
    const strokeWidthMm = Math.min(
      MAX_SHAPE_STROKE_MM,
      Math.max(MIN_SHAPE_STROKE_MM, next.strokeWidthMm),
    );
    object.set(shapePaint(shapeById(style.shape), next.filled, next.color, strokeWidthMm));
    object.setCoords();
    this.fitView(true);
    this.onDesignChanged();
  }

  setSelectedTextStyle(change: Partial<SelectedTextStyle>): void {
    const object = this.canvas?.getActiveObject();
    if (!(object instanceof FabricText)) return;
    const props: Record<string, unknown> = {};
    if (change.text !== undefined) {
      props['text'] = change.text;
      props['direction'] = textDirection(change.text);
    }
    if (change.font) props['fontFamily'] = textFontById(change.font).family;
    if (change.bold !== undefined) {
      props['fontWeight'] = change.bold ? TEXT_WEIGHT_BOLD : TEXT_WEIGHT_NORMAL;
    }
    if (change.italic !== undefined) props['fontStyle'] = change.italic ? 'italic' : 'normal';
    if (change.underline !== undefined) props['underline'] = change.underline;
    if (change.align) props['textAlign'] = change.align;
    if (change.color) props['fill'] = change.color;
    object.set(props);
    object.initDimensions();
    object.setCoords();
    this.fitView(true);
    this.onDesignChanged();
    void this.loadTextFont(object);
  }

  fillSelected(): void {
    this.transformSelected((object, zone) =>
      this.fitInto(object, zone.widthMm, zone.heightMm, 'cover'),
    );
  }

  containSelected(): void {
    this.transformSelected((object, zone) =>
      this.fitInto(object, zone.caseWidthMm, zone.caseHeightMm, 'contain'),
    );
  }

  centerSelected(): void {
    this.transformSelected((object, zone) =>
      object.set({ left: zone.widthMm / 2, top: zone.heightMm / 2 }),
    );
  }

  rotateSelectedBy(degrees: number): void {
    this.transformSelected((object) =>
      object.set({ angle: normalizeAngle(object.angle + degrees) }),
    );
  }

  setSelectedAngle(degrees: number): void {
    this.transformSelected((object) => object.set({ angle: normalizeAngle(degrees) }));
  }

  flipSelected(): void {
    this.transformSelected((object) => object.set({ flipX: !object.flipX }));
  }

  setSelectedSize(percent: number): void {
    this.transformSelected((object, zone) => {
      const clamped = Math.min(MAX_SIZE_PERCENT, Math.max(MIN_SIZE_PERCENT, percent));
      const scale = (this.coverScale(object, zone) * clamped) / 100;
      object.set({ scaleX: scale, scaleY: (object.scaleY * scale) / object.scaleX });
    });
  }

  selectLayer(id: number): void {
    const object = this.findLayer(id);
    if (!object) return;
    this.canvas!.setActiveObject(object);
    this.fitView(true);
    this.updateSelection();
  }

  async duplicateLayer(id: number): Promise<void> {
    const canvas = this.canvas;
    const object = this.findLayer(id);
    const info = object && this.layerInfo.get(object);
    if (!canvas || !object || !info) return;
    const copy =
      object instanceof FabricImage
        ? new FabricImage(object.getElement(), {
            originX: 'center',
            originY: 'center',
            objectCaching: false,
            angle: object.angle,
            scaleX: object.scaleX,
            scaleY: object.scaleY,
            flipX: object.flipX,
            flipY: object.flipY,
          })
        : await object.clone();
    copy.set({ objectCaching: false });
    const center = object.getCenterPoint();
    copy.setPositionByOrigin(
      new Point(center.x + DUPLICATE_OFFSET_MM, center.y + DUPLICATE_OFFSET_MM),
      'center',
      'center',
    );
    this.layerInfo.set(copy, { ...info, id: this.nextLayerId++ });
    this.styleControls(copy);
    this.zone.runOutsideAngular(() => {
      canvas.insertAt(canvas.getObjects().indexOf(object) + 1, copy);
      canvas.setActiveObject(copy);
      this.fitView(true);
    });
    this.updateSelection();
  }

  moveLayer(id: number, index: number): void {
    const canvas = this.canvas;
    const object = this.findLayer(id);
    if (!canvas || !object) return;
    const count = canvas.getObjects().length;
    const target = count - 1 - Math.min(count - 1, Math.max(0, index));
    if (canvas.getObjects().indexOf(object) === target) return;
    canvas.moveObjectTo(object, target);
    canvas.requestRenderAll();
    this.onDesignChanged();
  }

  removeLayer(id: number): void {
    const canvas = this.canvas;
    const object = this.findLayer(id);
    if (!canvas || !object) return;
    if (canvas.getActiveObject() === object) canvas.discardActiveObject();
    canvas.remove(object);
    this.fitView(true);
    this.updateSelection();
  }

  removeSelected(): void {
    const object = this.canvas?.getActiveObject();
    const info = object && this.layerInfo.get(object);
    if (info) this.removeLayer(info.id);
  }

  private place(object: FabricObject): void {
    const canvas = this.canvas!;
    this.styleControls(object);
    this.zone.runOutsideAngular(() => {
      canvas.add(object);
      canvas.setActiveObject(object);
      this.fitView(true);
    });
    this.updateSelection();
  }

  private async loadTextFont(object: FabricText): Promise<void> {
    const { fontFamily, fontWeight, fontStyle, text } = object;
    if (!(await ensureTextFont(fontFamily, fontWeight, fontStyle, text)) || !this.canvas) return;
    for (const o of this.canvas.getObjects()) {
      if (o instanceof FabricText && o.fontFamily === fontFamily) {
        o.initDimensions();
        o.setCoords();
      }
    }
    this.fitView(true);
    this.onDesignChanged();
  }

  zoomBy(factor: number, at?: Point, animate = false): void {
    const canvas = this.canvas;
    if (!canvas || !this.printZone) return;
    const point = at ?? new Point(canvas.width / 2, canvas.height / 2);
    const zoom = this.userView?.zoom ?? canvas.viewportTransform[0] / this.fitZoom();
    this.setUserView(zoom * factor, this.toScene(point), point, animate);
  }

  resetView(): void {
    this.userView = null;
    this.zoomed.set(false);
    this.fitView(true);
  }

  private findLayer(id: number): FabricObject | undefined {
    return this.canvas?.getObjects().find((o) => this.layerInfo.get(o)?.id === id);
  }

  readonly drawDesign: DrawDesign = (ctx, pxPerMm) => {
    if (!this.canvas) return;
    ctx.save();
    ctx.scale(pxPerMm, pxPerMm);
    for (const object of this.canvas.getObjects()) object.render(ctx);
    ctx.restore();
  };

  private transformSelected(change: (object: FabricObject, zone: PrintZone) => void): void {
    const object = this.canvas?.getActiveObject();
    if (!object || !this.printZone) return;
    change(object, this.printZone);
    object.setCoords();
    this.fitView(true);
    this.onDesignChanged();
  }

  private fitInto(object: FabricObject, w: number, h: number, mode: 'cover' | 'contain'): void {
    const angle = normalizeAngle(Math.round(object.angle / 90) * 90);
    const [ow, oh] =
      angle % 180 === 0 ? [object.width, object.height] : [object.height, object.width];
    const scale = fitScale(ow, oh, w, h, mode);
    const zone = this.printZone!;
    object.set({
      left: zone.widthMm / 2,
      top: zone.heightMm / 2,
      angle,
      scaleX: scale,
      scaleY: scale,
      originX: 'center',
      originY: 'center',
    });
  }

  private coverScale(object: FabricObject, zone: PrintZone): number {
    const quarterTurned = Math.round(object.angle / 90) % 2 !== 0;
    const [ow, oh] = quarterTurned ? [object.height, object.width] : [object.width, object.height];
    return fitScale(ow, oh, zone.widthMm, zone.heightMm, 'cover');
  }

  private coversZone(object: FabricObject, zone: PrintZone): boolean {
    const e = 0.01;
    return [
      new Point(e, e),
      new Point(zone.widthMm - e, e),
      new Point(zone.widthMm - e, zone.heightMm - e),
      new Point(e, zone.heightMm - e),
    ].every((corner) => object.containsPoint(corner));
  }

  private snapToCentre(object: FabricObject): void {
    const zone = this.printZone;
    if (!zone || !this.canvas) return;
    const threshold = SNAP_PX / this.canvas.viewportTransform[0];
    const [cx, cy] = [zone.widthMm / 2, zone.heightMm / 2];
    const center = object.getCenterPoint();
    this.snapped = {
      x: Math.abs(center.x - cx) < threshold,
      y: Math.abs(center.y - cy) < threshold,
    };
    if (this.snapped.x || this.snapped.y) {
      object.setPositionByOrigin(
        new Point(this.snapped.x ? cx : center.x, this.snapped.y ? cy : center.y),
        'center',
        'center',
      );
    }
  }

  private styleControls(object: FabricObject): void {
    const color = this.sceneTheme.guide;
    object.set({
      cornerStyle: 'circle',
      transparentCorners: false,
      cornerColor: color,
      cornerStrokeColor: '#ffffff',
      borderColor: color,
      borderScaleFactor: 1.5,
      cornerSize: 14,
      touchCornerSize: 32,
      lockScalingFlip: true,
      snapAngle: 15,
      snapThreshold: 3,
    });
    const shape = this.layerInfo.get(object)?.shape;
    const sides = !!shape;
    const ends = !!shape && !shapeById(shape).line;
    object.setControlsVisibility({ ml: sides, mr: sides, mt: ends, mb: ends });
  }

  private fitZoom(): number {
    const canvas = this.canvas!;
    const zone = this.printZone!;
    return Math.min(
      (canvas.width - 2 * VIEW_MARGIN_PX) / zone.widthMm,
      (canvas.height - 2 * VIEW_MARGIN_PX) / zone.heightMm,
    );
  }

  private setUserView(zoom: number, anchor: Point, at: Point, animate = false): void {
    const canvas = this.canvas!;
    const zone = this.printZone!;
    const z = Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, zoom));
    const scale = z * this.fitZoom();
    const center = new Point(
      Math.min(zone.widthMm, Math.max(0, anchor.x + (canvas.width / 2 - at.x) / scale)),
      Math.min(zone.heightMm, Math.max(0, anchor.y + (canvas.height / 2 - at.y) / scale)),
    );
    this.userView = { zoom: z, center };
    if (!this.zoomed()) this.zone.run(() => this.zoomed.set(true));
    this.fitView(animate);
  }

  private panTo(point: Point): void {
    const view = this.userView;
    const last = this.pan;
    if (!view || !last) return;
    this.pan = point;
    this.setUserView(view.zoom, this.toScene(last), point);
  }

  private hostPoint(e: { clientX: number; clientY: number } | Point): Point {
    const rect = this.host!.getBoundingClientRect();
    const [x, y] = e instanceof Point ? [e.x, e.y] : [e.clientX, e.clientY];
    return new Point(x - rect.left, y - rect.top);
  }

  private toScene(point: Point): Point {
    const [zoom, , , , tx, ty] = this.canvas!.viewportTransform;
    return new Point((point.x - tx) / zoom, (point.y - ty) / zoom);
  }

  private fitView(animate = false): void {
    const canvas = this.canvas;
    const host = this.host;
    if (!canvas || !host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    if (canvas.width !== width || canvas.height !== height) canvas.setDimensions({ width, height });
    const zone = this.printZone;
    if (!zone) {
      canvas.requestRenderAll();
      return;
    }

    const zoneZoom = this.fitZoom();
    let [cx, cy] = [zone.widthMm / 2, zone.heightMm / 2];
    let zoom: number;
    if (this.userView) {
      zoom = Math.max(0.01, zoneZoom * this.userView.zoom);
      [cx, cy] = [this.userView.center.x, this.userView.center.y];
    } else {
      let [halfW, halfH] = [cx, cy];
      const object = canvas.getActiveObject();
      if (object) {
        for (const p of object.getCoords()) {
          halfW = Math.max(halfW, Math.abs(p.x - cx));
          halfH = Math.max(halfH, Math.abs(p.y - cy));
        }
      }
      const fit = (w: number, h: number) =>
        Math.min((width - 2 * VIEW_MARGIN_PX) / w, (height - 2 * VIEW_MARGIN_PX) / h);
      zoom = Math.max(0.01, zoneZoom * MIN_ZONE_VIEW_SHARE, fit(2 * halfW, 2 * halfH));
    }
    const target: TMat2D = [zoom, 0, 0, zoom, width / 2 - cx * zoom, height / 2 - cy * zoom];

    cancelAnimationFrame(this.viewAnimation);
    if (!animate) {
      canvas.setViewportTransform(target);
      canvas.requestRenderAll();
      return;
    }
    const from = [...canvas.viewportTransform];
    if (from.every((v, i) => Math.abs(v - target[i]) < 0.01)) {
      canvas.requestRenderAll();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / VIEW_ANIMATION_MS);
      const k = 1 - (1 - t) ** 3;
      canvas.setViewportTransform(from.map((v, i) => v + (target[i] - v) * k) as TMat2D);
      canvas.requestRenderAll();
      if (t < 1) this.viewAnimation = requestAnimationFrame(step);
    };
    this.viewAnimation = requestAnimationFrame(step);
  }

  private drawUnderlay(ctx: CanvasRenderingContext2D): void {
    const canvas = this.canvas!;
    ctx.fillStyle = `#${this.sceneTheme.background.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!this.spec || !this.printZone) return;
    ctx.save();
    ctx.transform(...canvas.viewportTransform);
    ctx.beginPath();
    traceCutLine(ctx, this.spec, this.printZone, 1);
    ctx.fillStyle = FLAT_CASE_COLORS[this.caseColor];
    ctx.fill();
    ctx.restore();
  }

  private drawGuides(ctx: CanvasRenderingContext2D): void {
    const canvas = this.canvas!;
    const spec = this.spec;
    const zone = this.printZone;
    if (!spec || !zone) return;
    const [zoom] = canvas.viewportTransform;
    ctx.save();
    ctx.transform(...canvas.viewportTransform);

    const [x0, y0] = [-canvas.viewportTransform[4] / zoom, -canvas.viewportTransform[5] / zoom];
    ctx.beginPath();
    ctx.rect(x0, y0, canvas.width / zoom, canvas.height / zoom);
    traceCutLine(ctx, spec, zone, 1);
    for (const cutout of spec.cameraCutouts) traceCutout(ctx, cutout, zone, 1);
    const wraps = zone.wrapMm > 0;
    const sideHoles = wraps ? sideFeatures(spec, 'hole') : [];
    for (const feature of sideHoles) traceSideFeature(ctx, feature, spec, zone, 1);
    ctx.fillStyle = this.sceneTheme.flatOutside;
    ctx.fill('evenodd');

    drawCameraDetails(ctx, spec, zone, 1);
    if (wraps) drawSideDetails(ctx, spec, zone, 1);

    ctx.strokeStyle = this.sceneTheme.guide;
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    traceCutLine(ctx, spec, zone, 1);
    ctx.stroke();
    for (const cutout of spec.cameraCutouts) {
      ctx.beginPath();
      traceCutout(ctx, cutout, zone, 1);
      ctx.stroke();
    }
    for (const feature of sideHoles) {
      ctx.beginPath();
      traceSideFeature(ctx, feature, spec, zone, 1);
      ctx.stroke();
    }
    if (!wraps) drawSideMarkers(ctx, spec, zone, 1, this.sceneTheme.guide, 1 / zoom);

    ctx.setLineDash([4 / zoom, 4 / zoom]);
    if (wraps) {
      ctx.beginPath();
      traceBackOutline(ctx, spec, zone, 1);
      ctx.stroke();
      for (const feature of sideFeatures(spec, 'cover')) {
        ctx.beginPath();
        traceSideFeature(ctx, feature, spec, zone, 1);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(0, 0, zone.widthMm, zone.heightMm);

    ctx.beginPath();
    if (this.snapped.x) {
      ctx.moveTo(zone.widthMm / 2, 0);
      ctx.lineTo(zone.widthMm / 2, zone.heightMm);
    }
    if (this.snapped.y) {
      ctx.moveTo(0, zone.heightMm / 2);
      ctx.lineTo(zone.widthMm, zone.heightMm / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.printZone) return;
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
    this.zoomBy(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002)), this.hostPoint(e));
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    this.touches.set(e.pointerId, new Point(e.clientX, e.clientY));
    if (this.touches.size === 2 && !this.gesture && !this.viewPinch) this.startGesture();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.touches.has(e.pointerId)) return;
    this.touches.set(e.pointerId, new Point(e.clientX, e.clientY));
    if (!this.gesturePointers.has(e.pointerId)) return;
    e.stopPropagation();
    if (this.gesture) this.updateGesture(this.gesture);
    else if (this.viewPinch) this.updateViewPinch(this.viewPinch);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.touches.delete(e.pointerId);
    if (!this.gesturePointers.delete(e.pointerId)) return;
    e.stopPropagation();
    this.viewPinch = undefined;
    if (this.gesture) {
      this.gesture = undefined;
      this.fitView(true);
      this.onDesignChanged();
    }
  };

  private startGesture(): void {
    const canvas = this.canvas;
    if (!canvas || !this.printZone) return;
    if (canvas._currentTransform) canvas.endCurrentTransform();
    this.pan = undefined;
    for (const id of this.touches.keys()) this.gesturePointers.add(id);
    const [a, b] = [...this.touches.values()];
    const [pa, pb] = [this.hostPoint(a), this.hostPoint(b)];
    const target = canvas.getActiveObject();
    const onTarget =
      !!target &&
      (target.containsPoint(this.toScene(pa)) || target.containsPoint(this.toScene(pb)));
    if (!target || !onTarget) {
      this.viewPinch = {
        distance: Math.max(1, a.distanceFrom(b)),
        zoom: this.userView?.zoom ?? canvas.viewportTransform[0] / this.fitZoom(),
        anchor: this.toScene(pa.midPointFrom(pb)),
      };
      return;
    }
    this.gesture = {
      target,
      distance: Math.max(1, a.distanceFrom(b)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      mid: a.midPointFrom(b),
      scale: target.scaleX,
      aspect: target.scaleY / target.scaleX,
      objectAngle: target.angle,
      center: target.getCenterPoint(),
    };
  }

  private updateViewPinch(g: ViewPinch): void {
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return;
    this.setUserView(
      (g.zoom * a.distanceFrom(b)) / g.distance,
      g.anchor,
      this.hostPoint(a.midPointFrom(b)),
    );
  }

  private updateGesture(g: PinchGesture): void {
    const canvas = this.canvas!;
    const [a, b] = [...this.touches.values()];
    if (!a || !b) return;
    const zoom = canvas.viewportTransform[0];
    const coverScale = this.printZone ? this.coverScale(g.target, this.printZone) : g.scale;
    const scale = Math.min(
      (coverScale * MAX_SIZE_PERCENT) / 100,
      Math.max((coverScale * MIN_SIZE_PERCENT) / 100, (g.scale * a.distanceFrom(b)) / g.distance),
    );
    const turn = ((Math.atan2(b.y - a.y, b.x - a.x) - g.angle) * 180) / Math.PI;
    const mid = a.midPointFrom(b);
    g.target.set({
      scaleX: scale,
      scaleY: scale * g.aspect,
      angle: normalizeAngle(g.objectAngle + turn),
    });
    g.target.setPositionByOrigin(
      new Point(g.center.x + (mid.x - g.mid.x) / zoom, g.center.y + (mid.y - g.mid.y) / zoom),
      'center',
      'center',
    );
    g.target.setCoords();
    canvas.requestRenderAll();
  }

  private onDesignChanged(): void {
    this.zone.run(() => {
      this.version.update((v) => v + 1);
      this.updateSelection();
    });
  }

  private updateSelection(): void {
    const object = this.canvas?.getActiveObject();
    const dpi = object instanceof FabricImage ? Math.round(MM_PER_INCH / object.scaleX) : null;
    const transform: SelectedTransform | null =
      object && this.printZone
        ? {
            sizePercent: Math.round(
              (object.scaleX / this.coverScale(object, this.printZone)) * 100,
            ),
            angle: Math.round(normalizeAngle(object.angle)),
          }
        : null;
    const text = object instanceof FabricText ? textStyleOf(object) : null;
    const shape = object ? this.shapeStyleOf(object) : null;
    const layers: DesignLayer[] = [];
    for (const o of this.canvas?.getObjects() ?? []) {
      const info = this.layerInfo.get(o);
      if (!info) continue;
      const isText = o instanceof FabricText;
      layers.unshift({
        ...info,
        kind: isText ? 'text' : info.shape ? 'shape' : 'image',
        name: isText ? textLayerName(o.text) : info.name,
        selected: o === object,
      });
    }
    this.zone.run(() => {
      this.layers.set(layers);
      this.hasSelection.set(!!object);
      this.selectedImageDpi.set(dpi);
      this.selectedTransform.set(transform);
      this.selectedText.set(text);
      this.selectedShape.set(shape);
    });
  }

  private shapeStyleOf(object: FabricObject): SelectedShapeStyle | null {
    const shape = this.layerInfo.get(object)?.shape;
    if (!shape) return null;
    const { line } = shapeById(shape);
    const filled = !line && !!object.fill;
    const paint = filled ? object.fill : object.stroke;
    return {
      shape,
      line,
      filled,
      color: typeof paint === 'string' ? paint : '#000000',
      strokeWidthMm: object.strokeWidth || SHAPE_STROKE_MM,
    };
  }

  private dispose(): void {
    cancelAnimationFrame(this.viewAnimation);
    this.resizeObserver?.disconnect();
    this.host?.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.host?.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true });
    window.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    window.removeEventListener('pointercancel', this.onPointerUp, { capture: true });
    void this.canvas?.dispose();
    this.canvas = undefined;
  }
}

function fitScale(ow: number, oh: number, w: number, h: number, mode: 'cover' | 'contain'): number {
  const scales = [ow > 0 ? w / ow : NaN, oh > 0 ? h / oh : NaN].filter((v) => !Number.isNaN(v));
  if (!scales.length) return 1;
  return mode === 'cover' ? Math.max(...scales) : Math.min(...scales);
}

function shapePaint(
  def: ShapeDef,
  filled: boolean,
  color: string,
  strokeWidthMm: number,
): Partial<FabricObject> {
  return filled && !def.line
    ? { fill: color, stroke: null, strokeWidth: 0 }
    : { fill: null, stroke: color, strokeWidth: strokeWidthMm };
}

function normalizeAngle(degrees: number): number {
  const a = (((degrees % 360) + 540) % 360) - 180;
  return a === -180 ? 180 : a;
}

function textStyleOf(object: FabricText): SelectedTextStyle {
  return {
    text: object.text,
    font: textFontByFamily(object.fontFamily).id,
    bold: object.fontWeight === 'bold' || Number(object.fontWeight) >= TEXT_WEIGHT_BOLD,
    italic: object.fontStyle === 'italic',
    underline: object.underline,
    align: object.textAlign as TextAlign,
    color: typeof object.fill === 'string' ? object.fill : '#000000',
  };
}

function textLayerName(text: string): string {
  const line = (text.split('\n').find((l) => l.trim()) ?? '').trim();
  return line.length > TEXT_LAYER_NAME_MAX ? `${line.slice(0, TEXT_LAYER_NAME_MAX - 1)}…` : line;
}
