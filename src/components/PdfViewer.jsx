import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  cancelRenderTask,
  computePdfRenderScale,
  ensureGlyphOffsetsForPage,
  highlightRectsForItemIndexes,
  highlightRectsForTextRange,
  scaleToFitContainer,
  startPageRenderOnCanvas,
  stepPdfZoomFactor,
} from '../lib/pdfService.js';
import { syncPdfStageScrollAfterLayout } from '../lib/pdfStageScroll.js';
import {
  markCandidateSpacing,
  spacingOnlyMarks,
} from '../lib/highlightOverlayReplace.js';
import pdfEmptyIcon from '../assets/momo/pdf-empty.png';
import PdfHighlightTipBubble from './PdfHighlightTipBubble.jsx';
import {
  filterPickedHighlightLayers,
  highlightToManualEditPayload,
  resolveOverlayChoiceLayers,
  stripOverlayArrow,
} from '../lib/highlightOverlayLayers.js';
import { LayoutMarkGlyph } from '../lib/layoutMark/layoutMarkGlyphs.jsx';
import { indentMarkGeometryFromPage } from '../lib/layoutMark/indentMarkGeometry.js';
import { textLayerItemBoxes } from '../lib/manuscriptWorkbench/pageGeometry.js';
import { resolveTextSelection } from '../lib/manuscriptWorkbench/resolveTextSelection.js';
import { suppressTipEditSideClicks } from '../lib/manuscriptWorkbench/tipEditGuard.js';

/** 하이라이트 높이 대비 오버레이↔원문 위·아래 패딩 (기준 0.05 → ×1.8, index.css 변수와 동일) */
const PDF_OVERLAY_PAD_Y_RATIO = 0.09;

function fitTextLayerItemScale(root) {
  if (!root) return;
  for (const span of root.querySelectorAll('.pdf-text-layer__item')) {
    if (!(span instanceof HTMLElement)) continue;
    const desired = Number(span.dataset.targetWidth);
    span.style.transform = 'none';
    const actual = span.offsetWidth;
    if (desired > 0 && actual > 0) {
      span.style.transform = `scaleX(${desired / actual})`;
    }
  }
}

function closestTextItemSpan(node, root) {
  let el = node && node.nodeType === 3 ? node.parentElement : node;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.dataset.itemIndex != null) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * @typedef {import('../hooks/useHighlights.js').PageHighlight} PageHighlight
 *
 * @param {{
 *   pdf: import('pdfjs-dist').PDFDocumentProxy | null,
 *   pageNum: number,
 *   pageData: import('../lib/pdfService.js').PageData | null,
 *   highlights?: PageHighlight[],
 *   emptyTitle?: string,
 *   emptyHint?: string,
 *   showPageMeta?: boolean,
 *   zoomFactor?: number,
 *   onZoomFactorChange?: (update: (prev: number) => number) => void,
 *   guideHighlightActive?: boolean,
 *   onHighlightTipOpen?: () => void,
 *   onHighlightTipConfirm?: () => void,
 *   onHighlightTipDismiss?: () => void,
 *   tipConfirmGuideAttr?: string,
 *   textLayerEnabled?: boolean,
 *   onTextSelected?: (hit: object) => void,
 *   onTextSelectionCancel?: () => void,
 *   onOverlayEdit?: (payload: object) => void,
 * }} props
 */
