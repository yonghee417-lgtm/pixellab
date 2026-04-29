import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCanvasManager } from '../canvas/canvasContext';

export function useKeyboardShortcuts() {
  const m = useCanvasManager();
  const setTool = useProjectStore((s) => s.setTool);
  const setLayers = useProjectStore((s) => s.setLayers);

  useEffect(() => {
    if (!m) return;

    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      // 텍스트 입력 중이면 단축키 무시
      if (isInputFocused()) return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        m.undo().then(() => setLayers(m.getLayerMetas()));
      } else if ((ctrl && e.key.toLowerCase() === 'y') || (ctrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        m.redo().then(() => setLayers(m.getLayerMetas()));
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        m.duplicateActive();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        m.deleteActive();
      } else if (ctrl && e.key === '0') {
        e.preventDefault();
        m.resetView();
      } else if (ctrl && e.key === '=') {
        e.preventDefault();
        m.zoomTo(m.canvas.getZoom() * 1.2);
      } else if (ctrl && e.key === '-') {
        e.preventDefault();
        m.zoomTo(m.canvas.getZoom() / 1.2);
      } else if (ctrl && e.key === ']') {
        e.preventDefault(); m.bringForward();
      } else if (ctrl && e.key === '[') {
        e.preventDefault(); m.sendBackward();
      } else if (e.key === 'v' || e.key === 'V') setTool('move');
      else if (e.key === 'm' || e.key === 'M') setTool('select');
      else if (e.key === 'c' || e.key === 'C') setTool('crop');
      else if (e.key === 't' || e.key === 'T') setTool('text');
      else if (e.key === 'r' || e.key === 'R') setTool('rect');
      else if (e.key === 'o' || e.key === 'O') setTool('ellipse');
      else if (e.key === 'l' || e.key === 'L') setTool('line');
      else if (e.key === 'b' || e.key === 'B') setTool('brush');
      else if (e.key === 'e' || e.key === 'E') setTool('eraser');
      else if (e.key === 'g' || e.key === 'G') setTool('fill');
      else if (e.key === 'i' || e.key === 'I') setTool('eyedropper');
      else if (e.key === 'h' || e.key === 'H') setTool('hand');
      else if (e.key === 'p' || e.key === 'P') setTool('polygon');
      else if (e.key === 'x' || e.key === 'X') {
        const s = useProjectStore.getState();
        const f = s.fillColor; s.setFillColor(s.strokeColor); s.setStrokeColor(f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [m, setTool, setLayers]);
}
