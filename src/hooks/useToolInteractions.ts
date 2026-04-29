import { useEffect } from 'react';
import * as fabric from 'fabric';
import { v4 as uuid } from 'uuid';
import { useProjectStore } from '../store/projectStore';
import { useCanvasManager } from '../canvas/canvasContext';

// 활성 도구에 따라 캔버스 마우스 이벤트로 객체를 생성/조작하는 훅.
//
//  - move (V) : fabric 기본 객체 선택/이동
//  - select (M) : 사각형 선택 영역(marquee) 드래그. brush·fill이 그 영역 안에서만 적용됨.
//  - rect / ellipse : 드래그로 사이즈 잡기. Shift = 정비례.
//  - line (L) : 클릭-클릭 폴리라인 + 시작점 자석
//  - polygon (P) : 클릭-클릭 다각형 + 시작점 자석 + 더블클릭 닫기
//  - brush (B) : 자유 그리기. marquee 있으면 그 영역에만 그려짐 (clipPath)
//  - eraser (E) : 배경색으로 그리기 (지우개 효과)
//  - fill (G) : marquee 영역에 현재 채우기 색으로 단색 채우기
//  - text (T) : 새 레이어 + 즉시 편집
//  - eyedropper (I) : 픽셀 색 추출
export function useToolInteractions() {
  const m = useCanvasManager();
  const tool = useProjectStore((s) => s.tool);
  const fillColor = useProjectStore((s) => s.fillColor);
  const strokeColor = useProjectStore((s) => s.strokeColor);
  const strokeWidth = useProjectStore((s) => s.strokeWidth);
  const brushSize = useProjectStore((s) => s.brushSize);
  const textFontFamily = useProjectStore((s) => s.textFontFamily);
  const textFontSize = useProjectStore((s) => s.textFontSize);

  useEffect(() => {
    if (!m) return;
    const canvas = m.canvas;

    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.skipTargetFind = false;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';
    canvas.forEachObject((o: fabric.FabricObject) => {
      if ((o as any).layerKind === 'paper' || (o as any)._preview) {
        o.selectable = false;
        o.evented = false;
        return;
      }
      const lock = o.lockMovementX && o.lockMovementY;
      o.selectable = !lock;
      o.evented = !lock;
    });

    // ─────────── 도형 드래그 상태 (rect/ellipse) ───────────
    let isDown = false;
    let startX = 0, startY = 0;
    let pending: fabric.FabricObject | null = null;

    // ─────────── 선(line) 클릭-클릭 상태 ───────────
    let lineChainStart: { x: number; y: number } | null = null;
    let lineChainCurrent: { x: number; y: number } | null = null;
    let linePreview: fabric.Line | null = null;
    let lineSnapMarker: fabric.Circle | null = null;
    let lineSnapped = false;

    // ─────────── 다각형(polygon) 클릭-클릭 상태 ───────────
    let polyPoints: { x: number; y: number }[] = [];
    let polyPreview: fabric.Polyline | null = null;
    let polySnapMarker: fabric.Circle | null = null;
    let polySnapped = false;

    // ─────────── 선택 영역(marquee) 드래그 상태 ───────────
    let marqueeStart: { x: number; y: number } | null = null;
    let marqueePreview: fabric.Rect | null = null;

    const attachToActive = (o: fabric.FabricObject, kind: 'shape' | 'text' | 'image', name: string) => {
      const groupId = m.ensureActiveLayer();
      Object.assign(o, {
        layerId: uuid(),
        layerGroupId: groupId,
        layerKind: kind,
        layerName: name,
        blendMode: 'normal',
      });
    };

    const lineStrokeWidth = () => Math.max(1, strokeWidth || 2);

    // ───── 선 도구 헬퍼 ─────
    const ensureLinePreview = () => {
      if (linePreview || !lineChainCurrent) return;
      linePreview = new fabric.Line(
        [lineChainCurrent.x, lineChainCurrent.y, lineChainCurrent.x, lineChainCurrent.y],
        {
          stroke: strokeColor,
          strokeWidth: lineStrokeWidth(),
          strokeUniform: true,
          strokeDashArray: [6, 4],
          selectable: false, evented: false,
          objectCaching: false,
          excludeFromExport: true,
        },
      );
      (linePreview as any)._preview = true;
      canvas.add(linePreview);
      canvas.bringObjectToFront(linePreview);
    };
    const ensureLineSnapMarker = () => {
      if (lineSnapMarker || !lineChainStart) return;
      lineSnapMarker = new fabric.Circle({
        left: lineChainStart.x, top: lineChainStart.y, radius: 8,
        fill: 'rgba(255,174,0,0.15)',
        stroke: '#FFAE00', strokeWidth: 2,
        originX: 'center', originY: 'center',
        selectable: false, evented: false,
        objectCaching: false, strokeUniform: true,
        visible: false, excludeFromExport: true,
      });
      (lineSnapMarker as any)._preview = true;
      canvas.add(lineSnapMarker);
      canvas.bringObjectToFront(lineSnapMarker);
    };
    const clearLineChain = () => {
      if (linePreview) canvas.remove(linePreview);
      if (lineSnapMarker) canvas.remove(lineSnapMarker);
      linePreview = null;
      lineSnapMarker = null;
      lineChainStart = null;
      lineChainCurrent = null;
      lineSnapped = false;
      canvas.requestRenderAll();
    };

    // ───── 다각형 도구 헬퍼 ─────
    const ensurePolyPreview = () => {
      if (polyPreview || polyPoints.length === 0) return;
      const last = polyPoints[polyPoints.length - 1];
      polyPreview = new fabric.Polyline(
        [...polyPoints, { x: last.x, y: last.y }],
        {
          fill: 'rgba(0,0,0,0)',
          stroke: strokeColor,
          strokeWidth: lineStrokeWidth(),
          strokeUniform: true,
          strokeDashArray: [6, 4],
          selectable: false, evented: false,
          objectCaching: false,
          excludeFromExport: true,
        } as any,
      );
      (polyPreview as any)._preview = true;
      canvas.add(polyPreview);
      canvas.bringObjectToFront(polyPreview);
    };
    const ensurePolySnapMarker = () => {
      if (polySnapMarker || polyPoints.length === 0) return;
      const start = polyPoints[0];
      polySnapMarker = new fabric.Circle({
        left: start.x, top: start.y, radius: 8,
        fill: 'rgba(255,174,0,0.15)',
        stroke: '#FFAE00', strokeWidth: 2,
        originX: 'center', originY: 'center',
        selectable: false, evented: false,
        objectCaching: false, strokeUniform: true,
        visible: false, excludeFromExport: true,
      });
      (polySnapMarker as any)._preview = true;
      canvas.add(polySnapMarker);
      canvas.bringObjectToFront(polySnapMarker);
    };
    const updatePolyPreview = (cursor: { x: number; y: number }) => {
      if (!polyPreview) return;
      const next = [...polyPoints, cursor];
      // fabric Polyline의 points는 직접 변경 후 _calcDimensions / setCoords / dirty 표시 필요
      (polyPreview as any).points = next;
      (polyPreview as any)._setPositionDimensions?.({});
      polyPreview.setCoords();
      (polyPreview as any).dirty = true;
    };
    const clearPolyChain = () => {
      if (polyPreview) canvas.remove(polyPreview);
      if (polySnapMarker) canvas.remove(polySnapMarker);
      polyPreview = null;
      polySnapMarker = null;
      polyPoints = [];
      polySnapped = false;
      canvas.requestRenderAll();
    };
    const commitPolygon = () => {
      if (polyPoints.length < 3) {
        clearPolyChain();
        return;
      }
      // fabric.Polygon은 points 좌표를 그대로 받아 객체 내부 좌표로 사용 + left/top 자동 계산
      const polygon = new fabric.Polygon(polyPoints, {
        fill: fillColor,
        stroke: strokeWidth ? strokeColor : '',
        strokeWidth,
        strokeUniform: true,
        objectCaching: false,
      } as any);
      attachToActive(polygon, 'shape', '다각형');
      canvas.add(polygon);
      canvas.setActiveObject(polygon);
      m.applyLayerOrder();
      m.snapshot();
      clearPolyChain();
    };

    // ─────────── mouse:down ───────────
    const handleDown = (opt: fabric.TPointerEventInfo) => {
      const e = opt.e as MouseEvent;
      const p = canvas.getScenePoint(e);

      // SELECT — marquee 드래그 시작
      if (tool === 'select') {
        marqueeStart = { x: p.x, y: p.y };
        if (marqueePreview) canvas.remove(marqueePreview);
        marqueePreview = new fabric.Rect({
          left: p.x, top: p.y, width: 1, height: 1,
          fill: 'rgba(255,174,0,0.05)',
          stroke: '#FFAE00',
          strokeWidth: 1,
          strokeDashArray: [6, 4],
          strokeUniform: true,
          selectable: false, evented: false,
          objectCaching: false,
          excludeFromExport: true,
        });
        (marqueePreview as any)._preview = true;
        canvas.add(marqueePreview);
        canvas.bringObjectToFront(marqueePreview);
        return;
      }

      // FILL — marquee 영역에 채우기
      if (tool === 'fill') {
        const ok = m.fillMarquee(fillColor);
        if (!ok) {
          alert('먼저 선택(M) 도구로 영역을 지정한 뒤 색을 채워주세요.');
        }
        return;
      }

      // LINE — 클릭-클릭 폴리라인
      if (tool === 'line') {
        if (!lineChainStart) {
          lineChainStart = { x: p.x, y: p.y };
          lineChainCurrent = { x: p.x, y: p.y };
          ensureLinePreview();
          ensureLineSnapMarker();
          canvas.requestRenderAll();
        } else if (lineChainCurrent) {
          let target = { x: p.x, y: p.y };
          if (lineSnapped) {
            target = { x: lineChainStart.x, y: lineChainStart.y };
          } else if (e.shiftKey) {
            const ldx = p.x - lineChainCurrent.x, ldy = p.y - lineChainCurrent.y;
            const angle = Math.atan2(ldy, ldx);
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(ldx, ldy);
            target = {
              x: lineChainCurrent.x + Math.cos(snapAngle) * len,
              y: lineChainCurrent.y + Math.sin(snapAngle) * len,
            };
          }
          if (Math.hypot(target.x - lineChainCurrent.x, target.y - lineChainCurrent.y) >= 1) {
            const line = new fabric.Line(
              [lineChainCurrent.x, lineChainCurrent.y, target.x, target.y],
              {
                stroke: strokeColor,
                strokeWidth: lineStrokeWidth(),
                strokeUniform: true,
              },
            );
            attachToActive(line, 'shape', '선');
            canvas.add(line);
            m.applyLayerOrder();
            m.snapshot();
            if (linePreview) canvas.bringObjectToFront(linePreview);
            if (lineSnapMarker) canvas.bringObjectToFront(lineSnapMarker);
          }
          if (lineSnapped) {
            clearLineChain();
          } else {
            lineChainCurrent = target;
            if (linePreview) {
              linePreview.set({ x1: target.x, y1: target.y, x2: target.x, y2: target.y });
              linePreview.setCoords();
            }
          }
          canvas.requestRenderAll();
        }
        return;
      }

      // POLYGON — 클릭-클릭 다각형
      if (tool === 'polygon') {
        if (polyPoints.length === 0) {
          polyPoints.push({ x: p.x, y: p.y });
          ensurePolyPreview();
          ensurePolySnapMarker();
          canvas.requestRenderAll();
        } else {
          if (polySnapped) {
            commitPolygon();
            return;
          }
          const last = polyPoints[polyPoints.length - 1];
          let target = { x: p.x, y: p.y };
          if (e.shiftKey) {
            const ldx = p.x - last.x, ldy = p.y - last.y;
            const angle = Math.atan2(ldy, ldx);
            const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(ldx, ldy);
            target = {
              x: last.x + Math.cos(snapAngle) * len,
              y: last.y + Math.sin(snapAngle) * len,
            };
          }
          polyPoints.push(target);
          updatePolyPreview(target);
          canvas.requestRenderAll();
        }
        return;
      }

      // RECT / ELLIPSE / TEXT / EYEDROPPER — 드래그/클릭
      startX = p.x; startY = p.y;
      isDown = true;

      if (tool === 'rect') {
        pending = new fabric.Rect({
          left: startX, top: startY, width: 1, height: 1,
          fill: fillColor, stroke: strokeWidth ? strokeColor : '', strokeWidth, strokeUniform: true,
        });
        attachToActive(pending, 'shape', '사각형');
        canvas.add(pending);
      } else if (tool === 'ellipse') {
        pending = new fabric.Ellipse({
          left: startX, top: startY, rx: 1, ry: 1,
          fill: fillColor, stroke: strokeWidth ? strokeColor : '', strokeWidth, strokeUniform: true,
        });
        attachToActive(pending, 'shape', '원');
        canvas.add(pending);
      } else if (tool === 'text') {
        m.createLayer('텍스트', 'text');
        const t = new fabric.IText('텍스트를 입력하세요', {
          left: startX, top: startY,
          fontFamily: textFontFamily, fontSize: textFontSize,
          fill: fillColor, editable: true, cursorColor: '#FFAE00',
        });
        attachToActive(t, 'text', '텍스트');
        canvas.add(t);
        canvas.setActiveObject(t);
        t.enterEditing();
        t.selectAll();
        m.applyLayerOrder();
        m.snapshot();
        isDown = false;
        pending = null;
      } else if (tool === 'eyedropper') {
        const data = canvas.getContext().getImageData(e.offsetX, e.offsetY, 1, 1).data;
        const hex = `#${[data[0], data[1], data[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        useProjectStore.getState().setFillColor(hex);
        isDown = false;
      }
    };

    // ─────────── mouse:move ───────────
    const handleMove = (opt: fabric.TPointerEventInfo) => {
      const e = opt.e as MouseEvent;
      const p = canvas.getScenePoint(e);

      // SELECT — marquee 사이즈 갱신
      if (tool === 'select' && marqueeStart && marqueePreview) {
        const dx = p.x - marqueeStart.x, dy = p.y - marqueeStart.y;
        const ax = Math.abs(dx), ay = Math.abs(dy);
        let w = ax, h = ay;
        if (e.shiftKey) { const s = Math.max(ax, ay); w = s; h = s; }
        marqueePreview.set({
          left: dx >= 0 ? marqueeStart.x : marqueeStart.x - w,
          top: dy >= 0 ? marqueeStart.y : marqueeStart.y - h,
          width: w, height: h,
        });
        marqueePreview.setCoords();
        canvas.requestRenderAll();
        return;
      }

      // LINE — 미리보기 + 자석
      if (tool === 'line' && lineChainStart && lineChainCurrent && linePreview) {
        const threshold = 12 / canvas.getZoom();
        const distToStart = Math.hypot(p.x - lineChainStart.x, p.y - lineChainStart.y);
        const sameAsStart = lineChainCurrent.x === lineChainStart.x && lineChainCurrent.y === lineChainStart.y;
        const isSnapping = !sameAsStart && distToStart < threshold;

        let target = { x: p.x, y: p.y };
        if (isSnapping) {
          target = { x: lineChainStart.x, y: lineChainStart.y };
        } else if (e.shiftKey) {
          const ldx = p.x - lineChainCurrent.x, ldy = p.y - lineChainCurrent.y;
          const angle = Math.atan2(ldy, ldx);
          const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(ldx, ldy);
          target = {
            x: lineChainCurrent.x + Math.cos(snapAngle) * len,
            y: lineChainCurrent.y + Math.sin(snapAngle) * len,
          };
        }
        lineSnapped = isSnapping;
        linePreview.set({
          x1: lineChainCurrent.x, y1: lineChainCurrent.y,
          x2: target.x, y2: target.y,
          stroke: strokeColor, strokeWidth: lineStrokeWidth(),
        });
        linePreview.setCoords();
        if (lineSnapMarker) {
          lineSnapMarker.set({ visible: isSnapping });
          lineSnapMarker.setCoords();
        }
        canvas.requestRenderAll();
        return;
      }

      // POLYGON — 미리보기 + 자석
      if (tool === 'polygon' && polyPoints.length > 0 && polyPreview) {
        const start = polyPoints[0];
        const last = polyPoints[polyPoints.length - 1];
        const threshold = 12 / canvas.getZoom();
        const distToStart = polyPoints.length >= 3
          ? Math.hypot(p.x - start.x, p.y - start.y)
          : Infinity;
        const isSnapping = distToStart < threshold;

        let target = { x: p.x, y: p.y };
        if (isSnapping) {
          target = { x: start.x, y: start.y };
        } else if (e.shiftKey) {
          const ldx = p.x - last.x, ldy = p.y - last.y;
          const angle = Math.atan2(ldy, ldx);
          const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(ldx, ldy);
          target = {
            x: last.x + Math.cos(snapAngle) * len,
            y: last.y + Math.sin(snapAngle) * len,
          };
        }
        polySnapped = isSnapping;
        updatePolyPreview(target);
        if (polySnapMarker) {
          polySnapMarker.set({ visible: isSnapping });
          polySnapMarker.setCoords();
        }
        canvas.requestRenderAll();
        return;
      }

      // RECT / ELLIPSE 드래그
      if (!isDown || !pending) return;
      const dx = p.x - startX, dy = p.y - startY;
      const ax = Math.abs(dx), ay = Math.abs(dy);

      if (tool === 'rect' && pending instanceof fabric.Rect) {
        let w = ax, h = ay;
        if (e.shiftKey) { const s = Math.max(ax, ay); w = s; h = s; }
        pending.set({
          left: dx >= 0 ? startX : startX - w,
          top: dy >= 0 ? startY : startY - h,
          width: w, height: h,
        });
      } else if (tool === 'ellipse' && pending instanceof fabric.Ellipse) {
        let rx = ax / 2, ry = ay / 2;
        if (e.shiftKey) { const r = Math.max(rx, ry); rx = r; ry = r; }
        pending.set({
          left: dx >= 0 ? startX : startX - rx * 2,
          top: dy >= 0 ? startY : startY - ry * 2,
          rx, ry,
        });
      }
      pending.setCoords();
      canvas.requestRenderAll();
    };

    // ─────────── mouse:up ───────────
    const handleUp = () => {
      // SELECT — marquee 확정
      if (tool === 'select') {
        if (marqueePreview && marqueeStart) {
          const r = marqueePreview;
          const w = r.width ?? 0;
          const h = r.height ?? 0;
          const left = r.left ?? 0;
          const top = r.top ?? 0;
          canvas.remove(r);
          marqueePreview = null;
          marqueeStart = null;
          if (w >= 2 && h >= 2) {
            m.setMarquee(left, top, w, h);
          } else {
            m.clearMarquee();
          }
        }
        return;
      }

      // LINE / POLYGON 은 click-click이라 mouse:up 무관
      if (tool === 'line' || tool === 'polygon') {
        isDown = false;
        return;
      }

      isDown = false;
      if (!pending) return;
      const w = pending.getScaledWidth();
      const h = pending.getScaledHeight();
      if (w < 2 && h < 2) {
        canvas.remove(pending);
      } else {
        canvas.setActiveObject(pending);
      }
      m.applyLayerOrder();
      m.snapshot();
      pending = null;
    };

    // 더블클릭 — 선/다각형 종료
    const handleDbl = () => {
      if (tool === 'line') clearLineChain();
      if (tool === 'polygon') commitPolygon();
    };

    // Esc — 진행 중 chain + marquee 모두 정리
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearLineChain();
        clearPolyChain();
        m.clearMarquee();
      }
    };

    if (tool === 'brush') {
      m.enableFreeDraw(strokeColor, brushSize, false);
    } else if (tool === 'eraser') {
      m.enableFreeDraw(strokeColor, brushSize, true);
    } else {
      m.disableFreeDraw();
    }

    if (['rect', 'ellipse', 'line', 'polygon', 'text', 'eyedropper', 'select', 'fill'].includes(tool)) {
      canvas.selection = false;
      canvas.skipTargetFind = tool !== 'text';
      canvas.defaultCursor = tool === 'text' ? 'text' : tool === 'fill' ? 'pointer' : 'crosshair';
      canvas.hoverCursor = tool === 'text' ? 'text' : tool === 'fill' ? 'pointer' : 'crosshair';
      canvas.on('mouse:down', handleDown);
      canvas.on('mouse:move', handleMove);
      canvas.on('mouse:up', handleUp);
      if (tool === 'line' || tool === 'polygon') {
        canvas.on('mouse:dblclick', handleDbl);
      }
    }
    window.addEventListener('keydown', onKey);

    return () => {
      canvas.off('mouse:down', handleDown as any);
      canvas.off('mouse:move', handleMove as any);
      canvas.off('mouse:up', handleUp as any);
      canvas.off('mouse:dblclick', handleDbl as any);
      window.removeEventListener('keydown', onKey);
      // 도구 변경/언마운트 시 진행 중 chain 정리. marquee는 유지.
      clearLineChain();
      clearPolyChain();
      if (marqueePreview) {
        canvas.remove(marqueePreview);
        canvas.requestRenderAll();
      }
      m.disableFreeDraw();
    };
  }, [m, tool, fillColor, strokeColor, strokeWidth, brushSize, textFontFamily, textFontSize]);
}
