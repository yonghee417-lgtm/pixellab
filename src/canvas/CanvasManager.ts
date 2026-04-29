import * as fabric from 'fabric';
import { v4 as uuid } from 'uuid';
import type { LayerKind, LayerMeta, BlendMode } from '@shared/types';

// fabric 객체에 PixelLab 메타를 붙이기 위한 확장 필드
type ExtraProps = {
  layerId: string;        // 객체 자체 식별자
  layerGroupId: string;   // 소속 레이어 (Photoshop의 레이어 = 여러 객체의 그룹)
  layerKind: LayerKind;
  layerName: string;
  blendMode: BlendMode;
};

// fabric serialization include extra props
const EXTRA_PROP_KEYS = ['layerId', 'layerGroupId', 'layerKind', 'layerName', 'blendMode'] as const;

// 모든 fabric 객체가 toObject() 직렬화 시 PixelLab 메타를 포함하도록 확장
(function extendFabricObjectSerialization() {
  const proto = fabric.FabricObject.prototype as any;
  const original = proto.toObject;
  proto.toObject = function (propertiesToInclude: string[] = []) {
    return original.call(this, [...propertiesToInclude, ...EXTRA_PROP_KEYS]);
  };
})();

export interface CanvasManagerOptions {
  // 종이(작업) 사이즈
  paperWidth: number;
  paperHeight: number;
  paperBackground: string;
  // viewport(=canvas element) 사이즈. 미지정 시 paper 사이즈와 동일
  viewportWidth?: number;
  viewportHeight?: number;
}

// 종이 외부 워크스페이스 색
const WORKSPACE_COLOR = '#16161b';

const isPaperObj = (o: fabric.FabricObject) => (o as any).layerKind === 'paper';

type ListenerSet = {
  selection?: (objs: fabric.FabricObject[]) => void;
  modified?: () => void;
  layersChanged?: () => void;
  zoomChanged?: (zoom: number) => void;
};

export class CanvasManager {
  canvas: fabric.Canvas;
  // 종이(작업) 사이즈
  width: number;
  height: number;
  background: string;
  // 종이 사각형 (selectable:false, evented:false — 항상 z=0)
  paperRect: fabric.Rect | null = null;
  // 디스플레이 줌
  viewportZoom = 1;

  // 선택 영역(marquee) — 사용자가 'select(M)' 도구로 드래그한 사각형
  // brush/fill 등 페인트 도구는 이 영역 내에서만 적용됨
  marqueeBounds: { left: number; top: number; width: number; height: number } | null = null;
  private marqueeVisualRect: fabric.Rect | null = null;

  // 레이어 레지스트리 (top-first). paper는 포함하지 않음.
  private _layers: LayerMeta[] = [];
  private _activeLayerId: string | null = null;

  private listeners: ListenerSet = {};
  private history: string[] = [];
  private historyIndex = -1;
  private suspendHistory = false;
  private historyMax = 50;

  constructor(el: HTMLCanvasElement, opts: CanvasManagerOptions) {
    this.width = opts.paperWidth;
    this.height = opts.paperHeight;
    this.background = opts.paperBackground;

    this.canvas = new fabric.Canvas(el, {
      width: opts.viewportWidth ?? opts.paperWidth,
      height: opts.viewportHeight ?? opts.paperHeight,
      backgroundColor: WORKSPACE_COLOR,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      fireRightClick: true,
      selectionColor: 'rgba(255, 174, 0, 0.18)',
      selectionBorderColor: '#FFAE00',
      selectionLineWidth: 1,
      controlsAboveOverlay: true,
    });

    // 객체 컨트롤(핸들) 색상 — 골든 망고
    fabric.FabricObject.ownDefaults.cornerColor = '#FFAE00';
    fabric.FabricObject.ownDefaults.cornerStrokeColor = '#0a0a0c';
    fabric.FabricObject.ownDefaults.borderColor = '#FFAE00';
    fabric.FabricObject.ownDefaults.cornerStyle = 'circle';
    fabric.FabricObject.ownDefaults.cornerSize = 10;
    fabric.FabricObject.ownDefaults.transparentCorners = false;
    fabric.FabricObject.ownDefaults.padding = 0;

    this.addPaperRect();
    this.bindEvents();
    this.snapshot();
  }

  setListeners(l: ListenerSet) {
    this.listeners = l;
  }

  // ─────────────── 종이 (paper) ───────────────

  private addPaperRect() {
    // 기본은 완전 투명 + 점선 외곽선 (작업 영역 가이드 역할만).
    // 사용자가 명시적으로 색을 지정하면 그 색으로 채움.
    const isTransparent = this.background === 'transparent' || !this.background;
    const fill = isTransparent ? 'rgba(0,0,0,0)' : this.background;
    const r = new fabric.Rect({
      left: 0, top: 0, width: this.width, height: this.height,
      fill: fill as any,
      stroke: 'rgba(170,170,180,0.45)',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      strokeUniform: true,
      selectable: false, evented: false, hasControls: false, hasBorders: false,
      lockMovementX: true, lockMovementY: true,
      lockScalingX: true, lockScalingY: true,
      lockRotation: true, lockSkewingX: true, lockSkewingY: true,
      hoverCursor: 'default',
      objectCaching: false,
    });
    (r as any).layerId = 'paper';
    (r as any).layerKind = 'paper';
    (r as any).layerName = '__paper__';
    (r as any).blendMode = 'normal';
    this.canvas.add(r);
    this.canvas.sendObjectToBack(r);
    this.paperRect = r;
  }

  /** paper 객체를 항상 z=0으로 유지 */
  private restorePaperZ() {
    if (this.paperRect) this.canvas.sendObjectToBack(this.paperRect);
  }

