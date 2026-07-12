import { useEffect, useRef, useState } from 'react';
import {
  cancelRenderTask,
  computePdfRenderScale,
  highlightRectsForTextRange,
  renderPageToCanvas,
  scaleToFitContainer,
  stepPdfZoomFactor,
} from '../lib/pdfService.js';
import { syncPdfStageScrollAfterLayout } from '../lib/pdfStageScroll.js';
import pdfEmptyIcon from '../assets/momo/pdf-empty.png';
import PdfHighlightTipBubble from './PdfHighlightTipBubble.jsx';

/** 하이라이트 높이 대비 오버레이↔원문 위·아래 패딩 (기준 0.05 → ×1.8, index.css 변수와 동일) */
const PDF_OVERLAY_PAD_Y_RATIO = 0.09;

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
 * }} props
 */
export default function PdfViewer({
  pdf,
  pageNum,
  pageData,
  highlights = [],
  emptyTitle = 'PDF를 업로드하세요',
  emptyHint = '용량: 50MB 이하 권장 · 100MB 초과 시 검수 불가',
  showPageMeta = true,
  zoomFactor = 1,
  onZoomFactorChange,
  guideHighlightActive = false,
  onHighlightTipOpen,
  onHighlightTipConfirm,
  onHighlightTipDismiss,
  tipConfirmGuideAttr,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  /** @type {React.MutableRefObject<import('pdfjs-dist').RenderTask | null>} */
  const renderTaskRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [rects, setRects] = useState([]);
  const [error, setError] = useState(null);
  /** @type {{ id: string, tip: string, matchedText: string, left: number, top: number } | null} */
  const [openTip, setOpenTip] = useState(null);
  const highlightsKey = JSON.stringify(highlights);

  useEffect(() => {
    setOpenTip(null);
  }, [pageNum, highlightsKey]);

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

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = scaleToFitContainer(baseViewport, stageSize);
        const scale = computePdfRenderScale(fitScale, zoomFactor);
        const { viewport, renderTask } = await renderPageToCanvas(
          pdf,
          safePageNum,
          canvasRef.current,
          scale,
          page,
        );
        renderTaskRef.current = renderTask;

        if (cancelled) {
          await cancelRenderTask(renderTask);
          renderTaskRef.current = null;
          return;
        }

        if (highlights.length && pageData) {
          const allBoxes = [];
          for (const h of highlights) {
            const boxes = highlightRectsForTextRange(
              page,
              viewport,
              pageData.items,
              pageData.itemRefs,
              h.start,
              h.end,
              pageData,
            );
            for (const box of boxes) {
              allBoxes.push({
                ...box,
                primary: Boolean(h.primary),
                highlightId: h.id,
                tip: h.tip ?? '',
                matchedText: h.matchedText ?? '',
                overlayReplace: h.overlayReplace ?? '',
                pillarClass: h.pillarClass ?? '',
              });
            }
          }
          setRects(allBoxes);
        } else {
          setRects([]);
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
  ]);

  useEffect(() => {
    if (!openTip) return undefined;

    const requireConfirmClick = Boolean(tipConfirmGuideAttr);

    function dismissTip() {
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

  function handleHighlightClick(rect, event) {
    event.stopPropagation();
    const tip = (rect.tip || '').trim();
    if (!tip) return;

    const wrap = wrapRef.current;
    if (!wrap) return;

    const wrapBox = wrap.getBoundingClientRect();
    const el = event.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    const hit = el.getBoundingClientRect();
    const left = hit.left - wrapBox.left + hit.width / 2;
    const top = hit.top - wrapBox.top - 6;

    setOpenTip((prev) =>
      prev?.id === rect.highlightId
        ? null
        : {
            id: rect.highlightId,
            tip,
            matchedText: rect.matchedText ?? '',
            left,
            top,
          },
    );
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
          {highlights.length > 0 && (
            <span className="pdf-page-meta-count">
              · 이 페이지 {highlights.length}곳 표시
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
              const overlayReplace = (r.overlayReplace || '').trim();
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
                    (r.tip || '').trim() ? 'pdf-highlight--has-tip' : '',
                    overlayReplace ? 'pdf-highlight--overlay-replace' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    left: r.left,
                    top: r.top,
                    width: r.width,
                    height: r.height,
                  }}
                  role={(r.tip || '').trim() ? 'button' : undefined}
                  tabIndex={(r.tip || '').trim() ? 0 : undefined}
                  title={(r.tip || '').trim() ? '설명' : undefined}
                  {...(isGuidePdfAnchor
                    ? { 'data-work-guide-pdf-highlight': '' }
                    : {})}
                  onClick={(e) => handleHighlightClick(r, e)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    handleHighlightClick(r, e);
                  }}
                >
                  {overlayReplace ? (
                    <span
                      className="pdf-highlight__overlay-replace builtin-rule-tip-inline"
                      style={{
                        fontSize: `${Math.max(5, Math.round(r.height * 0.69))}px`,
                        ['--pdf-overlay-pad-y']: `${Math.max(1, Math.round(r.height * PDF_OVERLAY_PAD_Y_RATIO))}px`,
                      }}
                      aria-hidden
                    >
                      {overlayReplace}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {openTip ? (
            <PdfHighlightTipBubble
              tip={openTip.tip}
              matchedText={openTip.matchedText}
              left={openTip.left}
              top={openTip.top}
              confirmGuideAttr={tipConfirmGuideAttr}
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
