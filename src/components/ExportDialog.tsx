import { useState } from 'react';
import type { ExportFormat } from '@shared/types';
import { useCanvasManager } from '../canvas/canvasContext';
import { useProjectStore } from '../store/projectStore';

interface Props { onClose: () => void }

export function ExportDialog({ onClose }: Props) {
  const m = useCanvasManager();
  const project = useProjectStore((s) => s.project);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [busy, setBusy] = useState(false);

  if (!m || !project) return null;

  const onExport = async () => {
    setBusy(true);
    try {
      let dataUrl = '';
      if (format === 'png') dataUrl = m.exportPNG(1);
      else if (format === 'jpg') dataUrl = m.exportJPG(1, quality);
      else if (format === 'webp') dataUrl = m.exportWebP(1, quality);
      const path = await window.api.saveExportDialog(project.name, format);
      if (!path) return;
      const base64 = dataUrl.split(',')[1] ?? '';
      await window.api.writeBuffer(path, base64);
      onClose();
    } catch (e) {
      alert('내보내기 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const w = project.settings.width;
  const h = project.settings.height;
  const showQuality = format === 'jpg' || format === 'webp';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="panel rounded-xl p-6 w-[420px] max-w-[90vw] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-text-primary mb-1">내보내기</h3>
        <p className="text-xs text-text-muted mb-5">출력 크기 {w}×{h}px (캔버스 그대로)</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-muted">포맷</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(['png', 'jpg', 'webp'] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`py-2 rounded border text-sm uppercase ${
                    format === f
                      ? 'bg-accent-subtle border-accent text-accent'
                      : 'bg-bg-elevated border-border-subtle text-text-secondary'
                  }`}>{f}</button>
              ))}
            </div>
          </div>

          {showQuality && (
            <div>
              <label className="text-xs text-text-muted flex justify-between">
                <span>품질</span><span>{Math.round(quality * 100)}%</span>
              </label>
              <input type="range" min={0.1} max={1} step={0.01} value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full accent-accent mt-1" />
            </div>
          )}

          <p className="text-[11px] text-text-muted leading-relaxed">
            {format === 'jpg'
              ? 'JPG는 투명 미지원 — 빈 영역은 흰색으로 출력됩니다.'
              : `${format.toUpperCase()}는 종이 색을 무시하고 빈 영역을 투명 처리합니다.`}
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={busy} className="btn-secondary">취소</button>
          <button onClick={onExport} disabled={busy} className="btn-primary">
            {busy ? '내보내는 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