  // ─────────────── 선택 영역 (Marquee) ───────────────

  /** 사각형 선택 영역 설정 (시각화도 같이) */
  setMarquee(left: number, top: number, width: number, height: number) {
    if (width < 1 || height < 1) {
      this.clearMarquee();
      return;
    }
    this.marqueeBounds = { left, top, width, height };
    if (this.marqueeVisualRect) this.canvas.remove(this.marqueeVisualRect);
    const rect = new fabric.Rect({
      left, top, width, height,
      fill: 'rgba(255, 174, 0, 0.05)',
      stroke: '#FFAE00',
      strokeWidth: 1,
      strokeDashArray: [6, 4],
      strokeUniform: true,
      selectable: false, evented: false,
      hasControls: false, hasBorders: false,
      objectCaching: false,
      excludeFromExport: true,
    });
    (rect as any)._preview = true;
    this.canvas.add(rect);
    this.canvas.bringObjectToFront(rect);
    this.marqueeVisualRect = rect;
    this.canvas.requestRenderAll();
  }

  clearMarquee() {
    if (this.marqueeVisualRect) {
      this.canvas.remove(this.marqueeVisualRect);
      this.marqueeVisualRect = null;
    }
    this.marqueeBounds = null;
    this.canvas.requestRenderAll();
  }

  hasMarquee(): boolean { return !!this.marqueeBounds; }

  /** 선택 영역에 색 채우기 — 활성 레이어에 사각형 객체로 추가 */
  fillMarquee(color: string): boolean {
    if (!this.marqueeBounds) return false;
    const m = this.marqueeBounds;
    const rect = new fabric.Rect({
      left: m.left, top: m.top,
      width: m.width, height: m.height,
      fill: color,
    });
    const groupId = this.ensureActiveLayer();
    Object.assign(rect, {
      layerId: uuid(),
      layerGroupId: groupId,
      layerKind: 'shape',
      layerName: '채우기',
      blendMode: 'normal',
    });
    this.canvas.add(rect);
    // marquee 시각화는 항상 가장 위로 유지
    if (this.marqueeVisualRect) this.canvas.bringObjectToFront(this.marqueeVisualRect);
    this.canvas.setActiveObject(rect);
    this.applyLayerOrderToCanvas();
    this.snapshot();
    return true;
  }

  /** 종이(배경)가 있는지 */
  hasPaper(): boolean { return !!this.paperRect; }

  /** 종이가 없을 때만 다시 추가 */
  addPaper() {
    if (this.paperRect) return;
    this.addPaperRect();
    this.applyLayerOrderToCanvas();
    this.canvas.requestRenderAll();
    this.snapshot();
    this.listeners.modified?.();
    this.listeners.layersChanged?.();
  }

  /** 종이를 제거 — 그 위 객체들은 그대로 유지 */
  removePaper() {
    if (!this.paperRect) return;
    this.canvas.remove(this.paperRect);
    this.paperRect = null;
    this.applyLayerOrderToCanvas();
    this.canvas.requestRenderAll();
    this.snapshot();
    this.listeners.modified?.();
    this.listeners.layersChanged?.();
  }

  /** viewport(canvas element) 사이즈 변경 — 컨테이너 크기에 맞춤 */
  setViewportSize(w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    this.canvas.setDimensions({ width: w, height: h });
    this.canvas.requestRenderAll();
  }

  private bindEvents() {
    const onSelChange = () => {
      const obj = this.canvas.getActiveObject();
      // paper나 미리보기 객체가 어쩌다 선택됐다면 즉시 해제
      if (obj && (isPaperObj(obj) || (obj as any)._preview)) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        this.emitSelection();
        return;
      }
      // 선택된 객체의 layerGroupId가 있으면 그 레이어를 활성으로
      if (obj && (obj as any).layerGroupId) {
        this._activeLayerId = (obj as any).layerGroupId;
      }
      this.emitSelection();
    };
    this.canvas.on('selection:created', onSelChange);
    this.canvas.on('selection:updated', onSelChange);
    this.canvas.on('selection:cleared', () => this.emitSelection());
    this.canvas.on('object:modified', () => {
      this.snapshot();
      this.listeners.modified?.();
    });
    this.canvas.on('object:added', () => {
      this.listeners.layersChanged?.();
      this.listeners.modified?.();
    });
    this.canvas.on('object:removed', () => {
      this.listeners.layersChanged?.();
      this.listeners.modified?.();
    });
    // 브러시/펜이 path 객체를 자동 생성하면 활성 레이어에 부여 + marquee clipPath 적용
    this.canvas.on('path:created', (opt: any) => {
      const path = opt?.path;
      if (path) {
        const layerGroupId = this._activeLayerId ?? this.createLayer('레이어 1', 'drawing').id;
        Object.assign(path, {
          layerId: uuid(),
          layerGroupId,
          layerKind: 'drawing',
          layerName: '브러시',
          blendMode: 'normal',
        });
        // 선택 영역(marquee)이 활성이면 이 영역 내에서만 그려지도록 clipPath 적용
        if (this.marqueeBounds) {
          const m = this.marqueeBounds;
          path.clipPath = new fabric.Rect({
            left: m.left + m.width / 2,
            top: m.top + m.height / 2,
            width: m.width,
            height: m.height,
            originX: 'center',
            originY: 'center',
            absolutePositioned: true,
          });
        }
      }
      this.snapshot();
      this.listeners.modified?.();
      this.listeners.layersChanged?.();
    });

