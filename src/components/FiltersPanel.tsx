import * as fabric from 'fabric';
import { useEffect, useState } from 'react';
import { useCanvasManager } from '../canvas/canvasContext';
import { useProjectStore } from '../store/projectStore';
import { DEFAULT_FILTERS, type FilterState } from '@shared/types';

const PRESETS: { name: string; filters: Partial<FilterState> }[] = [
  { name: '원본', filters: DEFAULT_FILTERS },
  { name: '비비드', filters: { saturation: 0.4, contrast: 0.2, brightness: 0.05 } },
  { name: '소프트', filters: { brightness: 0.1, contrast: -0.1, saturation: -0.1, blur: 0.05 } },
  { name: '흑백', filters: { grayscale: true } },
  { name: '세피아', filters: { sepia: true } },
  { name: '빈티지', filters: { sepia: true, contrast: 0.15, vignette: 0.4 } },
  { name: '시네마틱', filters: { contrast: 0.25, saturation: -0.15, brightness: -0.05 } },
  { name: '쿨톤', filters: { hue: -20, saturation: 0.1 } },
  { name: '웜톤', filters: { hue: 15, saturation: 0.15, brightness: 0.05 } },
];

export function FiltersPanel() {
  const m = useCanvasManager();
  const selected = useProjectStore((s) => s.selectedLayerIds);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // 선택 바뀌면 필터 초기화 (아직 객체에 저장은 안 함 — UI만)
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
  }, [selected[0]]);

  if (!m) return null;
  const obj = m.canvas.getActiveObject();
  const isImage = obj instanceof fabric.FabricImage;

  if (!isImage) {
    return (
      <div className="p-4 text-text-muted text-xs">
        이미지 레이어를 선택하면 필터를 사용할 수 있습니다.
      </div>
    );
  }

  const layerId = (obj as any).layerId as string;

  const apply = (next: FilterState) => {
    setFilters(next);
    m.applyImageFilters(layerId, next);
  };

  const setVal = (k: keyof FilterState, v: number | boolean) => {
    apply({ ...filters, [k]: v as any });
  };

  return (
    <div className="p-3 space-y-4">
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">프리셋</h4>
        <div className="grid grid-cols-3 gap-1">
          {PRESETS.map((p) => (
            <button key={p.name}
              onClick={() => apply({ ...DEFAULT_FILTERS, ...p.filters } as FilterState)}
              className="px-2 py-1.5 text-[11px] rounded bg-bg-elevated border border-border-subtle hover:border-accent text-text-secondary hover:text-accent">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <Slider label="밝기" value={filters.brightness} min={-1} max={1} step={0.01}
        onChange={(v) => setVal('brightness', v)} />
      <Slider label="대비" value={filters.contrast} min={-1} max={1} step={0.01}
        onChange={(v) => setVal('contrast', v)} />
      <Slider label="채도" value={filters.saturation} min={-1} max={1} step={0.01}
        onChange={(v) => setVal('saturation', v)} />
      <Slider label="색조" value={filters.hue} min={-180} max={180} step={1} suffix="°"
        onChange={(v) => setVal('hue', v)} />
      <Slider label="블러" value={filters.blur} min={0} max={1} step={0.01}
        onChange={(v) => setVal('blur', v)} />
      <Slider label="비네팅" value={filters.vignette} min={0} max={1} step={0.01}
        onChange={(v) => setVal('vignette', v)} />

      <div className="grid grid-cols-3 gap-1">
        <Toggle label="흑백" active={filters.grayscale} onClick={() => setVal('grayscale', !filters.grayscale)} />
        <Toggle label="세피아" active={filters.sepia} onClick={() => setVal('sepia', !filters.sepia)} />
        <Toggle label="반전" active={filters.invert} onClick={() => setVal('invert', !filters.invert)} />
      </div>

      <button onClick={() => apply(DEFAULT_FILTERS)} className="btn-secondary w-full text-xs">
        필터 초기화
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-text-secondary mb-1">
        <span>{label}</span>
        <span className="text-text-muted">{Math.round(value * 100) / 100}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent" />
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1.5 text-[11px] rounded border ${
        active ? 'bg-accent-subtle border-accent text-accent' : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary'
      }`}>{label}</button>
  );
}
