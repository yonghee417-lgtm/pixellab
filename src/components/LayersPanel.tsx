import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCanvasManager } from '../canvas/canvasContext';
import { BLEND_MODES, type LayerKind, type BlendMode } from '@shared/types';

const KIND_COLOR: Record<LayerKind, string> = {
  image: 'bg-layer-image',
  text: 'bg-layer-text',
  shape: 'bg-layer-shape',
  drawing: 'bg-layer-drawing',
  adjustment: 'bg-layer-adjustment',
  group: 'bg-layer-group',
};
const KIND_ICON: Record<LayerKind, string> = {
  image: '🖼', text: 'T', shape: '◇', drawing: '✎', adjustment: '◐', group: '⬚',
};

export function LayersPanel() {
  const layers = useProjectStore((s) => s.layers);
  const selected = useProjectStore((s) => s.selectedLayerIds);
  const m = useCanvasManager();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [_tick, setTick] = useState(0);

  // 활성 레이어 표시용 — manager의 activeLayerId를 폴링/이벤트 반영
  useEffect(() => {
    if (!m) return;
    const update = () => {
      setActiveLayerId(m.activeLayerId);
      setTick((t) => t + 1);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [m]);

  if (!m) return null;

  const onSelect = (id: string, additive: boolean) => {
    m.selectByLayerId(id, additive);
    setActiveLayerId(id);
  };

  const onToggleVisible = (id: string, vis: boolean) => {
    m.setLayerProp(id, { visible: !vis });
  };

  const onToggleLock = (id: string, locked: boolean) => {
    m.setLayerProp(id, { locked: !locked });
  };

  const onDeleteLayer = (id: string) => {
    m.removeLayer(id);
  };

  const onAddLayer = () => {
    m.createLayer();
  };

  const onMerge = () => {
    if (selected.length < 2) return;
    // 보이는 순서(top-first)대로 정렬해서 병합
    const ids = layers.filter((l) => selected.includes(l.id)).map((l) => l.id);
    m.mergeLayers(ids);
  };

  const onDragStart = (id: string) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    m.reorderByLayerIds(ids);
    setDraggedId(null);
  };

  const canMerge = selected.length >= 2;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">레이어</h3>
        <div className="flex items-center gap-1">
          <button onClick={onAddLayer} className="btn-ghost text-xs" title="새 레이어 추가">＋</button>
          <button onClick={onMerge} disabled={!canMerge}
            className={`btn-ghost text-xs ${!canMerge ? 'opacity-40 cursor-not-allowed' : ''}`}
            title="선택한 레이어 병합 (최소 2개 선택)"
          >⇊</button>
          <button onClick={() => m.bringForward()} className="btn-ghost text-xs" title="앞으로 (Ctrl+])">↑</button>
          <button onClick={() => m.sendBackward()} className="btn-ghost text-xs" title="뒤로 (Ctrl+[)">↓</button>
          <button onClick={() => m.duplicateActive()} className="btn-ghost text-xs" title="복제 (Ctrl+D)">⎘</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {layers.length === 0 ? (
          <div className="text-text-muted text-xs text-center mt-6 px-4">
            레이어가 없습니다.<br />＋ 버튼으로 추가하세요.
          </div>
        ) : (
          layers.map((l) => {
            const isSelected = selected.includes(l.id);
            const isActive = activeLayerId === l.id;
            return (
              <div
                key={l.id}
                draggable
                onDragStart={() => onDragStart(l.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(l.id)}
                onClick={(e) => onSelect(l.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer border-l-2 ${
                  isSelected
                    ? 'bg-accent-subtle border-accent'
                    : isActive
                      ? 'bg-bg-hover border-warm'
                      : 'border-transparent hover:bg-bg-hover'
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleVisible(l.id, l.visible); }}
                  className="text-xs w-4 text-center"
                  title={l.visible ? '숨기기' : '보이기'}
                >{l.visible ? '👁' : '·'}</button>
                <div className={`w-5 h-5 rounded text-[10px] flex items-center justify-center text-white ${KIND_COLOR[l.kind]}`}>
                  {KIND_ICON[l.kind]}
                </div>
                {renamingId === l.id ? (
                  <input
                    autoFocus
                    defaultValue={l.name}
                    onBlur={(e) => {
                      m.setLayerProp(l.id, { name: e.target.value || l.name });
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); e.stopPropagation(); }}
                    onClick={(e) => e.stopPropagation()}
                    className="input flex-1 py-0.5 text-xs"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(l.id); }}
                    className="text-xs text-text-primary truncate flex-1"
                  >{l.name}{isActive && <span className="ml-1 text-[9px] text-warm">●</span>}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLock(l.id, l.locked); }}
                  className={`text-[10px] ${l.locked ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  title={l.locked ? '잠금 해제' : '잠금'}
                >{l.locked ? '🔒' : '🔓'}</button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteLayer(l.id); }}
                  className="text-[10px] opacity-0 group-hover:opacity-100 hover:text-red-400"
                  title="레이어 삭제"
                >×</button>
              </div>
            );
          })
        )}
      </div>

      {/* 단일 선택 시 — 블렌드/불투명도 */}
      {selected.length === 1 && (() => {
        const l = layers.find((x) => x.id === selected[0]);
        if (!l) return null;
        return (
          <div className="border-t border-border-subtle p-3 space-y-2">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider">블렌드 모드</label>
              <select
                value={l.blendMode}
                onChange={(e) => m.setLayerProp(l.id, { blendMode: e.target.value as BlendMode })}
                className="input w-full mt-1 py-1 text-xs"
              >
                {BLEND_MODES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider flex justify-between">
                <span>불투명도</span><span>{Math.round(l.opacity * 100)}%</span>
              </label>
              <input type="range" min={0} max={1} step={0.01} value={l.opacity}
                onChange={(e) => m.setLayerProp(l.id, { opacity: parseFloat(e.target.value) })}
                className="w-full accent-accent" />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
