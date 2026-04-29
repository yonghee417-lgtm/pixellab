import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  Project, CanvasSettings, CanvasPresetKey, LayerMeta, BlendMode,
} from '@shared/types';
import { CANVAS_PRESETS } from '@shared/types';

export type ToolKey =
  | 'move' | 'select' | 'crop' | 'text' | 'rect' | 'ellipse' | 'line' | 'polygon'
  | 'brush' | 'eraser' | 'eyedropper' | 'hand' | 'magic-eraser' | 'mask' | 'fill';

export type RightPanelTab = 'properties' | 'filters' | 'history' | 'fonts';

interface UIState {
  tool: ToolKey;
  setTool: (t: ToolKey) => void;
  rightTab: RightPanelTab;
  setRightTab: (t: RightPanelTab) => void;

  // 채우기 / 스트로크 (도형, 브러시, 텍스트에서 공유)
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  setFillColor: (c: string) => void;
  setStrokeColor: (c: string) => void;
  setStrokeWidth: (n: number) => void;

  // 브러시 / 텍스트 옵션
  brushSize: number;
  setBrushSize: (n: number) => void;
  textFontFamily: string;
  textFontSize: number;
  setTextFontFamily: (f: string) => void;
  setTextFontSize: (n: number) => void;

  // 가이드 / 그리드 / 룰러 토글
  showGuides: boolean;
  showGrid: boolean;
  showRuler: boolean;
  toggleGuides: () => void;
  toggleGrid: () => void;
  toggleRuler: () => void;

  // 줌 (디스플레이용 — 실제 줌 상태는 캔버스 매니저가 갖고 있음)
  zoom: number;
  setZoom: (z: number) => void;
}

interface ProjectState {
  project: Project | null;
  currentFilePath: string | null;
  selectedLayerIds: string[];
  // canvas 매니저는 store가 직접 갖지 않고 ref로 연결 — 여기는 메타만.
  layers: LayerMeta[];

  // 액션
  createProject: (name: string, presetKey: CanvasPresetKey, custom?: { width: number; height: number; background?: string }) => void;
  loadProject: (project: Project) => void;
  closeProject: () => void;
  setCurrentFilePath: (p: string | null) => void;
  renameProject: (name: string) => void;

  // 레이어 메타 조작 (캔버스 객체와 동기화는 canvasManager에서 따로 호출)
  setLayers: (layers: LayerMeta[]) => void;
  addLayer: (layer: LayerMeta) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<LayerMeta>) => void;
  reorderLayers: (ids: string[]) => void;
  selectLayers: (ids: string[]) => void;

  // 직렬화 (autosave / export)
  setCanvasJSON: (json: unknown) => void;
  setThumbnail: (dataUrl: string) => void;
  getSerializableProject: () => Project | null;
}

type Store = ProjectState & UIState;

const newProjectId = () => uuid();

export const useProjectStore = create<Store>((set, get) => ({
  project: null,
  currentFilePath: null,
  selectedLayerIds: [],
  layers: [],

  // ───── UI ─────
  tool: 'move',
  setTool: (t) => set({ tool: t }),
  rightTab: 'properties',
  setRightTab: (t) => set({ rightTab: t }),

  fillColor: '#FFAE00',
  strokeColor: '#0a0a0c',
  strokeWidth: 0,
  setFillColor: (c) => set({ fillColor: c }),
  setStrokeColor: (c) => set({ strokeColor: c }),
  setStrokeWidth: (n) => set({ strokeWidth: n }),

  brushSize: 8,
  setBrushSize: (n) => set({ brushSize: n }),
  textFontFamily: 'Pretendard-Bold',
  textFontSize: 64,
  setTextFontFamily: (f) => set({ textFontFamily: f }),
  setTextFontSize: (n) => set({ textFontSize: n }),

  showGuides: true,
  showGrid: false,
  showRuler: false,
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleRuler: () => set((s) => ({ showRuler: !s.showRuler })),

  zoom: 1,
  setZoom: (z) => set({ zoom: z }),

  // ───── 프로젝트 ─────
  createProject: (name, presetKey, custom) => {
    const preset = CANVAS_PRESETS[presetKey];
    const settings: CanvasSettings = {
      preset: presetKey,
      width: custom?.width ?? preset.width,
      height: custom?.height ?? preset.height,
      background: custom?.background ?? '#ffffff',
      dpi: presetKey.startsWith('a4') ? 300 : 72,
    };
    const project: Project = {
      id: newProjectId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings,
      canvasJSON: null,
      layers: [],
    };
    set({ project, currentFilePath: null, layers: [], selectedLayerIds: [] });
  },

  loadProject: (project) => {
    set({
      project,
      layers: project.layers ?? [],
      selectedLayerIds: [],
      currentFilePath: null,
    });
  },

  closeProject: () => set({
    project: null,
    layers: [],
    selectedLayerIds: [],
    currentFilePath: null,
  }),

  setCurrentFilePath: (p) => set({ currentFilePath: p }),

  renameProject: (name) => set((s) => s.project ? { project: { ...s.project, name, updatedAt: Date.now() } } : s),

  // ───── 레이어 메타 ─────
  setLayers: (layers) => set((s) => ({
    layers,
    project: s.project ? { ...s.project, layers, updatedAt: Date.now() } : s.project,
  })),

  addLayer: (layer) => set((s) => {
    const layers = [layer, ...s.layers];
    return {
      layers,
      project: s.project ? { ...s.project, layers, updatedAt: Date.now() } : s.project,
      selectedLayerIds: [layer.id],
    };
  }),

  removeLayer: (id) => set((s) => {
    const layers = s.layers.filter((l) => l.id !== id);
    return {
      layers,
      project: s.project ? { ...s.project, layers, updatedAt: Date.now() } : s.project,
      selectedLayerIds: s.selectedLayerIds.filter((sid) => sid !== id),
    };
  }),

  updateLayer: (id, patch) => set((s) => {
    const layers = s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
    return {
      layers,
      project: s.project ? { ...s.project, layers, updatedAt: Date.now() } : s.project,
    };
  }),

  reorderLayers: (ids) => set((s) => {
    const map = new Map(s.layers.map((l) => [l.id, l]));
    const layers = ids.map((id) => map.get(id)!).filter(Boolean);
    return {
      layers,
      project: s.project ? { ...s.project, layers, updatedAt: Date.now() } : s.project,
    };
  }),

  selectLayers: (ids) => set({ selectedLayerIds: ids }),

  // ───── 직렬화 ─────
  setCanvasJSON: (json) => set((s) => s.project ? {
    project: { ...s.project, canvasJSON: json, updatedAt: Date.now() },
  } : s),

  setThumbnail: (dataUrl) => set((s) => s.project ? {
    project: { ...s.project, thumbnail: dataUrl },
  } : s),

  getSerializableProject: () => {
    const s = get();
    if (!s.project) return null;
    return { ...s.project, layers: s.layers };
  },
}));

export const BLEND_TO_GLOBAL_COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  'normal': 'source-over',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'hue',
  'saturation': 'saturation',
  'color': 'color',
  'luminosity': 'luminosity',
};
