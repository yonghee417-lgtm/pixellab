import * as fabric from 'fabric';
import { useState } from 'react';
import { useCanvasManager } from '../canvas/canvasContext';
import { useFontStore } from '../store/fontStore';
import { useProjectStore } from '../store/projectStore';

export function FontsPanel() {
  const fonts = useFontStore((s) => s.fonts);
  const m = useCanvasManager();
  const setTextFontFamily = useProjectStore((s) => s.setTextFontFamily);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'ko' | 'en'>('all');

  if (!m) return null;

  const filtered = fonts.filter((f) => {
    if (search && !f.family.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== 'all') {
      if (filter === 'ko' && f.lang === 'en') return false;
      if (filter === 'en' && f.lang === 'ko') return false;
    }
    return true;
  });

  const applyToActive = (family: string) => {
    setTextFontFamily(family);
    const obj = m.canvas.getActiveObject();
    if (obj instanceof fabric.IText) {
      obj.set({ fontFamily: family });
      m.canvas.requestRenderAll();
      m.snapshot();
    }
  };

  if (fonts.length === 0) {
    return (
      <div className="p-4 text-text-muted text-xs leading-relaxed">
        번들된 폰트가 없습니다.
        <div className="mt-2 text-[10px] bg-bg-elevated border border-border-subtle rounded p-2 font-mono">
          npm run fonts
        </div>
        <div className="mt-2">위 명령으로 상업용 무료 폰트를 다운로드해 주세요.</div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <input
        type="text" placeholder="폰트 검색..." value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input w-full text-xs py-1"
      />
      <div className="flex gap-1">
        {(['all', 'ko', 'en'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 text-xs py-1 rounded border ${
              filter === f ? 'bg-accent-subtle border-accent text-accent' : 'bg-bg-elevated border-border-subtle text-text-secondary'
            }`}>
            {f === 'all' ? '전체' : f === 'ko' ? '한글' : '영문'}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {filtered.map((f) => (
          <button key={f.family}
            onClick={() => applyToActive(f.family)}
            className="w-full text-left px-2 py-2 rounded bg-bg-elevated hover:bg-bg-hover border border-border-subtle hover:border-accent transition"
            style={{ fontFamily: f.family }}
            title="선택된 텍스트 레이어에 적용 / 다음 텍스트 도구의 기본값으로 설정"
          >
            <div className="text-text-primary text-base">가나다 abc 123</div>
            <div className="text-[10px] text-text-muted mt-0.5" style={{ fontFamily: 'Pretendard' }}>{f.family}</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-text-muted text-xs text-center py-6">검색 결과 없음</div>
        )}
      </div>
    </div>
  );
}