export default function PdfViewer({
  pdf,
  pageNum,
  pageData,
  highlights = [],
  emptyTitle = 'PDF를 업로드하세요',
  emptyHint = '용량: 100MB 이하 권장 · 100MB 초과 시 검수 불가',
  showPageMeta = true,
  zoomFactor = 1,
  onZoomFactorChange,
  guideHighlightActive = false,
  onHighlightTipOpen,
  onHighlightTipConfirm,
  onHighlightTipDismiss,
  tipConfirmGuideAttr,
  textLayerEnabled = false,
  onTextSelected,
  onTextSelectionCancel,
  onOverlayEdit,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const textLayerRef = useRef(null);
  /** @type {React.MutableRefObject<import('pdfjs-dist').RenderTask | null>} */
  const renderTaskRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState([]);
  const [textLayerBoxes, setTextLayerBoxes] = useState([]);
  const [error, setError] = useState(null);
  /** @type {{ id: string, tip: string, matchedText: string, left: number, top: number } | null} */
  const [openTip, setOpenTip] = useState(null);
  /** @type {React.MutableRefObject<object | null>} */
  const tipEditPayloadRef = useRef(null);
  /** tip 상자 클릭 직후 하이라이트/모드 버튼으로 클릭이 새는 것 막기 */
  const suppressTipEditClickRef = useRef(false);
  const [pickedLayerByBase, setPickedLayerByBase] = useState({});
  const highlightsKey = JSON.stringify(highlights);
  const visibleHighlights = useMemo(
    () => filterPickedHighlightLayers(highlights, pickedLayerByBase),
    [highlights, pickedLayerByBase],
  );
  const liveById = useMemo(() => {
    const map = new Map();
    for (const row of visibleHighlights) {
      if (row?.id) map.set(row.id, row);
    }
    return map;
  }, [visibleHighlights]);

  useEffect(() => {
    setPickedLayerByBase({});
  }, [pageNum]);

  useEffect(() => {
    setPickedLayerByBase((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      let changed = false;
      const next = { ...prev };
      for (const baseId of keys) {
        const layerId = next[baseId];
        const still = highlights.some(
          (h) =>
            (h.baseId ?? h.id) === baseId &&
            resolveOverlayChoiceLayers(h).some((layer) => layer.id === layerId),
        );
        if (!still) {
          delete next[baseId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [highlights]);

  useEffect(() => {
    tipEditPayloadRef.current = null;
    setOpenTip(null);
  }, [pageNum, highlightsKey]);

  /** 펼침면 오른쪽 등 — primary가 화면 밖이면 스테이지를 그쪽으로 스크롤 */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !rects.length) return;
    const primary = rects.find((r) => r.primary);
    if (!primary) return;

    const pad = 48;
    const viewL = stage.scrollLeft;
    const viewT = stage.scrollTop;
    const viewR = viewL + stage.clientWidth;
    const viewB = viewT + stage.clientHeight;
    const left = primary.left;
    const top = primary.top;
    const right = left + primary.width;
    const bottom = top + primary.height;

    let nextL = viewL;
    let nextT = viewT;
    if (left < viewL + pad) nextL = Math.max(0, left - pad);
    else if (right > viewR - pad) {
      nextL = Math.max(0, right + pad - stage.clientWidth);
    }
    if (top < viewT + pad) nextT = Math.max(0, top - pad);
    else if (bottom > viewB - pad) {
      nextT = Math.max(0, bottom + pad - stage.clientHeight);
    }
    if (nextL !== viewL || nextT !== viewT) {
      stage.scrollTo({ left: nextL, top: nextT, behavior: 'smooth' });
    }
  }, [rects]);

  useEffect(() => {
    if (!openTip) return;
    onHighlightTipOpen?.();
  }, [openTip, onHighlightTipOpen]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    let timeoutId = 0;
    let frameId = 0;

    const updateSize = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          const { width, height } = stage.getBoundingClientRect();
          setStageSize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        });
      }, 80);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(frameId);
    };
  }, [pdf]);

  useEffect(() => {
    const stage = stageRef.current;
    const wrap = wrapRef.current;
    if (!stage || !wrap) return undefined;

    const onLayoutChange = () => {
      syncPdfStageScrollAfterLayout(stage, wrap);
    };

    onLayoutChange();
    const observer = new ResizeObserver(onLayoutChange);
    observer.observe(stage);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [pdf, pageNum, zoomFactor, stageSize.width, stageSize.height]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !pdf) return undefined;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!onZoomFactorChange) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      onZoomFactorChange((z) => stepPdfZoomFactor(z, direction));
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [pdf, onZoomFactorChange]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    if (stageSize.width < 8 || stageSize.height < 8) return;

    let cancelled = false;
    setError(null);

    const safePageNum = Math.min(
      pdf.numPages,
      Math.max(1, Math.floor(Number(pageNum))),
    );
    if (!Number.isFinite(safePageNum) || safePageNum < 1) {
      setError('유효하지 않은 페이지 번호입니다.');
      return undefined;
    }

    (async () => {
      try {
        await cancelRenderTask(renderTaskRef.current);
        renderTaskRef.current = null;
        if (cancelled) return;

        const page = await pdf.getPage(safePageNum);
        if (cancelled) return;

        // getPage 대기 중 다른 effect가 렌더를 시작했을 수 있음
        await cancelRenderTask(renderTaskRef.current);
        renderTaskRef.current = null;
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = scaleToFitContainer(baseViewport, stageSize);
        const scale = computePdfRenderScale(fitScale, zoomFactor);
        const { viewport, renderTask } = startPageRenderOnCanvas(
          page,
          canvasRef.current,
          scale,
        );
        renderTaskRef.current = renderTask;
        try {
          await renderTask.promise;
        } catch (error) {
          if (renderTask.cancelled || cancelled) {
            const err = new Error('Render cancelled');
            err.code = 'RENDER_CANCELLED';
            throw err;
          }
          throw error;
        }
        if (cancelled) {
          await cancelRenderTask(renderTask);
          renderTaskRef.current = null;
          return;
        }

        if ((highlights.length || textLayerEnabled) && pageData) {
          // 캔버스와 같은 글자 위치 (첫 회만 연산자 목록 1회 — 실패 시 비율 분할)
          await ensureGlyphOffsetsForPage(page, pageData.items);
          if (cancelled) return;
        }

        if (highlights.length && pageData) {
          const allBoxes = [];
          for (const h of highlights) {
            const boxes =
              Array.isArray(h.itemIndexes) && h.itemIndexes.length
                ? highlightRectsForItemIndexes(
                    page,
                    viewport,
                    pageData.items,
                    h.itemIndexes,
                    h.matchedText ?? '',
                  )
                : highlightRectsForTextRange(
                    page,
                    viewport,
                    pageData.items,
                    pageData.itemRefs,
                    h.start,
                    h.end,
                    pageData,
                  );
            // 띄어쓰기만 바꾸는 교정은 라벨 대신 그 자리에 붙임표 ⌒ / 띄움표 ∨만
            // 밑줄과 동일 highlightRects 글자 박스 경계만 사용 (별도 추정 없음)
            const glueMarks = [];
            const glueRuns =
              Array.isArray(h.overlayLayers) && h.overlayLayers.length > 1
                ? null
                : Number.isFinite(h.start)
                  ? spacingOnlyMarks(h.matchedText, h.overlayReplace)
                  : null;
            if (glueRuns) {
              for (const { type, s, e } of glueRuns) {
                const rectAt = (idx) =>
                  highlightRectsForTextRange(
                    page,
                    viewport,
                    pageData.items,
                    pageData.itemRefs,
                    h.start + idx,
                    h.start + idx + 1,
                    pageData,
                  )[0];
                const prev = s > 0 ? rectAt(s - 1) : null;
                const next = rectAt(type === 'insert' ? s : e);
                if (!prev) break;
                const sameLine =
                  next && Math.abs(next.top - prev.top) < prev.height * 0.5;
                const x = sameLine
                  ? (prev.left + prev.width + next.left) / 2
                  : prev.left + prev.width;
                glueMarks.push({
                  type,
                  x,
                  top: sameLine ? Math.min(prev.top, next.top) : prev.top,
                  size: sameLine
                    ? Math.max(prev.height, next.height)
                    : prev.height,
                });
              }
            }
            const useGlueMarks = Boolean(glueRuns) && glueMarks.length === glueRuns.length;
            // 여러 item 하이라이트에 교정문을 각각 그리면 같은 문구가 겹침
            // (과반수 이상×2, 긴 긴 밤×3). 첫 박스에만 표시.
            boxes.forEach((box, boxIndex) => {
              allBoxes.push({
                ...box,
                primary: Boolean(h.primary),
                highlightId: h.id,
                tip: h.tip ?? '',
                matchedText: h.matchedText ?? '',
                overlayReplace:
                  boxIndex === 0 && !useGlueMarks ? (h.overlayReplace ?? '') : '',
                showOverlay: boxIndex === 0 && !useGlueMarks,
                glueMarks: boxIndex === 0 && useGlueMarks ? glueMarks : null,
                pillarClass: h.pillarClass ?? '',
                layoutKind: boxIndex === 0 ? (h.layoutKind ?? null) : null,
                indentGeom:
                  boxIndex === 0 && h.layoutKind === 'indent'
                    ? indentMarkGeometryFromPage({
                        page,
                        viewport,
                        pageData,
                        textIndex: h.start,
                        highlightRectsForTextRange,
                      })
                    : null,
              });
            });
          }
          setRects(allBoxes);
        } else {
          setRects([]);
        }

        if (textLayerEnabled && pageData) {
          setTextLayerBoxes(textLayerItemBoxes(page, viewport, pageData));
        } else {
          setTextLayerBoxes([]);
        }

        if (!cancelled) {
          syncPdfStageScrollAfterLayout(stageRef.current, wrapRef.current);
        }
      } catch (e) {
        if (
          cancelled ||
          (e instanceof Error && e.code === 'RENDER_CANCELLED')
        ) {
          return;
        }
        setError(e instanceof Error ? e.message : '페이지 렌더 실패');
      }
    })();

    return () => {
      cancelled = true;
      void cancelRenderTask(renderTaskRef.current);
      renderTaskRef.current = null;
    };
  }, [
    pdf,
    pageNum,
    pageData,
    highlightsKey,
    stageSize.width,
    stageSize.height,
    zoomFactor,
    textLayerEnabled,
  ]);

  useEffect(() => {
    if (!openTip) return undefined;

    const requireConfirmClick = Boolean(tipConfirmGuideAttr);

    function dismissTip() {
      tipEditPayloadRef.current = null;
      setOpenTip(null);
      onHighlightTipDismiss?.();
    }

    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (requireConfirmClick) {
        e.preventDefault();
        return;
      }
      dismissTip();
    }

    function onPointerDown(e) {
      if (requireConfirmClick) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('.pdf-highlight') ||
        target.closest('.pdf-highlight-tip')
      ) {
        return;
      }
      dismissTip();
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [openTip, onHighlightTipDismiss, tipConfirmGuideAttr]);

  useLayoutEffect(() => {
    if (!textLayerEnabled) return;
    fitTextLayerItemScale(textLayerRef.current);
  }, [textLayerBoxes, textLayerEnabled]);

  function handleTextLayerMouseUp(event) {
    if (event?.button === 2) return;
    if (!textLayerEnabled || !onTextSelected || !pageData) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const root = textLayerRef.current;
    if (!root || !root.contains(range.commonAncestorContainer)) return;
    const startEl = closestTextItemSpan(range.startContainer, root);
    const endEl = closestTextItemSpan(range.endContainer, root);
    if (!startEl || !endEl) return;
    const hit = resolveTextSelection(pageData, {
      startItemIndex: Number(startEl.dataset.itemIndex),
      startOffset: range.startOffset,
      endItemIndex: Number(endEl.dataset.itemIndex),
      endOffset: range.endOffset,
    });
    if (hit) {
      onTextSelected(hit);
      sel.removeAllRanges();
    }
  }

  function handleTextLayerContextMenu(event) {
    event.preventDefault();
    window.getSelection()?.removeAllRanges();
    onTextSelectionCancel?.();
  }

  function pickLayer(highlightId, layerId) {
    if (!highlightId || !layerId) return;
    setPickedLayerByBase((prev) => ({ ...prev, [highlightId]: layerId }));
  }

  function overlayChoicesFor(highlightId) {
    const raw = highlights.find((h) => h.id === highlightId);
    const layers = resolveOverlayChoiceLayers(raw);
    if (layers.length < 2) return [];
    return layers.map((layer) => ({
      id: layer.id,
      label: layer.overlayLabel || stripOverlayArrow(layer.overlayReplace),
    }));
  }

  function overlayEditPayload(highlight, layer) {
    return highlightToManualEditPayload(highlight, pageData, layer);
  }

  function clearPdfTextSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function openOverlayEdit(highlight, layer) {
    if (highlight?.id && layer?.id) pickLayer(highlight.id, layer.id);
    const payload = overlayEditPayload(highlight, layer);
    if (payload) onOverlayEdit?.(payload);
  }

  function handleOverlayDoubleClick(highlight, layer, event) {
    event.stopPropagation();
    event.preventDefault();
    clearPdfTextSelection();
    requestAnimationFrame(() => clearPdfTextSelection());
    openOverlayEdit(highlight, layer);
  }

  function tipEditFallbackPayload(matchedTextRaw) {
    const matchedText = String(matchedTextRaw || '').trim();
    const pn = Number(pageData?.pageNum ?? pageNum);
    if (!matchedText || !Number.isFinite(pn)) return null;
    const text = String(pageData?.text ?? pageData?.visualText ?? '');
    const index = text.indexOf(matchedText);
    const start = index >= 0 ? index : 0;
    return {
      pageNum: pn,
      index: start,
      start,
      end: start + matchedText.length,
      matchedText,
      find: matchedText,
      suggestedText: '',
      replace: '',
      tip: '',
      fromHighlight: true,
    };
  }

  function beginTipSideClickGuard() {
    suppressTipEditSideClicks(500);
    suppressTipEditClickRef.current = true;
    window.setTimeout(() => {
      suppressTipEditClickRef.current = false;
    }, 500);
  }

  function handleTipEdit(boxText) {
    if (!onOverlayEdit) return;
    const boxMatched = String(
      boxText || openTip?.matchedText || '',
    ).trim();
    let payload = tipEditPayloadRef.current || openTip?.editPayload || null;
    if (!payload && openTip) {
      const live =
        liveById.get(openTip.id) ||
        highlights.find((h) => h.id === openTip.id);
      const layers = resolveOverlayChoiceLayers(live);
      payload = overlayEditPayload(
        live,
        layers.length === 1 ? layers[0] : null,
      );
    }
    if (!payload) {
      payload = tipEditFallbackPayload(boxMatched);
    }
    if (payload && boxMatched && !String(payload.matchedText || '').trim()) {
      payload = { ...payload, matchedText: boxMatched, find: boxMatched };
    }
    tipEditPayloadRef.current = null;
    beginTipSideClickGuard();
    if (payload) onOverlayEdit(payload);
    setOpenTip(null);
  }

  function handleTipPickChoice(layerId) {
    if (!openTip || !layerId) return;
    pickLayer(openTip.id, layerId);
    const choice = (openTip.choices || []).find((row) => row.id === layerId);
    const replaceText = stripOverlayArrow(choice?.label || '').trim();
    const boxMatched = String(openTip.matchedText || '').trim();
    const live =
      liveById.get(openTip.id) ||
      highlights.find((h) => h.id === openTip.id);
    const layers = resolveOverlayChoiceLayers(live);
    const layer = layers.find((row) => row.id === layerId) || null;
    let payload =
      tipEditPayloadRef.current ||
      openTip.editPayload ||
      overlayEditPayload(live, layer) ||
      tipEditFallbackPayload(boxMatched);
    if (payload) {
      if (boxMatched) {
        payload = {
          ...payload,
          matchedText: boxMatched,
          find: boxMatched,
        };
      }
      if (replaceText) {
        payload = {
          ...payload,
          suggestedText: replaceText,
          replace: replaceText,
        };
      }
      payload = { ...payload, fromHighlight: true };
    }
    tipEditPayloadRef.current = null;
    beginTipSideClickGuard();
    if (payload && onOverlayEdit) onOverlayEdit(payload);
    setOpenTip(null);
  }

  function handleHighlightClick(rect, event) {
    event.stopPropagation();
    if (suppressTipEditClickRef.current) return;
    const tip = (rect.tip || '').trim();
    const choices = overlayChoicesFor(rect.highlightId);
    if (!tip && choices.length < 2) return;

    const wrap = wrapRef.current;
    if (!wrap) return;

    const wrapBox = wrap.getBoundingClientRect();
    const el = event.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    const hit = el.getBoundingClientRect();
    const left = hit.left - wrapBox.left + hit.width / 2;
    const top = hit.top - wrapBox.top - 6;
    const live =
      liveById.get(rect.highlightId) ||
      highlights.find((h) => h.id === rect.highlightId);
    const layers = resolveOverlayChoiceLayers(live);
    const matchedText = String(
      rect.matchedText || live?.matchedText || '',
    ).trim();
    const editPayload =
      overlayEditPayload(
        live,
        layers.length === 1 ? layers[0] : null,
      ) || tipEditFallbackPayload(matchedText);

    if (openTip?.id === rect.highlightId) {
      tipEditPayloadRef.current = null;
      setOpenTip(null);
      return;
    }

    tipEditPayloadRef.current = editPayload;
    setOpenTip({
      id: rect.highlightId,
      tip,
      matchedText: String(
        editPayload?.matchedText || matchedText || '',
      ).trim(),
      choices,
      editPayload,
      left,
      top,
    });
  }

  if (!pdf) {
    return (
      <div className="pdf-viewer pdf-viewer--empty">
        <div className="pdf-empty">
        <img
          className="pdf-empty-icon"
          src={pdfEmptyIcon}
          alt=""
          aria-hidden
          decoding="async"
        />
        <p className="pdf-empty-title">{emptyTitle}</p>
        <p className="pdf-empty-hint">{emptyHint}</p>
        <p className="pdf-empty-hint subtle">
          <span className="pdf-support-msg__scan">스캔 PDF는 읽을 수 없어요ㅠ</span>
          <br />
          인디자인 프로그램으로 만든
          <br />
          <span className="pdf-support-msg__emph">텍스트 선택 가능한 PDF</span>
          를 권장합니다
        </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer pdf-viewer--fit">
      {showPageMeta && (
        <div className="pdf-page-meta">
          페이지 {pageNum} / {pdf.numPages}
          {visibleHighlights.length > 0 && (
            <span className="pdf-page-meta-count">
              · 이 페이지 {visibleHighlights.length}곳 표시
            </span>
          )}
        </div>
      )}
      <div className="pdf-canvas-stage" ref={stageRef}>
        <div className="pdf-canvas-stage__align">
          <div className="pdf-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div className="pdf-highlight-layer">
            {rects.map((r, i) => {
              const live = liveById.get(r.highlightId);
              const overlayLayers = r.showOverlay
                ? resolveOverlayChoiceLayers(live)
                : [];
              const hasChoices = overlayLayers.length > 1;
              const overlayReplace = r.showOverlay
                ? hasChoices
                  ? ''
                  : String(
                      overlayLayers[0]?.overlayReplace ??
                        live?.overlayReplace ??
                        r.overlayReplace ??
                        '',
                    ).trim()
                : '';
              const hasTip = Boolean((r.tip || '').trim());
              const hasOverlay = hasChoices || Boolean(overlayReplace);
              const overlayFont = {
                fontSize: `${Math.max(5, Math.round(r.height * 0.69))}px`,
                ['--pdf-overlay-pad-y']: `${Math.max(1, Math.round(r.height * PDF_OVERLAY_PAD_Y_RATIO))}px`,
              };
              const isGuidePdfAnchor =
                guideHighlightActive &&
                r.primary &&
                rects.findIndex(
                  (other) =>
                    other.primary && other.highlightId === r.highlightId,
                ) === i;
              return (
                <div
                  key={`${r.highlightId}-${i}`}
                  className={[
                    'pdf-highlight',
                    r.pillarClass || '',
                    r.primary ? 'pdf-highlight--primary' : '',
                    openTip?.id === r.highlightId ? 'pdf-highlight--tip-open' : '',
                    hasTip || hasChoices ? 'pdf-highlight--has-tip' : '',
                    hasOverlay ? 'pdf-highlight--overlay-replace' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                  }}
                  role={hasTip || hasChoices ? 'button' : undefined}
                  tabIndex={hasTip || hasChoices ? 0 : undefined}
                  {...(isGuidePdfAnchor
                    ? { 'data-work-guide-pdf-highlight': '' }
                    : {})}
                  onClick={(e) => handleHighlightClick(r, e)}
                  onDoubleClick={(e) =>
                    handleOverlayDoubleClick(
                      live,
                      overlayLayers.length === 1 ? overlayLayers[0] : null,
                      e,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    handleHighlightClick(r, e);
                  }}
                >
                  {r.layoutKind && r.layoutKind !== 'indent' ? (
                    <span
                      className={`pdf-layout-mark pdf-layout-mark--${r.layoutKind}`}
                      aria-hidden
                    >
                      {(() => {
                        const markSize = Math.max(
                          14,
                          Math.round(
                            r.height *
                              (r.layoutKind === 'paraSplit' ? 1.5 : 2.2),
                          ),
                        );
                        return (
                          <LayoutMarkGlyph
                            kind={r.layoutKind}
                            size={markSize}
                            height={
                              r.layoutKind === 'paraSplit'
                                ? Math.round(markSize * 1.3)
                                : markSize
                            }
                            strokeWidth={Math.max(1, r.height * 0.08)}
                          />
                        );
                      })()}
                    </span>
                  ) : null}
                  {overlayLayers.length > 1 ? (
                    <span className="pdf-highlight__overlay-layers" style={overlayFont}>
                      <span className="pdf-highlight__overlay-arrow" aria-hidden>
                        →
                      </span>
                    </span>
                  ) : overlayReplace ? (
                    <span
                      className="pdf-highlight__overlay-replace"
                      style={overlayFont}
                      role={onOverlayEdit ? 'button' : undefined}
                      tabIndex={onOverlayEdit ? 0 : undefined}
                      onDoubleClick={(e) => handleOverlayDoubleClick(live, null, e)}
                      onKeyDown={
                        onOverlayEdit
                          ? (e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              handleOverlayDoubleClick(live, null, e);
                            }
                          : undefined
                      }
                    >
                      {markCandidateSpacing(overlayReplace)}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {rects.flatMap((r, i) =>
              (r.glueMarks ?? []).map((m, k) => (
                <svg
                  key={`glue-${r.highlightId}-${i}-${k}`}
                  className="pdf-glue-mark"
                  aria-hidden
                  viewBox="0 0 100 40"
                  preserveAspectRatio="none"
                  style={{
                    position: 'absolute',
                    left: m.x - m.size * 0.4,
                    top: m.type === 'insert' ? m.top - m.size * 0.42 : m.top - m.size * 0.38,
                    width: m.size * 0.8,
                    height: m.size * 0.36,
                    overflow: 'visible',
                    pointerEvents: 'none',
                  }}
                >
                  <path
                    d={m.type === 'insert' ? 'M18 -2 L50 40 L82 -2' : 'M4 38 Q50 -14 96 38'}
                    fill="none"
                    stroke="#e03131"
                    strokeWidth={Math.max(1, m.size * 0.08)}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )),
            )}
            {rects.map((r, i) => {
              const g = r.indentGeom;
              if (!g) return null;
              return (
                <svg
                  key={`indent-${r.highlightId}-${i}`}
                  className="pdf-indent-mark"
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'visible',
                    pointerEvents: 'none',
                  }}
                >
                  <path
                    d={g.pathD}
                    fill="none"
                    stroke="#e11d8f"
                    strokeWidth={g.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              );
            })}

          </div>
          {textLayerEnabled ? (
            <div
              ref={textLayerRef}
              className="pdf-text-layer"
              onMouseUp={handleTextLayerMouseUp}
              onContextMenu={handleTextLayerContextMenu}
            >
              {textLayerBoxes.map((box) => (
                <span
                  key={box.itemIndex}
                  className="pdf-text-layer__item"
                  data-item-index={box.itemIndex}
                  data-start={box.start}
                  data-end={box.end}
                  data-target-width={box.width}
                  style={{
                    left: box.left,
                    top: box.top,
                    fontSize: `${Math.max(6, box.height)}px`,
                  }}
                >
                  {box.str}
                </span>
              ))}
            </div>
          ) : null}
          {openTip ? (
            <PdfHighlightTipBubble
              tip={openTip.tip}
              matchedText={openTip.matchedText}
              left={openTip.left}
              top={openTip.top}
              choices={openTip.choices}
              confirmGuideAttr={tipConfirmGuideAttr}
              onPickChoice={handleTipPickChoice}
              onEdit={onOverlayEdit ? handleTipEdit : undefined}
              onClose={() => {
                setOpenTip(null);
                onHighlightTipConfirm?.();
              }}
            />
          ) : null}
          </div>
        </div>
      </div>
      {error && <p className="pdf-error">{error}</p>}
    </div>
  );
}
