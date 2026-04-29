import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CanvasManager } from '../canvas/CanvasManager';
import { CanvasManagerContext } from '../canvas/canvasContext';
import { useProjectStore } from '../store/projectStore';
import { TopBar } from './TopBar';
import { Toolbar } from './Toolbar';
import { LayersPanel } from './LayersPanel';
import { RightPanel } from './RightPanel';
import { useToolInteractions } from '../hooks/useToolInteractions';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export function CanvasView() {
  const project = useProjectStore((s) => s.project);
  const setLayers = useProjectStore((s) => s.setLayers);
  const selectLayers = useProjectStore((s) => s.selectLayers);
  const setCanvasJSON = useProjectStore((s) => s.setCanvasJSON);
  const setZoom = useProjectStore((s) => s.setZoom);

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [manager, setManager] = useState<CanvasManager | null>(null);

  // 캔버스 매니저 초기화
  useLayoutEffect(() => {
    if (!project || !canvasElRef.current) return;
    const cw = containerRef.current?.clientWidth ?? 1000;
    const ch = containerRef.current?.clientHeight ?? 700;
    const m = new CanvasManager(canvasElRef.current, {
      paperWidth: project.settings.width,
      paperHeight: project.settings.height,
      paperBackground: project.settings.background ?? '#ffffff',
      viewportWidth: cw,
      viewportHeight: ch,
    });
    setManager(m);
    // 저장된 canvasJSON 있으면 로드 — 그 안의 레이어 메타도 매니저에 주입
    if (project.canvasJSON) {
      m.loadFromJSON(project.canvasJSON).then(() => {
        if (project.layers && project.layers.length > 0) m.setLayers(project.layers);
        setLayers(m.getLayerMetas());
      }).catch(() => {});
    } else {
      // 새 프로젝트 — 빈 기본 레이어 1개 자동 생성
      m.createLayer('레이어 1', 'drawing');
      setLayers(m.getLayerMetas());
    }
    // listener
    m.setListeners({
      selection: (objs) => {
        const ids = [...new Set(objs.map((o: any) => o.layerGroupId).filter(Boolean))];
        selectLayers(ids);
      },
      modified: () => {
        setCanvasJSON(m.toJSON());
      },
      layersChanged: () => {
        setLayers(m.getLayerMetas());
      },
      zoomChanged: (z) => setZoom(z),
    });
    // 초기 화면 맞추기
    requestAnimationFrame(() => {
      if (containerRef.current) {
        m.fitToScreen(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    });
    return () => {
      m.dispose();
      setManager(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // 컨테이너 사이즈 변화 → fabric viewport 사이즈 자동 동기화 (줌/팬 상태는 보존)
  useEffect(() => {
    if (!manager || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      manager.setViewportSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [manager]);

  return (
    <CanvasManagerContext.Provider value={manager}>
      <div className="h-full w-full flex flex-col bg-bg-base">
        <TopBar />
        <div className="flex-1 flex min-h-0">
          <Toolbar />
          <div ref={containerRef} className="flex-1 relative bg-[#16161b] overflow-hidden">
            <CanvasArea canvasElRef={canvasElRef} containerRef={containerRef} />
          </div>
          <div className="w-[300px] panel border-l flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <RightPanel />
            </div>
            <div className="border-t border-border-subtle h-[40%] min-h-[200px]">
              <LayersPanel />
            </div>
          </div>
        </div>
      </div>
      <ToolInteractionsBridge />
      <KeyboardBridge />
    </CanvasManagerContext.Provider>
  );
}

function CanvasArea({
  canvasElRef, containerRef,
}: {
  canvasElRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  const project = useProjectStore((s) => s.project);
  if (!project) return null;
  return (
    <>
      <canvas ref={canvasElRef} />
      <ZoomBadge containerRef={containerRef} />
      <ViewportHint />
    </>
  );
}

// 좌하단 안내 — 휠 조작법
function ViewportHint() {
  return (
    <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-bg-elevated/70 backdrop-blur border border-border-subtle text-[10px] text-text-muted leading-relaxed pointer-events-none">
      휠 ↕ · Shift+휠 ↔ · Ctrl+휠 줌 · Space+드래그 패닝
    </div>
  );
}

function ZoomBadge({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const zoom = useProjectStore((s) => s.zoom);
  return (
    <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-bg-elevated/80 backdrop-blur border border-border-subtle text-[11px] text-text-secondary">
      {Math.round(zoom * 100)}%
    </div>
  );
}

function ToolInteractionsBridge() {
  useToolInteractions();
  return null;
}
function KeyboardBridge() {
  useKeyboardShortcuts();
  return null;
}
