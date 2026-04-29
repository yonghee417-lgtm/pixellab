import { useProjectStore, type ToolKey } from '../store/projectStore';
import { useCanvasManager } from '../canvas/canvasContext';

interface Tool {
  key: ToolKey;
  label: string;
  icon: string;
  shortcut?: string;
}

const TOOLS: Tool[][] = [
  [
    { key: 'move', label: '이동', icon: '✥', shortcut: 'V' },
    { key: 'select', label: '선택', icon: '◰', shortcut: 'M' },
    { key: 'hand', label: '손바닥', icon: '✋', shortcut: 'H' },
    { key: 'crop', label: '자르기', icon: '✂', shortcut: 'C' },
  ],
  [
    { key: 'text', label: '텍스트', icon: 'T', shortcut: 'T' },
    { key: 'rect', label: '사각형', icon: '▭', shortcut: 'R' },
    { key: 'ellipse', label: '원', icon: '◯', shortcut: 'O' },
    { key: 'line', label: '선', icon: '╱', shortcut: 'L' },
    { key: 'polygon', label: '다각형', icon: '⬠' },
  ],
  [
    { key: 'brush', label: '브러시', icon: '🖌', shortcut: 'B' },
    { key: 'eraser', label: '지우개', icon: '⌫', shortcut: 'E' },
    { key: 'fill', label: '색 채우기', icon: '🪣', shortcut: 'G' },
    { key: 'magic-eraser', label: '매직 지우개', icon: '✨' },
    { key: 'eyedropper', label: '스포이드', icon: '💧', shortcut: 'I' },
    { key: 'mask', label: '마스크', icon: '◐' },
  ],
];

export function Toolbar() {
  const tool = useProjectStore((s) => s.tool);
  const setTool = useProjectStore((s) => s.setTool);
  const fillColor = useProjectStore((s) => s.fillColor);
  const setFillColor = useProjectStore((s) => s.setFillColor);
  const strokeColor = useProjectStore((s) => s.strokeColor);
  const setStrokeColor = useProjectStore((s) => s.setStrokeColor);
  const m = useCanvasManager();

  const handleClickTool = (k: ToolKey) => {
    setTool(k);
    m?.disableFreeDraw();
  };

  return (
    <div className="w-14 panel border-r flex flex-col items-center py-2 gap-1 flex-shrink-0">
      {TOOLS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1 items-center">
          {group.map((t) => {
            const active = tool === t.key;
            return (
              <button key={t.key}
                onClick={() => handleClickTool(t.key)}
                className={`tool-btn ${active ? 'tool-btn-active' : ''}`}
                title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
              >
                <span className="text-base">{t.icon}</span>
              </button>
            );
          })}
          {gi < TOOLS.length - 1 && <div className="w-6 h-px bg-border-subtle my-1" />}
        </div>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2 pt-2 border-t border-border-subtle w-full">
        <div className="text-[9px] text-text-muted uppercase tracking-wider">색상</div>
        <div className="relative w-10 h-10">
          <input type="color" value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-pointer rounded border-2 border-bg-panel"
            title="선 색"
          />
          <input type="color" value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="absolute top-0 left-0 w-6 h-6 cursor-pointer rounded border-2 border-bg-panel"
            title="채우기 색"
          />
        </div>
        <button
          onClick={() => { setFillColor(strokeColor); setStrokeColor(fillColor); }}
          className="text-[10px] text-text-muted hover:text-text-primary"
          title="색상 교환 (X)"
        >⇄</button>
      </div>
    </div>
  );
}