    // 마우스 휠 — 포토샵 스타일
    //   휠         = 상하 스크롤
    //   Shift+휠   = 좌우 스크롤
    //   Ctrl+휠    = 줌
    this.canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        let zoom = this.canvas.getZoom();
        zoom *= 0.999 ** e.deltaY;
        zoom = Math.min(Math.max(0.05, zoom), 16);
        this.canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), zoom);
        this.viewportZoom = zoom;
        this.listeners.zoomChanged?.(zoom);
      } else {
        const vpt = this.canvas.viewportTransform!;
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        vpt[4] -= dx;
        vpt[5] -= dy;
        this.canvas.setViewportTransform(vpt);
      }
    });

    // 스페이스 + 드래그 = 패닝 (간이)
    let isPanning = false;
    let lastX = 0, lastY = 0;
    let spaceHeld = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceHeld = true; this.canvas.defaultCursor = 'grab'; }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceHeld = false; this.canvas.defaultCursor = 'default'; }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.canvas.on('mouse:down', (opt) => {
      if (spaceHeld) {
        isPanning = true;
        const e = opt.e as MouseEvent;
        lastX = e.clientX; lastY = e.clientY;
        this.canvas.selection = false;
      }
    });
    this.canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const e = opt.e as MouseEvent;
        const vpt = this.canvas.viewportTransform!;
        vpt[4] += e.clientX - lastX;
        vpt[5] += e.clientY - lastY;
        this.canvas.setViewportTransform(vpt);
        lastX = e.clientX; lastY = e.clientY;
      }
    });
    this.canvas.on('mouse:up', () => {
      if (isPanning) {
        isPanning = false;
        this.canvas.selection = true;
      }
    });
  }

  private emitSelection() {
    const active = this.canvas.getActiveObjects();
    this.listeners.selection?.(active);
  }

  // ─────────────── 사이즈 / 배경 ───────────────

  /** 종이(작업) 사이즈 변경 — viewport는 그대로 */
  resizeCanvas(width: number, height: number) {
    this.width = width;
    this.height = height;
    if (this.paperRect) {
      this.paperRect.set({ width, height });
      this.paperRect.setCoords();
    }
    this.canvas.requestRenderAll();
  }

  setBackground(color: string) {
    this.background = color;
    if (this.paperRect) {
      const fill = color === 'transparent' || !color ? 'rgba(0,0,0,0)' : color;
      this.paperRect.set('fill', fill as any);
    }
    this.canvas.requestRenderAll();
  }

  zoomTo(zoom: number, center?: { x: number; y: number }) {
    const z = Math.min(Math.max(0.05, zoom), 16);
    const c = center
      ? new fabric.Point(center.x, center.y)
      : new fabric.Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2);
    this.canvas.zoomToPoint(c, z);
    this.viewportZoom = z;
    this.listeners.zoomChanged?.(z);
  }

  fitToScreen(containerW: number, containerH: number) {
    const padding = 80;
    const z = Math.min(
      (containerW - padding) / this.width,
      (containerH - padding) / this.height,
    );
    const zoom = Math.max(0.05, Math.min(z, 8));
    this.canvas.setZoom(zoom);
    // 중앙 정렬
    const vpt = this.canvas.viewportTransform!;
    vpt[4] = (containerW - this.width * zoom) / 2;
    vpt[5] = (containerH - this.height * zoom) / 2;
    this.canvas.setViewportTransform(vpt);
    this.viewportZoom = zoom;
    this.listeners.zoomChanged?.(zoom);
  }

  resetView() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.viewportZoom = 1;
    this.listeners.zoomChanged?.(1);
  }

  // ─────────────── 객체 추가 (각 도구가 호출) ───────────────

  /**
   * fabric 객체에 PixelLab 메타를 부여한다.
   *  - opts.newLayer = true → 새 레이어 자동 생성하고 거기 소속
   *  - 기본 → 활성 레이어에 소속 (활성 레이어가 없으면 새로 만듦)
   */
  private decorate<T extends fabric.FabricObject>(
    o: T, kind: LayerKind, name: string, opts?: { newLayer?: boolean; layerName?: string },
  ) {
    let groupId: string;
    if (opts?.newLayer || !this._activeLayerId) {
      const layer = this.createLayer(opts?.layerName ?? this.defaultLayerName(kind), kind);
      groupId = layer.id;
    } else {
      groupId = this._activeLayerId;
    }
    Object.assign(o, {
      layerId: uuid(),
      layerGroupId: groupId,
      layerKind: kind,
      layerName: name,
      blendMode: 'normal',
    });
    return o as T & ExtraProps;
  }

  private defaultLayerName(kind: LayerKind): string {
    const sameKindCount = this._layers.filter((l) => l.kind === kind).length;
    const base: Record<LayerKind, string> = {
      image: '이미지', text: '텍스트', shape: '도형', drawing: '레이어',
      adjustment: '조정', group: '그룹',
    };
    return `${base[kind]} ${sameKindCount + 1}`;
  }

  // ─────────────── 레이어 관리 ───────────────

  get layers(): LayerMeta[] { return this._layers; }
  get activeLayerId(): string | null { return this._activeLayerId; }

  /** 새 레이어를 만들고 활성으로 설정. 기본은 빈 'drawing' 레이어 */
  createLayer(name?: string, kind: LayerKind = 'drawing'): LayerMeta {
    const id = uuid();
    const meta: LayerMeta = {
      id,
      name: name ?? `레이어 ${this._layers.length + 1}`,
      kind,
      visible: true, locked: false, opacity: 1, blendMode: 'normal',
      fabricId: id,
    };
    // 가장 위에 추가
    this._layers.unshift(meta);
    this._activeLayerId = id;
    this.snapshot();
    this.listeners.layersChanged?.();
    return meta;
  }

  /** 외부에서 layer 메타 배열 주입 (프로젝트 로드 시) */
  setLayers(layers: LayerMeta[]) {
    this._layers = [...layers];
    if (!this._layers.find((l) => l.id === this._activeLayerId)) {
      this._activeLayerId = this._layers[0]?.id ?? null;
    }
    this.listeners.layersChanged?.();
  }

  setActiveLayer(id: string) {
    if (!this._layers.find((l) => l.id === id)) return;
    this._activeLayerId = id;
    this.listeners.layersChanged?.();
  }

  /** 레이어를 삭제 — 그 레이어에 속한 fabric 객체도 모두 제거 */
  removeLayer(id: string) {
    this.canvas.getObjects().forEach((o) => {
      if ((o as any).layerGroupId === id) this.canvas.remove(o);
    });
    this._layers = this._layers.filter((l) => l.id !== id);
    if (this._activeLayerId === id) {
      this._activeLayerId = this._layers[0]?.id ?? null;
    }
    this.canvas.requestRenderAll();
    this.snapshot();
    this.listeners.layersChanged?.();
  }

  /**
   * 여러 레이어 병합 — 보이는 z-순서(top-first)대로 통합.
   * 가장 위 레이어로 흡수되고 나머지 레이어 메타는 제거. 객체들의 layerGroupId만 변경.
   */
  mergeLayers(idsTopFirst: string[]): string | null {
    if (idsTopFirst.length < 2) return null;
    // 가장 위(첫 번째)로 흡수
    const target = idsTopFirst[0];
    const others = new Set(idsTopFirst.slice(1));
    this.canvas.getObjects().forEach((o) => {
      if (others.has((o as any).layerGroupId)) {
        (o as any).layerGroupId = target;
      }
    });
    this._layers = this._layers.filter((l) => l.id === target || !others.has(l.id));
    // 병합된 레이어는 'drawing'(혼합)으로 표시
    const t = this._layers.find((l) => l.id === target);
    if (t) t.kind = 'drawing';
    this._activeLayerId = target;
    this.canvas.requestRenderAll();
    this.snapshot();
    this.listeners.layersChanged?.();
    return target;
  }

  /** 같은 layerGroupId의 모든 fabric 객체 반환 */
  findObjectsByLayerId(id: string): fabric.FabricObject[] {
    return this.canvas.getObjects().filter((o) => (o as any).layerGroupId === id);
  }

  /** 활성 레이어 보장 — 없으면 새로 만들고 id 반환 */
  ensureActiveLayer(): string {
    if (this._activeLayerId && this._layers.find((l) => l.id === this._activeLayerId)) {
      return this._activeLayerId;
    }
    return this.createLayer().id;
  }

  /** 외부 코드(useToolInteractions 등)가 직접 객체를 add한 뒤 z-order 정렬을 요청 */
  applyLayerOrder() { this.applyLayerOrderToCanvas(); }

  addRect(opts: { x: number; y: number; w: number; h: number; fill: string; stroke?: string; strokeWidth?: number }) {
    const obj = new fabric.Rect({
      left: opts.x, top: opts.y, width: opts.w, height: opts.h,
      fill: opts.fill, stroke: opts.stroke ?? '', strokeWidth: opts.strokeWidth ?? 0,
      strokeUniform: true,
    });
    this.decorate(obj, 'shape', '사각형');
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.snapshot();
    return obj;
  }

  addEllipse(opts: { x: number; y: number; rx: number; ry: number; fill: string; stroke?: string; strokeWidth?: number }) {
    const obj = new fabric.Ellipse({
      left: opts.x, top: opts.y, rx: opts.rx, ry: opts.ry,
      fill: opts.fill, stroke: opts.stroke ?? '', strokeWidth: opts.strokeWidth ?? 0,
      strokeUniform: true,
    });
    this.decorate(obj, 'shape', '원');
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.snapshot();
    return obj;
  }

  addLine(opts: { x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number }) {
    const obj = new fabric.Line([opts.x1, opts.y1, opts.x2, opts.y2], {
      stroke: opts.stroke, strokeWidth: opts.strokeWidth, strokeUniform: true,
    });
    this.decorate(obj, 'shape', '선');
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.snapshot();
    return obj;
  }

  addPolygon(points: { x: number; y: number }[], opts: { fill: string; stroke?: string; strokeWidth?: number }) {
    const obj = new fabric.Polygon(points, {
      fill: opts.fill, stroke: opts.stroke ?? '', strokeWidth: opts.strokeWidth ?? 0,
      strokeUniform: true, objectCaching: false,
    });
    this.decorate(obj, 'shape', '다각형');
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.snapshot();
    return obj;
  }

  addText(text: string, opts: {
    x: number; y: number; fontFamily: string; fontSize: number; fill: string;
    fontWeight?: string | number; fontStyle?: string; underline?: boolean; textAlign?: string;
  }) {
    const obj = new fabric.IText(text, {
      left: opts.x, top: opts.y,
      fontFamily: opts.fontFamily, fontSize: opts.fontSize,
      fill: opts.fill, fontWeight: opts.fontWeight ?? 'normal',
      fontStyle: opts.fontStyle ?? 'normal' as 'normal',
      underline: opts.underline ?? false,
      textAlign: (opts.textAlign as any) ?? 'left',
      editable: true,
      cursorColor: '#FFAE00',
    });
    this.decorate(obj, 'text', text.slice(0, 20) || '텍스트', { newLayer: true });
    this.canvas.add(obj);
    this.canvas.setActiveObject(obj);
    this.applyLayerOrderToCanvas();
    this.snapshot();
    return obj;
  }

  async addImageFromURL(url: string, opts?: { x?: number; y?: number; maxFit?: boolean }) {
    const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    img.set({
      left: opts?.x ?? this.width / 2,
      top: opts?.y ?? this.height / 2,
      originX: 'center', originY: 'center',
      // 사진은 모서리 드래그 시 항상 비율 유지 (왜곡 방지)
      lockUniScaling: true,
    });
    // 기본은 원본 크기로 가져옴. 필요 시 호출자가 maxFit:true를 주면 캔버스 80% 박스에 맞춰 축소.
    if (opts?.maxFit === true) {
      const maxW = this.width * 0.8;
      const maxH = this.height * 0.8;
      const s = Math.min(maxW / (img.width ?? 1), maxH / (img.height ?? 1), 1);
      img.scale(s);
    }
    this.decorate(img, 'image', '이미지', { newLayer: true });
    this.canvas.add(img);
    this.canvas.setActiveObject(img);
    this.applyLayerOrderToCanvas();
    this.snapshot();
    return img;
  }

  // ─────────────── 브러시 / 지우개 ───────────────

  enableFreeDraw(color: string, width: number, eraser = false) {
    this.canvas.isDrawingMode = true;
    if (eraser) {
      // fabric v6에서는 EraserBrush가 별도 패키지 — 임시로 캔버스 배경색으로 그리는 식
      const brush = new fabric.PencilBrush(this.canvas);
      brush.color = this.background;
      brush.width = width;
      this.canvas.freeDrawingBrush = brush;
    } else {
      const brush = new fabric.PencilBrush(this.canvas);
      brush.color = color;
      brush.width = width;
      this.canvas.freeDrawingBrush = brush;
    }
  }

  disableFreeDraw() {
    this.canvas.isDrawingMode = false;
  }

  // ─────────────── 변형 ───────────────

  deleteActive() {
    // paper / 미리보기 객체는 절대 삭제되지 않도록 가드
    const objs = this.canvas.getActiveObjects()
      .filter((o) => !isPaperObj(o) && !(o as any)._preview);
    if (objs.length === 0) return;
    objs.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  duplicateActive() {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.clone(EXTRA_PROP_KEYS as unknown as string[]).then((clone: fabric.FabricObject) => {
      clone.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 });
      // 새 layerId 부여
      Object.assign(clone, { layerId: uuid() });
      this.canvas.add(clone);
      this.canvas.setActiveObject(clone);
      this.snapshot();
    });
  }

  rotate(deg: number) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    obj.rotate(((obj.angle ?? 0) + deg) % 360);
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  flip(axis: 'x' | 'y') {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    if (axis === 'x') obj.set('flipX', !obj.flipX);
    else obj.set('flipY', !obj.flipY);
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  /** 활성 객체의 소속 레이어를 한 단계 앞으로 (레이어 단위로 이동) */
  bringForward() { this.moveActiveLayer(-1); }
  sendBackward() { this.moveActiveLayer(+1); }
  bringToFront() { this.moveActiveLayer(-Infinity); }
  sendToBack() { this.moveActiveLayer(+Infinity); }

  private moveActiveLayer(deltaIndex: number) {
    const gid = this.getActiveLayerId();
    if (!gid) return;
    const idx = this._layers.findIndex((l) => l.id === gid);
    if (idx < 0) return;
    const newIdx = deltaIndex === -Infinity ? 0
      : deltaIndex === +Infinity ? this._layers.length - 1
      : Math.max(0, Math.min(this._layers.length - 1, idx + deltaIndex));
    if (newIdx === idx) return;
    const next = [...this._layers];
    const [moved] = next.splice(idx, 1);
    next.splice(newIdx, 0, moved);
    this._layers = next;
    this.applyLayerOrderToCanvas();
    this.snapshot();
    this.listeners.layersChanged?.();
  }

  // ─────────────── 정렬 ───────────────

  alignToCanvas(direction: 'left' | 'right' | 'top' | 'bottom' | 'center-h' | 'center-v') {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;
    const w = obj.getScaledWidth();
    const h = obj.getScaledHeight();
    const originX = obj.originX ?? 'left';
    const originY = obj.originY ?? 'top';
    const dx = originX === 'center' ? w / 2 : originX === 'right' ? w : 0;
    const dy = originY === 'center' ? h / 2 : originY === 'bottom' ? h : 0;
    switch (direction) {
      case 'left': obj.set({ left: dx }); break;
      case 'right': obj.set({ left: this.width - w + dx }); break;
      case 'top': obj.set({ top: dy }); break;
      case 'bottom': obj.set({ top: this.height - h + dy }); break;
      case 'center-h': obj.set({ left: (this.width - w) / 2 + dx }); break;
      case 'center-v': obj.set({ top: (this.height - h) / 2 + dy }); break;
    }
    obj.setCoords();
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  // ─────────────── 레이어 메타 추출 ───────────────

  getLayerMetas(): LayerMeta[] {
    // 레이어 레지스트리 그대로 반환 (top-first). _layers 빈 경우 fabric 객체에서 추론.
    if (this._layers.length === 0) {
      // 호환성: 외부에서 만들어진 객체에 layerGroupId가 없으면 단일 레이어로 묶기
      this.rebuildLayersFromObjects();
    }
    return [...this._layers];
  }

  /** fabric 객체들의 layerGroupId를 기반으로 _layers 재구성 (로드 후 fallback) */
  private rebuildLayersFromObjects() {
    const seen = new Map<string, LayerMeta>();
    const orderedTop: string[] = [];
    const objs = this.canvas.getObjects().filter((o) => !isPaperObj(o)).slice().reverse();
    for (const o of objs) {
      const ext = o as any;
      let gid: string = ext.layerGroupId;
      if (!gid) {
        gid = uuid();
        ext.layerGroupId = gid;
      }
      if (!seen.has(gid)) {
        seen.set(gid, {
          id: gid,
          name: ext.layerName ?? `레이어 ${seen.size + 1}`,
          kind: ext.layerKind ?? 'drawing',
          visible: o.visible ?? true,
          locked: !!(o.lockMovementX && o.lockMovementY),
          opacity: o.opacity ?? 1,
          blendMode: ext.blendMode ?? 'normal',
          fabricId: gid,
        });
        orderedTop.push(gid);
      }
    }
    this._layers = orderedTop.map((id) => seen.get(id)!).filter(Boolean);
    if (!this._activeLayerId || !this._layers.find((l) => l.id === this._activeLayerId)) {
      this._activeLayerId = this._layers[0]?.id ?? null;
    }
  }

  findByLayerId(id: string): fabric.FabricObject | undefined {
    return this.canvas.getObjects().find((o) => (o as any).layerGroupId === id);
  }

  setLayerProp(id: string, patch: Partial<LayerMeta>) {
    const meta = this._layers.find((l) => l.id === id);
    if (!meta) return;
    if (patch.visible !== undefined) meta.visible = patch.visible;
    if (patch.opacity !== undefined) meta.opacity = patch.opacity;
    if (patch.locked !== undefined) meta.locked = patch.locked;
    if (patch.blendMode !== undefined) meta.blendMode = patch.blendMode;
    if (patch.name !== undefined) meta.name = patch.name;
    if (patch.kind !== undefined) meta.kind = patch.kind;
    // 그룹 안 모든 객체에 적용
    const objs = this.findObjectsByLayerId(id);
    for (const obj of objs) {
      if (patch.visible !== undefined) obj.visible = patch.visible;
      if (patch.opacity !== undefined) obj.set('opacity', patch.opacity);
      if (patch.locked !== undefined) {
        const lock = patch.locked;
        obj.set({
          lockMovementX: lock, lockMovementY: lock,
          lockScalingX: lock, lockScalingY: lock, lockRotation: lock,
          selectable: !lock, evented: !lock,
        });
      }
      if (patch.blendMode !== undefined) {
        (obj as any).blendMode = patch.blendMode;
        obj.globalCompositeOperation = blendToComposite(patch.blendMode);
      }
    }
    this.canvas.requestRenderAll();
    this.listeners.layersChanged?.();
  }

  /** 레이어를 선택 = 그 그룹의 모든 객체를 선택 */
  selectByLayerId(id: string, additive = false) {
    const objs = this.findObjectsByLayerId(id);
    if (objs.length === 0) {
      // 빈 레이어 — 활성만 변경
      this.setActiveLayer(id);
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      return;
    }
    this.setActiveLayer(id);
    if (additive) {
      const current = this.canvas.getActiveObjects();
      const merged = [...new Set([...current, ...objs])];
      const sel = new fabric.ActiveSelection(merged, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    } else if (objs.length === 1) {
      this.canvas.setActiveObject(objs[0]);
    } else {
      const sel = new fabric.ActiveSelection(objs, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    }
    this.canvas.requestRenderAll();
  }

  /** 레이어 순서 변경 (top-first) — fabric z-order도 함께 재정렬 */
  reorderByLayerIds(idsTopFirst: string[]) {
    const map = new Map(this._layers.map((l) => [l.id, l]));
    this._layers = idsTopFirst.map((id) => map.get(id)!).filter(Boolean);
    this.applyLayerOrderToCanvas();
    this.snapshot();
    this.listeners.layersChanged?.();
  }

  /** _layers 순서대로 fabric 객체 z-order 재정렬 (paper가 있으면 항상 z=0) */
  private applyLayerOrderToCanvas() {
    const byGroup = new Map<string, fabric.FabricObject[]>();
    for (const o of this.canvas.getObjects()) {
      if (isPaperObj(o)) continue;
      const gid = (o as any).layerGroupId ?? '__orphan__';
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid)!.push(o);
    }
    let z = 0;
    if (this.paperRect) {
      this.canvas.moveObjectTo(this.paperRect, z++);
    }
    // bottom-first 순서로 z 할당
    const orderBottomFirst = [...this._layers].reverse();
    for (const layer of orderBottomFirst) {
      const objs = byGroup.get(layer.id) ?? [];
      for (const o of objs) {
        this.canvas.moveObjectTo(o, z++);
      }
    }
    // orphan (메타에 없는 그룹) — 가장 위로
    const known = new Set(this._layers.map((l) => l.id));
    for (const [gid, objs] of byGroup.entries()) {
      if (!known.has(gid)) for (const o of objs) this.canvas.moveObjectTo(o, z++);
    }
    this.canvas.requestRenderAll();
  }

  // ─────────────── 필터 (이미지 객체 대상) ───────────────

  applyImageFilters(layerId: string, filters: {
    brightness: number; contrast: number; saturation: number; hue: number;
    blur: number; sharpen: number; grayscale: boolean; sepia: boolean; invert: boolean; vignette: number;
  }) {
    const obj = this.findByLayerId(layerId);
    if (!obj || !(obj instanceof fabric.FabricImage)) return;
    const f: fabric.filters.BaseFilter<string>[] = [];
    if (filters.brightness) f.push(new fabric.filters.Brightness({ brightness: filters.brightness }));
    if (filters.contrast) f.push(new fabric.filters.Contrast({ contrast: filters.contrast }));
    if (filters.saturation) f.push(new fabric.filters.Saturation({ saturation: filters.saturation }));
    if (filters.hue) f.push(new fabric.filters.HueRotation({ rotation: (filters.hue / 180) * Math.PI }));
    if (filters.blur) f.push(new fabric.filters.Blur({ blur: filters.blur }));
    if (filters.grayscale) f.push(new fabric.filters.Grayscale());
    if (filters.sepia) f.push(new fabric.filters.Sepia());
    if (filters.invert) f.push(new fabric.filters.Invert());
    if (filters.vignette) f.push(new fabric.filters.Vibrance({ vibrance: -filters.vignette })); // 임시 — 실제 vignette는 자체 구현 필요
    obj.filters = f;
    obj.applyFilters();
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  // 이미지 데이터를 dataURL로 갱신 (배경제거 결과 적용)
  async replaceImageSrc(layerId: string, dataUrl: string) {
    const obj = this.findByLayerId(layerId);
    if (!obj || !(obj instanceof fabric.FabricImage)) return;
    await obj.setSrc(dataUrl, { crossOrigin: 'anonymous' });
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  getActiveImageDataUrl(): string | null {
    const obj = this.canvas.getActiveObject();
    if (!obj || !(obj instanceof fabric.FabricImage)) return null;
    return obj.toDataURL({ format: 'png', multiplier: 1 });
  }

  /** 현재 선택된 객체의 소속 레이어 (없으면 활성 레이어) */
  getActiveLayerId(): string | null {
    const obj = this.canvas.getActiveObject();
    if (obj) return (obj as any).layerGroupId ?? this._activeLayerId;
    return this._activeLayerId;
  }

  // ─────────────── 자르기 (캔버스 자체) ───────────────

  cropCanvasTo(rect: { left: number; top: number; width: number; height: number }) {
    const nw = Math.round(rect.width);
    const nh = Math.round(rect.height);
    // paper 외의 모든 객체를 -rect.left, -rect.top 만큼 이동
    this.canvas.getObjects().forEach((o) => {
      if (isPaperObj(o)) return;
      o.left = (o.left ?? 0) - rect.left;
      o.top = (o.top ?? 0) - rect.top;
      o.setCoords();
    });
    // paper 사이즈 갱신 + 위치 (0,0)
    this.width = nw;
    this.height = nh;
    if (this.paperRect) {
      this.paperRect.set({ left: 0, top: 0, width: nw, height: nh });
      this.paperRect.setCoords();
    }
    this.canvas.requestRenderAll();
    this.snapshot();
  }

  // ─────────────── 직렬화 / 내보내기 ───────────────

  toJSON(): unknown {
    // 도구 미리보기용 임시 객체(_preview)는 직렬화 대상에서 제외
    const json = this.canvas.toJSON() as any;
    if (json && Array.isArray(json.objects)) {
      json.objects = json.objects.filter((o: any) => !o._preview);
    }
    return json;
  }

  async loadFromJSON(json: unknown) {
    this.suspendHistory = true;
    await this.canvas.loadFromJSON(json as any);
    // blend mode 재적용
    this.canvas.getObjects().forEach((o) => {
      const ext = o as any;
      if (ext.blendMode) o.globalCompositeOperation = blendToComposite(ext.blendMode);
    });
    // paper 복구 — 직렬화된 JSON에 paper가 있으면 그걸 사용, 없으면 새로 추가
    this.paperRect = this.canvas.getObjects().find(isPaperObj) as fabric.Rect | null;
    if (!this.paperRect) {
      this.addPaperRect();
    } else {
      this.width = this.paperRect.width ?? this.width;
      this.height = this.paperRect.height ?? this.height;
      this.restorePaperZ();
    }
    this.canvas.requestRenderAll();
    this.suspendHistory = false;
    this.snapshot();
    this.listeners.layersChanged?.();
  }

  /**
   * 보이는 모든 객체(paper / 미리보기 제외)의 bounding box를 fabric 좌표로 반환.
   * 객체가 하나도 없으면 null. export는 캔버스 사이즈가 아닌 이 bbox로 추출됨.
   */
  getContentBoundingBox(): { left: number; top: number; width: number; height: number } | null {
    const objs = this.canvas.getObjects().filter(
      (o) => !isPaperObj(o) && !(o as any)._preview && o.visible !== false,
    );
    if (objs.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of objs) {
      const r = o.getBoundingRect();
      if (!isFinite(r.left) || !isFinite(r.top)) continue;
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.left + r.width);
      maxY = Math.max(maxY, r.top + r.height);
    }
    if (!isFinite(minX) || !isFinite(maxX)) return null;
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  // 작업한 객체들의 bbox 영역을 dataURL로 출력.
  // 캔버스 사이즈 무관 — 사진을 가져와서 어디에 두든, 그 객체 자체 사이즈로 정확히 추출됨.
  // viewport zoom/팬, 디바이스 픽셀 비율(retina) 모두 격리.
  private exportRegion(opts: { format: 'png' | 'jpeg' | 'webp'; multiplier: number; quality?: number }): string {
    const bbox = this.getContentBoundingBox();
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      throw new Error('저장할 내용이 없습니다. 사진이나 도형을 먼저 추가해주세요.');
    }
    const mul = opts.multiplier || 1;
    const mime = opts.format === 'jpeg' ? 'image/jpeg'
      : opts.format === 'webp' ? 'image/webp' : 'image/png';

    const previews = this.canvas.getObjects().filter((o: any) => o._preview);
    const oldVis = previews.map((o) => o.visible);
    previews.forEach((o) => { o.visible = false; });

    const oldVPT = [...(this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])];
    const oldRetina = (this.canvas as any).enableRetinaScaling;

    try {
      // viewport zoom/팬과 retina 영향을 제거한 상태에서 추출
      (this.canvas as any).enableRetinaScaling = false;
      this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      this.canvas.renderAll();

      // fabric 표준 API — viewport 무관하게 bbox 영역을 multiplier 배율로 출력
      const el = (this.canvas as any).toCanvasElement(mul, {
        left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height,
      });
      return (el as HTMLCanvasElement).toDataURL(mime, opts.quality);
    } finally {
      this.canvas.setViewportTransform(oldVPT as any);
      (this.canvas as any).enableRetinaScaling = oldRetina;
      previews.forEach((o, i) => { o.visible = oldVis[i] ?? true; });
      this.canvas.requestRenderAll();
    }
  }

  // 투명 내보내기를 위해 paper를 잠시 비가시 상태로 만들고 복구.
  // 점선 외곽선(stroke)도 같이 빼서 export에 끼지 않도록.
  private withTransparentPaper<T>(fn: () => T): T {
    const oldFill = this.paperRect?.fill;
    const oldStroke = this.paperRect?.stroke;
    const oldShadow = this.paperRect?.shadow;
    const oldBg = this.canvas.backgroundColor;
    if (this.paperRect) {
      this.paperRect.set({ fill: 'rgba(0,0,0,0)', stroke: '', shadow: null });
    } else {
      this.canvas.backgroundColor = 'rgba(0,0,0,0)' as any;
    }
    this.canvas.requestRenderAll();
    try {
      return fn();
    } finally {
      if (this.paperRect) {
        this.paperRect.set({
          fill: oldFill as any,
          stroke: oldStroke as any,
          shadow: oldShadow ?? null,
        });
      } else {
        this.canvas.backgroundColor = oldBg;
      }
      this.canvas.requestRenderAll();
    }
  }

  // PNG/WebP는 항상 종이 색을 무시하고 빈 영역을 투명 처리.
  // 종이는 작업용 캔버스이고 export는 객체만.
  exportPNG(_scale = 1, _transparent = false): string {
    const run = () => this.exportRegion({ format: 'png', multiplier: 1 });
    return this.withTransparentPaper(run);
  }

  exportJPG(_scale = 1, quality = 0.92): string {
    // JPG는 투명 미지원 → 흰색 배경으로 출력 (paper 색·stroke 무시)
    const oldFill = this.paperRect?.fill;
    const oldStroke = this.paperRect?.stroke;
    const oldShadow = this.paperRect?.shadow;
    const oldBg = this.canvas.backgroundColor;
    if (this.paperRect) {
      this.paperRect.set({ fill: '#ffffff', stroke: '', shadow: null });
    } else {
      this.canvas.backgroundColor = '#ffffff' as any;
    }
    this.canvas.requestRenderAll();
    try {
      return this.exportRegion({ format: 'jpeg', multiplier: 1, quality });
    } finally {
      if (this.paperRect) {
        this.paperRect.set({
          fill: oldFill as any,
          stroke: oldStroke as any,
          shadow: oldShadow ?? null,
        });
      } else {
        this.canvas.backgroundColor = oldBg;
      }
      this.canvas.requestRenderAll();
    }
  }

  exportWebP(_scale = 1, quality = 0.92, _transparent = false): string {
    const run = () => this.exportRegion({ format: 'webp', multiplier: 1, quality });
    return this.withTransparentPaper(run);
  }

  // ─────────────── 히스토리 ───────────────

  snapshot() {
    if (this.suspendHistory) return;
    const json = JSON.stringify(this.toJSON());
    if (this.history[this.historyIndex] === json) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(json);
    if (this.history.length > this.historyMax) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  canUndo() { return this.historyIndex > 0; }
  canRedo() { return this.historyIndex < this.history.length - 1; }

  private async loadHistoryAt(index: number) {
    this.historyIndex = index;
    this.suspendHistory = true;
    await this.canvas.loadFromJSON(JSON.parse(this.history[index]));
    this.canvas.getObjects().forEach((o) => {
      const ext = o as any;
      if (ext.blendMode) o.globalCompositeOperation = blendToComposite(ext.blendMode);
    });
    this.paperRect = this.canvas.getObjects().find(isPaperObj) as fabric.Rect | null;
    if (!this.paperRect) {
      this.addPaperRect();
    } else {
      this.width = this.paperRect.width ?? this.width;
      this.height = this.paperRect.height ?? this.height;
      this.restorePaperZ();
    }
    this.canvas.requestRenderAll();
    this.suspendHistory = false;
    this.listeners.layersChanged?.();
    this.listeners.modified?.();
  }

  async undo() {
    if (!this.canUndo()) return;
    await this.loadHistoryAt(this.historyIndex - 1);
  }

  async redo() {
    if (!this.canRedo()) return;
    await this.loadHistoryAt(this.historyIndex + 1);
  }

  dispose() {
    this.canvas.dispose();
  }
}

function blendToComposite(b: BlendMode): GlobalCompositeOperation {
  return (b === 'normal' ? 'source-over' : b) as GlobalCompositeOperation;
}

// 투명 배경 표시용 체커보드 패턴 — 종이 fill로 사용
let _checkerCache: fabric.Pattern | null = null;
function createCheckerPattern(): fabric.Pattern | null {
  if (_checkerCache) return _checkerCache;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#d4d4d4';
  ctx.fillRect(0, 0, 8, 8);
  ctx.fillRect(8, 8, 8, 8);
  _checkerCache = new fabric.Pattern({ source: c, repeat: 'repeat' });
  return _checkerCache;
}
