import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import {
  cancelRenderTask,
  computePdfRenderScale,
  highlightRectsForTextRange,
  PDF_ZOOM_FACTOR_MAX,
  PDF_ZOOM_FACTOR_MIN,
  renderPageToCanvas,
  scaleToFitContainer,
  stepPdfZoomFactor,
} from '../lib/pdfService.js';
import pdfEmptyIcon from '../assets/momo/pdf-empty.png';
import PdfHighlightTipBubble from './PdfHighlightTipBubble.jsx';

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
 * }} props
 */
export default function PdfViewer({
  pdf,
  pageNum,
  pageData,
  highlights = [],
  emptyTitle = 'PDF를 업로드하세요',
  emptyHint = '용량 기준: 정상(<40MB) · 주의(40MB+) · 초과(50MB+)',
  showPageMeta = true,
}) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  /** @type {React.MutableRefObject<import('pdfjs-dist').RenderTask | null>} */
  const renderTaskRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoomFactor, setZoomFactor] = useState(1);
  const [rects, setRects] = useState([]);
  const [error, setError] = useState(null);
  /** @type {{ id: string, tip: string, matchedText: string, left: number, top: number } | null} */
  const [openTip, setOpenTip] = useState(null);
  const highlightsKey = JSON.stringify(highlights);
  const zoomPercent = Math.round(zoomFactor * 100);
  const atFitZoom = zoomFactor === 1;
  const canZoomOut = zoomFactor > PDF_ZOOM_FACTOR_MIN;
  const canZoomIn = zoomFactor < PDF_ZOOM_FACTOR_MAX;

  useEffect(() => {
    setOpenTip(null);
  }, [pageNum, highlightsKey]);

  useEffect(() => {
    setZoomFactor(1);
  }, [pdf]);

  const zoomIn = useCallback(() => {
    setZoomFactor((z) => stepPdfZoomFactor(z, 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomFactor((z) => stepPdfZoomFactor(z, -1));
  }, []);

  const zoomFit = useCallback(() => {
    setZoomFactor(1);
  }, []);

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
    if (!stage || !pdf) return undefined;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoomFactor((z) => stepPdfZoomFactor(z, direction));
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [pdf]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    if (stageSize.width < 8 || stageSize.height < 8) return;

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        await cancelRenderTask(renderTaskRef.current);
        renderTaskRef.current = null;
        if (cancelled) return;

        const page = await pdf.getPage(pageNum);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = scaleToFitContainer(baseViewport, stageSize);
        const scale = computePdfRenderScale(fitScale, zoomFactor);
        const { viewport, renderTask } = await renderPageToCanvas(
          pdf,
          pageNum,
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
            );
            for (const box of boxes) {
              allBoxes.push({
                ...box,
                primary: Boolean(h.primary),
                highlightId: h.id,
                tip: h.tip ?? '',
                matchedText: h.matchedText ?? '',
              });
            }
          }
          setRects(allBoxes);
        } else {
          setRects([]);
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

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpenTip(null);
    }

    function onPointerDown(e) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest('.pdf-highlight') ||
        target.closest('.pdf-highlight-tip')
      ) {
        return;
      }
      setOpenTip(null);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [openTip]);

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
      <div
        className="pdf-zoom-bar"
        role="toolbar"
        aria-label="PDF 확대/축소"
      >
        <button
          type="button"
          className="pdf-zoom-bar__btn"
          onClick={zoomOut}
          disabled={!canZoomOut}
          aria-label="축소"
        >
          <ZoomOut size={16} aria-hidden />
        </button>
        <span className="pdf-zoom-bar__percent" aria-live="polite">
          {zoomPercent}%
        </span>
        <button
          type="button"
          className="pdf-zoom-bar__btn"
          onClick={zoomIn}
          disabled={!canZoomIn}
          aria-label="확대"
        >
          <ZoomIn size={16} aria-hidden />
        </button>
        <button
          type="button"
          className={`pdf-zoom-bar__fit${atFitZoom ? ' pdf-zoom-bar__fit--active' : ''}`}
          onClick={zoomFit}
          disabled={atFitZoom}
          aria-label="패널에 맞춤"
        >
          맞춤
        </button>
        <span className="pdf-zoom-bar__hint">Ctrl+휠</span>
      </div>
      <div
        className={`pdf-canvas-stage${atFitZoom ? ' pdf-canvas-stage--fit-center' : ''}`}
        ref={stageRef}
      >
        <div className="pdf-canvas-wrap" ref={wrapRef}>
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div className="pdf-highlight-layer">
            {rects.map((r, i) => (
              <div
                key={`${r.highlightId}-${i}`}
                className={[
                  'pdf-highlight',
                  r.primary ? 'pdf-highlight--primary' : '',
                  openTip?.id === r.highlightId ? 'pdf-highlight--tip-open' : '',
                  (r.tip || '').trim() ? 'pdf-highlight--has-tip' : '',
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
                onClick={(e) => handleHighlightClick(r, e)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  handleHighlightClick(r, e);
                }}
              />
            ))}
          </div>
          {openTip ? (
            <PdfHighlightTipBubble
              tip={openTip.tip}
              matchedText={openTip.matchedText}
              left={openTip.left}
              top={openTip.top}
              onClose={() => setOpenTip(null)}
            />
          ) : null}
        </div>
      </div>
      {error && <p className="pdf-error">{error}</p>}
    </div>
  );
}
