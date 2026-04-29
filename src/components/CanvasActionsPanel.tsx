import { useEffect, useState } from 'react';
import { useCanvasManager } from '../canvas/canvasContext';
import { useProjectStore } from '../store/projectStore';

export function CanvasActionsPanel() {
  const m = useCanvasManager();
  const project = useProjectStore((s) => s.project);
  const showGrid = useProjectStore((s) => s.showGrid);
  const showGuides = useProjectStore((s) => s.showGuides);
  const showRuler = useProjectStore((s) => s.showRuler);
  const toggleGrid = useProjectStore((s) => s.toggleGrid);
  const toggleGuides = useProjectStore((s) => s.toggleGuides);
  const toggleRuler = useProjectStore((s) => s.toggleRuler);

  const [resizeW, setResizeW] = useState(project?.settings.width ?? 1920);
  const [resizeH, setResizeH] = useState(project?.settings.height ?? 1080);
  const [bgColor, setBgColor] = useState(project?.settings.background ?? '#ffffff');
  const [hasPaper, setHasPaper] = useState(true);

  // paper 유무 추적
  useEffect(() => {
    if (!m) return;
    const update = () => setHasPaper(m.hasPaper());
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [m]);

  if (!m || !project) return null;

  const onResize = () => {
    m.resizeCanvas(resizeW, resizeH);
    project.settings.width = resizeW;
    project.settings.height = resizeH;
    m.snapshot();
  };

  const onCropToSelection = () => {
    const a = m.canvas.getActiveObject();
    if (!a) { alert('자를 영역을 사각형으로 선택하세요.'); return; }
    m.cropCanvasTo({
      left: a.left ?? 0, top: a.top ?? 0,
      width: a.getScaledWidth(), height: a.getScaledHeight(),
    });
    m.canvas.remove(a);
    m.canvas.requestRenderAll();
    project.settings.width = Math.round(a.getScaledWidth());
    project.settings.height = Math.round(a.getScaledHeight());
  };

  return (
    <div className="p-3 space-y-4">
      <Section title="캔버스 크기">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-text-muted">너비</label>
            <input type="number" value={resizeW} onChange={(e) => setResizeW(parseInt(e.target.value) || 1)}
              className="input w-full py-1 text-xs mt-0.5" />
          </div>
          <div>
            <label className="text-[10px] text-text-muted">높이</label>
            <input type="number" value={resizeH} onChange={(e) => setResizeH(parseInt(e.target.value) || 1)}
              className="input w-full py-1 text-xs mt-0.5" />
          </div>
        </div>
        <button onClick={onResize} className="btn-secondary w-full text-xs">캔버스 크기 변경</button>
      </Section>

      <Section title="배경 (종이)">
        {hasPaper ? (
          <>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor.startsWith('#') ? bgColor : '#ffffff'}
                onChange={(e) => { setBgColor(e.target.value); m.setBackground(e.target.value); project.settings.background = e.target.value; }}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-border-subtle" />
              <input type="text" value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                onBlur={() => { m.setBackground(bgColor); project.settings.background = bgColor; }}
                className="input flex-1 text-xs py-1 font-mono" />
            </div>
            <button
              onClick={() => { m.setBackground(''); setBgColor('transparent'); project.settings.background = 'transparent'; }}
              className="btn-secondary text-xs w-full"
            >투명 배경 (체커)</button>
            <button
              onClick={() => m.removePaper()}
              className="btn-secondary text-xs w-full hover:!text-red-400"
              title="종이 자체를 제거 — 사진을 캔버스 가득 채워 작업할 때 편리합니다"
            >🗑 배경(종이) 제거</button>
          </>
        ) : (
          <>
            <p className="text-[11px] text-text-muted leading-relaxed">
              종이가 제거되었습니다. 내보내기 시 종이 영역만 추출되며,
              투명 PNG/WebP 옵션을 켜면 빈 영역은 투명 처리됩니다.
            </p>
            <button
              onClick={() => m.addPaper()}
              className="btn-primary text-xs w-full"
            >＋ 배경(종이) 다시 추가</button>
          </>
        )}
      </Section>

      <Section title="자르기">
        <p className="text-[11px] text-text-muted leading-relaxed">
          사각형 도구로 자를 영역을 선택한 뒤 아래 버튼을 누르세요.
          캔버스가 그 사이즈로 잘리고 사각형 가이드는 제거됩니다.
        </p>
        <button onClick={onCropToSelection} className="btn-secondary w-full text-xs">
          ✂ 선택 영역으로 자르기
        </button>
      </Section>

      <Section title="가이드 / 격자">
        <Toggle label="격자" active={showGrid} onClick={toggleGrid} />
        <Toggle label="가이드" active={showGuides} onClick={toggleGuides} />
        <Toggle label="룰러" active={showRuler} onClick={toggleRuler} />
      </Section>

      <Section title="줌">
        <div className="grid grid-cols-3 gap-1">
          <button onClick={() => m.zoomTo(1)} className="btn-secondary text-xs">100%</button>
          <button onClick={() => m.zoomTo(2)} className="btn-secondary text-xs">200%</button>
          <button onClick={() => {
            const c = document.querySelector('canvas')?.parentElement?.parentElement;
            if (c) m.fitToScreen(c.clientWidth, c.clientHeight);
          }} className="btn-secondary text-xs">맞춤</button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] uppercase tracking-wider text-text-muted">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full px-2 py-1.5 text-xs rounded border flex items-center justify-between ${
        active ? 'bg-accent-subtle border-accent text-accent' : 'bg-bg-elevated border-border-subtle text-text-secondary'
      }`}>
      <span>{label}</span>
      <span>{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}
