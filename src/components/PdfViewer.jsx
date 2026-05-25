import { useEffect, useRef, useState } from 'react';
import {
  highlightRectsForTextRange,
  renderPageToCanvas,
} from '../lib/pdfService.js';
import pdfEmptyIcon from '../assets/momo/pdf-empty.png';

/**
 * @param {{
 *   pdf: import('pdfjs-dist').PDFDocumentProxy | null,
 *   pageNum: number,
 *   pageData: import('../lib/pdfService.js').PageData | null,
 *   highlights?: Array<{ start: number, end: number, primary?: boolean }>,
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
  emptyHint = '신국판 300페이지 내외 (50MB)를 권장합니다.',
  showPageMeta = true,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [rects, setRects] = useState([]);
  const [error, setError] = useState(null);
  const highlightsKey = JSON.stringify(highlights);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const { page, viewport } = await renderPageToCanvas(
          pdf,
          pageNum,
          canvasRef.current,
          1.4,
        );

        if (cancelled) return;

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
              allBoxes.push({ ...box, primary: Boolean(h.primary) });
            }
          }
          setRects(allBoxes);
        } else {
          setRects([]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '페이지 렌더 실패');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, pageData, highlightsKey]);

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
        <p className="pdf-empty-hint subtle">스캔 PDF는 미지원합니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer" ref={wrapRef}>
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
      <div className="pdf-canvas-wrap">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div className="pdf-highlight-layer">
          {rects.map((r, i) => (
            <div
              key={i}
              className={`pdf-highlight ${r.primary ? 'pdf-highlight--primary' : ''}`}
              style={{
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
              }}
            />
          ))}
        </div>
      </div>
      {error && <p className="pdf-error">{error}</p>}
    </div>
  );
}
