import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCanvasManager } from '../canvas/canvasContext';
import { ExportDialog } from './ExportDialog';
import { ConfirmDialog } from './ConfirmDialog';

export function TopBar() {
  const project = useProjectStore((s) => s.project);
  const closeProject = useProjectStore((s) => s.closeProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const currentFilePath = useProjectStore((s) => s.currentFilePath);
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath);
  const setLayers = useProjectStore((s) => s.setLayers);
  const loadProject = useProjectStore((s) => s.loadProject);
  const getSerializableProject = useProjectStore((s) => s.getSerializableProject);
  const m = useCanvasManager();

  const [editingName, setEditingName] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!project) return null;

  const onSaveAs = async () => {
    const snap = getSerializableProject();
    if (!snap) return;
    if (m) snap.canvasJSON = m.toJSON();
    const newPath = await window.api.saveProjectAs(snap, snap.name);
    if (newPath) setCurrentFilePath(newPath);
  };

  const onOpen = async () => {
    const result = await window.api.openProjectFile();
    if (!result) return;
    if ('error' in result) { alert(result.error); return; }
    loadProject(result.project);
    setCurrentFilePath(result.filePath);
  };

  const onUndo = () => m?.undo().then(() => setLayers(m.getLayerMetas()));
  const onRedo = () => m?.redo().then(() => setLayers(m.getLayerMetas()));

  return (
    <div className="h-14 panel border-b flex items-center px-4 gap-3 flex-shrink-0">
      <div className="flex items-baseline gap-1.5 mr-2">
        <span className="text-xl font-bold tracking-tight">
          <span className="brand-gradient">Pixel</span>
          <span className="text-text-primary">Lab</span>
        </span>
        <span className="text-[10px] text-text-muted font-normal">v{__APP_VERSION__}</span>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => setConfirmClose(true)} className="btn-ghost text-sm">
          <span className="mr-1">←</span>닫기
        </button>
        <button onClick={onOpen} className="btn-ghost text-sm">📁 열기</button>
        <button onClick={onSaveAs} className="btn-ghost text-sm">💾 다른 이름으로</button>
        <button
          onClick={async () => {
            const paths = await window.api.openImageDialog();
            for (const p of paths) {
              const dataUrl = await window.api.readImageDataUrl(p);
              if (dataUrl && m) await m.addImageFromURL(dataUrl);
            }
          }}
          className="btn-ghost text-sm"
        >🖼 이미지 추가</button>
      </div>

      <div className="h-6 w-px bg-border-subtle" />

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editingName ? (
          <input
            autoFocus
            defaultValue={project.name}
            onBlur={(e) => { renameProject(e.target.value.trim() || project.name); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
            className="input text-sm py-1 max-w-[280px]"
          />
        ) : (
          <button onClick={() => setEditingName(true)}
            className="text-text-primary font-medium text-sm hover:text-accent transition-colors truncate max-w-[280px]"
            title="클릭해서 이름 변경"
          >
            {project.name}
          </button>
        )}
        <span className="text-xs text-text-muted">
          · {project.settings.width}×{project.settings.height}
        </span>
        {currentFilePath && (
          <span className="text-[10px] text-text-muted truncate" title={currentFilePath}>
            · 외부 파일
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onUndo} className="btn-ghost" title="실행취소 (Ctrl+Z)">↶</button>
        <button onClick={onRedo} className="btn-ghost" title="다시실행 (Ctrl+Y)">↷</button>
        <div className="h-6 w-px bg-border-subtle mx-1" />
        <button onClick={() => setExportOpen(true)} className="btn-primary">
          내보내기
        </button>
      </div>

      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {confirmClose && (
        <ConfirmDialog
          title="프로젝트 닫기"
          message="현재 프로젝트를 닫고 시작 화면으로 돌아갑니다. 저장하지 않은 변경 사항은 자동 저장됩니다."
          confirmLabel="닫기" cancelLabel="취소"
          onConfirm={() => { setConfirmClose(false); closeProject(); }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
