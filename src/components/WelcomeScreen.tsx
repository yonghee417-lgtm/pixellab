import { useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasPresetKey, CanvasPresetGroup, Project } from '@shared/types';
import { CANVAS_PRESETS } from '@shared/types';
import { useProjectStore } from '../store/projectStore';
import {
  addRecentExternal, getRecentExternal, removeRecentExternal, type RecentExternalFile,
} from '../utils/recents';
import { ConfirmDialog } from './ConfirmDialog';
import { BannerSlot } from './BannerSlot';
import logoUrl from '../assets/logo.png';

type RecentItem =
  | { type: 'library'; project: Project; sortTime: number }
  | { type: 'external'; entry: RecentExternalFile; sortTime: number };

const GROUPS: { key: CanvasPresetGroup; label: string }[] = [
  { key: 'social', label: '소셜 / SNS' },
  { key: 'photo-print', label: '사진 인쇄 (300dpi)' },
  { key: 'id-photo', label: '증명사진 / 명함 (300dpi)' },
  { key: 'document', label: '인쇄 문서 (300dpi)' },
  { key: 'wallpaper', label: '배경화면' },
  { key: 'web', label: '웹 / 일반' },
];

export function WelcomeScreen() {
  const createProject = useProjectStore((s) => s.createProject);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath);

  const [libraryProjects, setLibraryProjects] = useState<Project[]>([]);
  const [externalRecents, setExternalRecents] = useState<RecentExternalFile[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<CanvasPresetKey>('instagram-square');
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [bgTransparent, setBgTransparent] = useState(true);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<Project | null>(null);
  const [pendingRemoveExternal, setPendingRemoveExternal] = useState<RecentExternalFile | null>(null);

  const refresh = () => {
    window.api?.listProjects().then(setLibraryProjects).catch(() => {});
    setExternalRecents(getRecentExternal());
  };
  useEffect(() => { refresh(); }, []);

  const recentItems: RecentItem[] = useMemo(() => {
    const items: RecentItem[] = [];
    for (const p of libraryProjects) items.push({ type: 'library', project: p, sortTime: p.updatedAt ?? 0 });
    for (const e of externalRecents) items.push({ type: 'external', entry: e, sortTime: e.lastOpened });
    return items.sort((a, b) => b.sortTime - a.sortTime);
  }, [libraryProjects, externalRecents]);

  const handleOpenExternal = async (filePath: string) => {
    if (!window.api) return;
    const result = await window.api.openProjectFromPath(filePath);
    if ('error' in result) {
      alert(`파일 열기 실패: ${result.error}`);
      removeRecentExternal(filePath);
      setExternalRecents(getRecentExternal());
      return;
    }
    loadProject(result.project);
    setCurrentFilePath(result.filePath);
    addRecentExternal({
      filePath: result.filePath,
      name: result.project.name,
      width: result.project.settings.width,
      height: result.project.settings.height,
      lastOpened: Date.now(),
    });
  };

  const handleStart = () => {
    const value = (nameInputRef.current?.value ?? '').trim();
    const finalName = value || '새 프로젝트';
    const dupLib = libraryProjects.find((p) => p.name === finalName);
    const dupExt = externalRecents.find((e) => e.name === finalName);
    if (dupLib || dupExt) {
      setDuplicateError(`이미 "${finalName}" 이름의 프로젝트가 있습니다. 다른 이름을 사용하거나 기존 프로젝트를 삭제해주세요.`);
      return;
    }
    setDuplicateError(null);
    const isCustom = preset === 'custom';
    createProject(finalName, preset, isCustom ? {
      width: customW, height: customH,
      background: bgTransparent ? 'transparent' : bgColor,
    } : { width: CANVAS_PRESETS[preset].width, height: CANVAS_PRESETS[preset].height,
          background: bgTransparent ? 'transparent' : bgColor });
  };

  const currentPreset = CANVAS_PRESETS[preset];

  return (
    <div className="h-full w-full flex bg-bg-base">
      {/* 좌측 — 새 프로젝트 (헤더/배너 고정 + 가운데 스크롤) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* ① 상단 고정 영역: 로고 + 타이틀 + 이름입력 + 시작버튼 */}
        <div className="flex-shrink-0 px-12 pt-10 pb-5 border-b border-border-subtle bg-bg-base">
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <img
                src={logoUrl}
                alt=""
                className="w-14 h-14 rounded-xl shadow-lg bg-white shrink-0"
                draggable={false}
              />
              <h1 className="text-5xl font-bold tracking-tight flex items-baseline gap-3">
                <span>
                  <span className="brand-gradient">Pixel</span>
                  <span className="text-text-primary">Lab</span>
                </span>
                <span className="text-xs text-text-muted font-normal tracking-normal">v{__APP_VERSION__}</span>
              </h1>
            </div>
            <p className="text-text-secondary mb-5">사진 편집 · 그래픽 디자인 도구</p>

            <div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm text-text-secondary mb-2">프로젝트 이름</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    defaultValue="새 프로젝트"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStart();
                      }
                    }}
                    onChange={() => duplicateError && setDuplicateError(null)}
                    spellCheck={false}
                    autoComplete="off"
                    className="input w-full"
                    placeholder="프로젝트 이름"
                  />
                </div>
                <button
                  onClick={handleStart}
                  className="btn-primary flex-1 min-w-0 text-base py-2.5 leading-tight flex flex-col items-center"
                >
                  <span>프로젝트 시작</span>
                  <span className="text-[10px] opacity-70 truncate w-full text-center">
                    {currentPreset.label} · {currentPreset.displayDims ?? `${currentPreset.width}×${currentPreset.height}`}
                  </span>
                </button>
              </div>
              {duplicateError && (
                <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                  ⚠ {duplicateError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ② 가운데 스크롤 영역: 캔버스 크기 + 배경 */}
        <div className="flex-1 overflow-y-auto px-12 py-6 min-h-0">
          <div className="w-full max-w-2xl mx-auto space-y-7">
            <div>
              <label className="block text-sm text-text-secondary mb-3">캔버스 크기</label>
              {GROUPS.map((g) => {
                const items = (Object.keys(CANVAS_PRESETS) as CanvasPresetKey[]).filter(
                  (k) => CANVAS_PRESETS[k].group === g.key,
                );
                if (items.length === 0) return null;
                return (
                  <div key={g.key} className="mb-3">
                    <div className="text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">{g.label}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map((key) => {
                        const p = CANVAS_PRESETS[key];
                        const isActive = preset === key;
                        const aspect = p.width / p.height;
                        return (
                          <button
                            key={key}
                            onClick={() => setPreset(key)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              isActive
                                ? 'border-accent bg-accent-subtle'
                                : 'border-border-subtle hover:border-border-strong bg-bg-panel'
                            }`}
                          >
                            <div className="flex items-center justify-center mb-2 h-12">
                              <div
                                className={`border-2 rounded ${isActive ? 'border-accent' : 'border-text-muted'}`}
                                style={{
                                  width: aspect > 1 ? 48 : 48 * aspect,
                                  height: aspect > 1 ? 48 / aspect : 48,
                                }}
                              />
                            </div>
                            <div className="font-semibold text-sm text-text-primary truncate">{p.label}</div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {p.displayDims ?? `${p.width}×${p.height}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* 직접 입력 */}
              <div>
                <div className="text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">직접 입력</div>
                <button
                  onClick={() => setPreset('custom')}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                    preset === 'custom'
                      ? 'border-accent bg-accent-subtle'
                      : 'border-border-subtle hover:border-border-strong bg-bg-panel'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-sm text-text-primary">커스텀 크기</div>
                    <div className="text-[11px] text-text-muted">원하는 사이즈로</div>
                  </div>
                </button>
                {preset === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2 px-3 py-3 bg-bg-panel rounded-lg border border-border-subtle">
                    <div>
                      <label className="text-[11px] text-text-muted">너비 (px)</label>
                      <input type="number" className="input w-full mt-1" value={customW}
                        min={1} max={20000}
                        onChange={(e) => setCustomW(Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                    <div>
                      <label className="text-[11px] text-text-muted">높이 (px)</label>
                      <input type="number" className="input w-full mt-1" value={customH}
                        min={1} max={20000}
                        onChange={(e) => setCustomH(Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-muted mt-3">{currentPreset.description}</p>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">배경</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={bgTransparent}
                    onChange={(e) => setBgTransparent(e.target.checked)}
                    className="accent-accent" />
                  <span className="text-sm text-text-secondary">투명 배경</span>
                </label>
                {!bgTransparent && (
                  <>
                    <input type="color" value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border border-border-subtle" />
                    <input type="text" value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="input w-32 font-mono text-xs" />
                    <button onClick={() => setBgColor('#ffffff')} className="btn-ghost text-xs">흰색</button>
                    <button onClick={() => setBgColor('#000000')} className="btn-ghost text-xs">검정</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ③ 하단 고정 배너 (메인화면 하단 600×60) */}
        <div className="flex-shrink-0 border-t border-border-subtle p-3 flex justify-center bg-bg-base/50">
          <BannerSlot slotId="main-bottom" width={600} height={60} label="메인화면하단배너광고" />
        </div>
      </div>

      {/* 우측 — 최근 프로젝트 (헤더/배너 고정 + 가운데 스크롤) */}
      <div className="w-80 panel border-l flex flex-col">
        <div className="flex-shrink-0 p-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">최근 프로젝트</h2>
          <button
            onClick={async () => {
              const result = await window.api.openProjectFile();
              if (!result) return;
              if ('error' in result) { alert(`파일 열기 실패: ${result.error}`); return; }
              loadProject(result.project);
              setCurrentFilePath(result.filePath);
              addRecentExternal({
                filePath: result.filePath,
                name: result.project.name,
                width: result.project.settings.width,
                height: result.project.settings.height,
                lastOpened: Date.now(),
              });
            }}
            className="btn-ghost text-xs"
            title="외부 .pxlab 파일 직접 찾아 열기"
          >
            📁 찾아 열기
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {recentItems.length === 0 ? (
            <div className="text-text-muted text-sm text-center mt-8 px-4">
              저장된 프로젝트가 없습니다
            </div>
          ) : recentItems.map((item) => {
            if (item.type === 'library') {
              const p = item.project;
              return (
                <div key={`lib-${p.id}`} className="group relative mb-1">
                  <button
                    onClick={() => loadProject(p)}
                    className="w-full text-left p-3 rounded-md hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="" className="w-9 h-9 object-cover rounded border border-border-subtle" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-bg-elevated border border-border-subtle flex items-center justify-center text-accent text-xs">📚</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-text-primary truncate">{p.name}</div>
                        <div className="text-xs text-text-muted truncate">
                          {p.settings.width}×{p.settings.height} ·{' '}
                          {new Date(p.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(ev) => { ev.stopPropagation(); setPendingDeleteProject(p); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-xs rounded text-text-muted hover:text-red-400"
                    title="프로젝트 영구 삭제"
                  >×</button>
                </div>
              );
            }
            const e = item.entry;
            return (
              <div key={`ext-${e.filePath}`} className="group relative mb-1">
                <button onClick={() => handleOpenExternal(e.filePath)}
                  className="w-full text-left p-3 rounded-md hover:bg-bg-hover transition-colors"
                  title={e.filePath}>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded bg-bg-elevated border border-border-subtle flex items-center justify-center text-warm text-xs">📁</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-text-primary truncate">{e.name}</div>
                      <div className="text-xs text-text-muted truncate">
                        {e.width}×{e.height} · {new Date(e.lastOpened).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(ev) => { ev.stopPropagation(); setPendingRemoveExternal(e); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-xs rounded text-text-muted hover:text-red-400"
                  title="목록에서만 제거"
                >×</button>
              </div>
            );
          })}
        </div>
        <div className="flex-shrink-0 p-3 border-t border-border-subtle text-[10px] text-text-muted leading-snug">
          📚 라이브러리 자동 저장 · 📁 외부 파일 (다른 이름으로 저장)
        </div>
        {/* 프로젝트 패널 하단 배너 (300×60) */}
        <div className="flex-shrink-0 p-3 border-t border-border-subtle flex justify-center bg-bg-base/40">
          <BannerSlot slotId="panel-bottom" width={300} height={60} label="사이드하단배너" />
        </div>
      </div>

      {pendingRemoveExternal && (
        <ConfirmDialog title="최근 목록에서 제거"
          message={<><strong className="text-text-primary">"{pendingRemoveExternal.name}"</strong>를 목록에서 제거할까요? 파일 자체는 유지됩니다.</>}
          confirmLabel="제거" cancelLabel="취소"
          onConfirm={() => {
            removeRecentExternal(pendingRemoveExternal.filePath);
            setExternalRecents(getRecentExternal());
            setPendingRemoveExternal(null);
          }}
          onCancel={() => setPendingRemoveExternal(null)}
        />
      )}
      {pendingDeleteProject && (
        <ConfirmDialog title="프로젝트 삭제 확인" danger
          message={<>
            <strong className="text-text-primary">"{pendingDeleteProject.name}"</strong> 프로젝트를 영구 삭제하시겠습니까?
            <div className="mt-2 text-yellow-400 text-xs">⚠ 라이브러리에서 완전히 제거되며 복구할 수 없습니다.</div>
          </>}
          confirmLabel="영구 삭제" cancelLabel="취소"
          onConfirm={async () => {
            const id = pendingDeleteProject.id;
            setPendingDeleteProject(null);
            await window.api.deleteProject(id);
            refresh();
          }}
          onCancel={() => setPendingDeleteProject(null)}
        />
      )}
    </div>
  );
}
