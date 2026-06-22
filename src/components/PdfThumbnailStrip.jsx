import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stripPageLabelPrefix } from '../lib/printedPageDisplay.js';
import { renderPageToCanvas } from '../lib/pdfService.js';
import {
  buildThumbStrip,
  DEFAULT_THUMB_ASPECT,
  resolveThumbAspect,
} from '../lib/thumbLayout.js';
import { thumbSlotPages } from '../lib/thumbSlotPages.js';

const RENDER_BATCH = 1;

/**
 * @param {HTMLCanvasElement} target
 * @param {HTMLCanvasElement} source
 * @param {number} pageNum
 */
function blitThumbCanvas(target, source, pageNum) {
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0);
  }
  target.dataset.renderedPage = String(pageNum);
}

/**
 * @param {{
 *   pageNum: number,
 *   active: boolean,
 *   onSelect: () => void,
 *   requestRender: (pageNum: number, canvas: HTMLCanvasElement, force?: boolean) => Promise<boolean>,
 *   label: string,
 *   idle?: boolean,
 * }} props
 */
function PdfThumbnailItem({
  pageNum,
  active,
  onSelect,
  requestRender,
  label,
  idle = false,
}) {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    delete canvas.dataset.renderedPage;
  }, [pageNum]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || idle) return undefined;

    let cancelled = false;
    void requestRender(pageNum, canvas, active).then((ok) => {
      if (!cancelled && ok) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [active, idle, pageNum, requestRender]);

  return (
    <button
      type="button"
      className={`pdf-thumb${active ? ' pdf-thumb--active' : ''}`}
      onClick={onSelect}
      aria-label={`${label}페이지`}
      aria-current={active ? 'page' : undefined}
    >
      <canvas
        ref={canvasRef}
        className={
          loaded ? 'pdf-thumb__canvas' : 'pdf-thumb__canvas pdf-thumb__canvas--loading'
        }
      />
      <span className="pdf-thumb__num">{label}</span>
    </button>
  );
}

/**
 * @param {{
 *   pdf: import('pdfjs-dist').PDFDocumentProxy,
 *   currentPage: number,
 *   onSelectPage: (page: number) => void,
 *   formatPageLabel?: (systemPage: number) => string,
 *   idle?: boolean,
 * }} props
 */
export default function PdfThumbnailStrip({
  pdf,
  currentPage,
  onSelectPage,
  formatPageLabel = (n) => String(n),
  idle = false,
}) {
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const [pageAspect, setPageAspect] = useState(DEFAULT_THUMB_ASPECT);
  const numPages = pdf.numPages;

  const slots = useMemo(
    () => thumbSlotPages(currentPage, numPages),
    [currentPage, numPages],
  );

  const { layout, style: stripStyle } = useMemo(
    () => buildThumbStrip(pageAspect),
    [pageAspect],
  );

  useEffect(() => {
    let cancelled = false;
    void resolveThumbAspect(pdf, slots).then((aspect) => {
      if (!cancelled) setPageAspect(aspect);
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, slots]);

  const pumpQueue = useCallback(() => {
    while (activeRef.current < RENDER_BATCH && queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (!job) break;
      activeRef.current += 1;
      void job().finally(() => {
        activeRef.current -= 1;
        pumpQueue();
      });
    }
  }, []);

  const requestRender = useCallback(
    (pageNum, canvas, force = false) => {
      if (
        !force &&
        canvas.dataset.renderedPage === String(pageNum) &&
        canvas.width > 0
      ) {
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        const job = async () => {
          const offscreen = document.createElement('canvas');

          try {
            const page = await pdf.getPage(pageNum);
            const base = page.getViewport({ scale: 1 });
            const scale = layout.displayH / base.height;

            await renderPageToCanvas(pdf, pageNum, offscreen, scale);
            blitThumbCanvas(canvas, offscreen, pageNum);
            resolve(true);
          } catch {
            resolve(false);
          }
        };

        queueRef.current.push(job);
        pumpQueue();
      });
    },
    [layout.displayH, pdf, pumpQueue],
  );

  useEffect(() => {
    queueRef.current = [];
  }, [pdf]);

  return (
    <div
      id="pdf-thumb-strip"
      className="pdf-thumb-strip"
      style={stripStyle}
      role="navigation"
      aria-label="PDF 페이지 목록"
    >
      {slots.map((pageNum, index) =>
        pageNum != null ? (
          <PdfThumbnailItem
            key={pageNum}
            pageNum={pageNum}
            active={pageNum === currentPage}
            onSelect={() => onSelectPage(pageNum)}
            requestRender={requestRender}
            label={stripPageLabelPrefix(formatPageLabel(pageNum))}
            idle={idle}
          />
        ) : (
          <div key={`ghost-${index}`} className="pdf-thumb pdf-thumb--ghost" aria-hidden="true">
            <span className="pdf-thumb__canvas pdf-thumb__canvas--ghost" />
            <span className="pdf-thumb__num pdf-thumb__num--ghost" />
          </div>
        ),
      )}
    </div>
  );
}
