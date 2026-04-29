import * as fabric from 'fabric';
import { useEffect, useState } from 'react';
import { useCanvasManager } from '../canvas/canvasContext';
import { useProjectStore } from '../store/projectStore';
import { useFontStore } from '../store/fontStore';

// 선택된 fabric 객체의 핵심 속성을 조정하는 패널
export function PropertiesPanel() {
  const m = useCanvasManager();
  const selected = useProjectStore((s) => s.selectedLayerIds);
  const [_tick, setTick] = useState(0); // re-render trigger when canvas object updates
  const [lockAspect, setLockAspect] = useState(true);
  const fonts = useFontStore((s) => s.fonts);

  useEffect(() => {
    if (!m) return;
    const handler = () => setTick((t) => t + 1);
    m.canvas.on('object:modified', handler);
    m.canvas.on('selection:created', handler);
    m.canvas.on('selection:updated', handler);
    m.canvas.on('text:changed' as any, handler);
    return () => {
      m.canvas.off('object:modified', handler);
      m.canvas.off('selection:created', handler);
      m.canvas.off('selection:updated', handler);
      m.canvas.off('text:changed' as any, handler);
    };
  }, [m]);

  if (!m) return null;
  const obj = m.canvas.getActiveObject();
  if (!obj || selected.length === 0) {
    return (
      <div className="p-4 text-text-muted text-xs space-y-3">
        <div>객체를 선택하면 여기에 속성이 표시됩니다.</div>
        <div className="border-t border-border-subtle pt-3">
          <CanvasQuickActions />
        </div>
      </div>
    );
  }

  const isText = obj instanceof fabric.IText;
  const isImage = obj instanceof fabric.FabricImage;
  const isShape = obj instanceof fabric.Rect || obj instanceof fabric.Ellipse
    || obj instanceof fabric.Polygon || obj instanceof fabric.Line;

  const update = (patch: Record<string, unknown>) => {
    obj.set(patch);
    obj.setCoords();
    m.canvas.requestRenderAll();
    setTick((t) => t + 1);
  };

  const onChangeWidth = (newW: number) => {
    const ow = Math.max(1, obj.width ?? 1);
    const oh = Math.max(1, obj.height ?? 1);
    const newSX = newW / ow;
    if (lockAspect) {
      const sw = obj.getScaledWidth();
      const sh = Math.max(0.0001, obj.getScaledHeight());
      const aspect = sw / sh;
      const newH = newW / aspect;
      update({ scaleX: newSX, scaleY: newH / oh });
    } else {
      update({ scaleX: newSX });
    }
  };

  const onChangeHeight = (newH: number) => {
    const ow = Math.max(1, obj.width ?? 1);
    const oh = Math.max(1, obj.height ?? 1);
    const newSY = newH / oh;
    if (lockAspect) {
      const sw = obj.getScaledWidth();
      const sh = Math.max(0.0001, obj.getScaledHeight());
      const aspect = sw / sh;
      const newW = newH * aspect;
      update({ scaleX: newW / ow, scaleY: newSY });
    } else {
      update({ scaleY: newSY });
    }
  };

  return (
    <div className="p-3 space-y-4">
      <Section title="변형">
        <Row label="X">
          <NumInput value={Math.round(obj.left ?? 0)} onChange={(v) => update({ left: v })} />
        </Row>
        <Row label="Y">
          <NumInput value={Math.round(obj.top ?? 0)} onChange={(v) => update({ top: v })} />
        </Row>
        <Row label="W">
          <NumInput value={Math.round(obj.getScaledWidth())} onChange={onChangeWidth} />
        </Row>
        <Row label="H">
          <NumInput value={Math.round(obj.getScaledHeight())} onChange={onChangeHeight} />
        </Row>
        <label className="flex items-center gap-2 cursor-pointer select-none pl-16">
          <input type="checkbox" checked={lockAspect}
            onChange={(e) => setLockAspect(e.target.checked)}
            className="accent-accent" />
          <span className="text-xs text-text-secondary">🔗 비율 고정</span>
        </label>
        <Row label="회전">
          <NumInput value={Math.round(obj.angle ?? 0)} onChange={(v) => update({ angle: v })} suffix="°" />
        </Row>
        <div className="flex gap-1 mt-2">
          <button onClick={() => m.flip('x')} className="btn-secondary text-xs flex-1">↔ 좌우반전</button>
          <button onClick={() => m.flip('y')} className="btn-secondary text-xs flex-1">↕ 상하반전</button>
        </div>
        <div className="grid grid-cols-3 gap-1 mt-1">
          <button onClick={() => m.alignToCanvas('left')} className="btn-secondary text-xs">⇤</button>
          <button onClick={() => m.alignToCanvas('center-h')} className="btn-secondary text-xs">↔</button>
          <button onClick={() => m.alignToCanvas('right')} className="btn-secondary text-xs">⇥</button>
          <button onClick={() => m.alignToCanvas('top')} className="btn-secondary text-xs">⇧</button>
          <button onClick={() => m.alignToCanvas('center-v')} className="btn-secondary text-xs">↕</button>
          <button onClick={() => m.alignToCanvas('bottom')} className="btn-secondary text-xs">⇩</button>
        </div>
      </Section>

      {isShape && (
        <Section title="모양">
          <Row label="채우기">
            <ColorInput value={(obj.fill as string) ?? '#000'} onChange={(v) => update({ fill: v })} />
          </Row>
          <Row label="선">
            <ColorInput value={(obj.stroke as string) ?? '#000'} onChange={(v) => update({ stroke: v })} />
          </Row>
          <Row label="선 두께">
            <NumInput value={obj.strokeWidth ?? 0} onChange={(v) => update({ strokeWidth: v, strokeUniform: true })} />
          </Row>
          {obj instanceof fabric.Rect && (
            <Row label="모서리">
              <NumInput value={obj.rx ?? 0} onChange={(v) => update({ rx: v, ry: v })} />
            </Row>
          )}
        </Section>
      )}

      {isText && (
        <Section title="텍스트">
          <Row label="폰트">
            <select value={(obj as fabric.IText).fontFamily ?? 'Pretendard-Regular'}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="input flex-1 py-1 text-xs">
              {fonts.length === 0 && <option value="Pretendard-Regular">Pretendard-Regular</option>}
              {fonts.map((f) => (
                <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>{f.family}</option>
              ))}
            </select>
          </Row>
          <Row label="크기">
            <NumInput value={(obj as fabric.IText).fontSize ?? 32} onChange={(v) => update({ fontSize: v })} />
          </Row>
          <Row label="색상">
            <ColorInput value={((obj as fabric.IText).fill as string) ?? '#000'} onChange={(v) => update({ fill: v })} />
          </Row>
          <Row label="자간">
            <NumInput value={(obj as fabric.IText).charSpacing ?? 0} onChange={(v) => update({ charSpacing: v })} />
          </Row>
          <Row label="줄간격">
            <NumInput value={Math.round(((obj as fabric.IText).lineHeight ?? 1.16) * 100)}
              onChange={(v) => update({ lineHeight: v / 100 })} suffix="%" />
          </Row>
          <div className="flex gap-1">
            <ToggleBtn active={(obj as fabric.IText).fontWeight === 'bold'} onClick={() =>
              update({ fontWeight: (obj as fabric.IText).fontWeight === 'bold' ? 'normal' : 'bold' })}>B</ToggleBtn>
            <ToggleBtn active={(obj as fabric.IText).fontStyle === 'italic'} onClick={() =>
              update({ fontStyle: (obj as fabric.IText).fontStyle === 'italic' ? 'normal' : 'italic' })}>I</ToggleBtn>
            <ToggleBtn active={!!(obj as fabric.IText).underline} onClick={() =>
              update({ underline: !(obj as fabric.IText).underline })}>U</ToggleBtn>
            <ToggleBtn active={!!(obj as fabric.IText).linethrough} onClick={() =>
              update({ linethrough: !(obj as fabric.IText).linethrough })}>S</ToggleBtn>
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1">
            {(['left', 'center', 'right', 'justify'] as const).map((a) => (
              <ToggleBtn key={a} active={(obj as fabric.IText).textAlign === a}
                onClick={() => update({ textAlign: a })}>
                {a === 'left' ? '⇤' : a === 'center' ? '↔' : a === 'right' ? '⇥' : '≡'}
              </ToggleBtn>
            ))}
          </div>
          <Section title="텍스트 효과" inner>
            <Row label="그림자">
              <button
                onClick={() => {
                  const cur = (obj as fabric.IText).shadow;
                  if (cur) update({ shadow: null });
                  else update({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.4)', blur: 8, offsetX: 4, offsetY: 4 }) });
                }}
                className="btn-secondary text-xs flex-1"
              >{(obj as fabric.IText).shadow ? '제거' : '추가'}</button>
            </Row>
            <Row label="외곽선">
              <ColorInput value={((obj as fabric.IText).stroke as string) ?? '#000'} onChange={(v) => update({ stroke: v })} />
            </Row>
            <Row label="외곽두께">
              <NumInput value={(obj as fabric.IText).strokeWidth ?? 0} onChange={(v) => update({ strokeWidth: v })} />
            </Row>
          </Section>
        </Section>
      )}

      {isImage && (
        <Section title="이미지">
          <button onClick={() => runBgRemoval(m)} className="btn-primary w-full text-sm">
            ✦ 배경 제거
          </button>
          <p className="text-[10px] text-text-muted mt-1 leading-snug">
            완전 로컬 처리 · 첫 사용 시 모델 다운로드 (~80MB) · 인터넷 필요
          </p>
        </Section>
      )}

      <Section title="레이아웃 순서">
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => m.bringToFront()} className="btn-secondary text-xs">맨 앞으로</button>
          <button onClick={() => m.bringForward()} className="btn-secondary text-xs">앞으로</button>
          <button onClick={() => m.sendBackward()} className="btn-secondary text-xs">뒤로</button>
          <button onClick={() => m.sendToBack()} className="btn-secondary text-xs">맨 뒤로</button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, inner = false }: { title: string; children: React.ReactNode; inner?: boolean }) {
  return (
    <div className={inner ? 'pt-2' : 'space-y-2'}>
      <h4 className="text-[10px] uppercase tracking-wider text-text-muted">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-secondary w-14 shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-1">{children}</div>
    </div>
  );
}
function NumInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex-1 relative">
      <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="input w-full py-1 text-xs pr-6" />
      {suffix && <span className="absolute right-2 top-1.5 text-[10px] text-text-muted">{suffix}</span>}
    </div>
  );
}
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 flex items-center gap-1">
      <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer bg-transparent border border-border-subtle" />
      <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="input flex-1 py-1 text-xs font-mono" />
    </div>
  );
}
function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-1 text-xs rounded border ${
        active ? 'bg-accent-subtle border-accent text-accent' : 'bg-bg-elevated border-border-subtle text-text-secondary hover:text-text-primary'
      }`}>{children}</button>
  );
}

function CanvasQuickActions() {
  return (
    <div className="space-y-2">
      <ImportImageButton />
    </div>
  );
}

function ImportImageButton() {
  const m = useCanvasManager();
  if (!m) return null;
  const onClick = async () => {
    const paths = await window.api.openImageDialog();
    for (const p of paths) {
      const dataUrl = await window.api.readImageDataUrl(p);
      if (dataUrl) await m.addImageFromURL(dataUrl);
    }
  };
  return <button onClick={onClick} className="btn-secondary w-full text-xs">+ 이미지 가져오기</button>;
}

async function runBgRemoval(m: NonNullable<ReturnType<typeof useCanvasManager>>) {
  const layerId = m.getActiveLayerId();
  const dataUrl = m.getActiveImageDataUrl();
  if (!layerId || !dataUrl) return;
  try {
    // 동적 import — 실행 시점에만 로드해서 초기 부팅을 가볍게
    const mod: any = await import('@imgly/background-removal');
    const remove: (input: any, opts?: any) => Promise<Blob> =
      mod.default ?? mod.removeBackground;
    const blob = await remove(dataUrl);
    const reader = new FileReader();
    reader.onload = async () => {
      await m.replaceImageSrc(layerId, reader.result as string);
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    alert('배경 제거 실패: ' + (e instanceof Error ? e.message : String(e)));
  }
}
