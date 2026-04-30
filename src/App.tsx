import { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Editor } from './components/Editor';
import { useFonts } from './hooks/useFonts';
import logoUrl from './assets/logo.png';

// 시작 시 스플래시 로딩 화면 노출 시간 (ms)
const SPLASH_DURATION_MS = 3000;

export function App() {
  const project = useProjectStore((s) => s.project);
  const [bootMsg, setBootMsg] = useState<string | null>('PixelLab을 준비하고 있어요...');
  useFonts();

  useEffect(() => {
    if (!window.api) {
      setBootMsg('Electron 환경이 감지되지 않았습니다. `npm run dev` 로 실행해주세요.');
      return;
    }
    // 스플래시 화면을 잠시 보여주고 메인으로 진입
    const timer = setTimeout(() => setBootMsg(null), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // 자동 저장 — 변경 1초 디바운스, 30초 인터벌, blur/beforeunload 즉시 저장
  const saveNow = () => {
    const state = useProjectStore.getState();
    const snapshot = state.getSerializableProject();
    if (!snapshot) return;
    if (state.currentFilePath) {
      window.api?.saveProjectToPath(snapshot, state.currentFilePath).catch(() => {});
    } else {
      window.api?.saveProject(snapshot).catch(() => {});
    }
  };

  useEffect(() => {
    if (!project) return;
    const t = setTimeout(saveNow, 1000);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const interval = setInterval(saveNow, 30_000);
    window.addEventListener('blur', saveNow);
    window.addEventListener('beforeunload', saveNow);
    return () => {
      clearInterval(interval);
      window.removeEventListener('blur', saveNow);
      window.removeEventListener('beforeunload', saveNow);
    };
  }, [project?.id]);

  if (bootMsg) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-bg-base text-text-secondary">
        <div className="text-center px-8">
          <img
            src={logoUrl}
            alt="PixelLab"
            className="w-32 h-32 mx-auto mb-6 rounded-2xl shadow-2xl bg-white"
            draggable={false}
          />
          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            <span className="brand-gradient">Pixel</span>
            <span className="text-text-primary">Lab</span>
            <span className="ml-2 text-xs text-text-muted font-normal align-middle">v{__APP_VERSION__}</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            <p className="text-sm">{bootMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  return project ? <Editor /> : <WelcomeScreen />;
}
