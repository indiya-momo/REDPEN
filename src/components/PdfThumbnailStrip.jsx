import { useCallback, useEffect, useRef, useState } from 'react';
import { stripPageLabelPrefix } from '../lib/printedPageDisplay.js';
import { renderPageToCanvas } from '../lib/pdfService.js';

/** 저화질·저부하 썸네일 (표시만 확인용) */
const THUMB_HEIGHT_PX = 52;
/** 공유 버퍼 없이 순차 렌더 — 동시 그리기 시 가로가 반으로 눌리는 현상 방지 */
const RENDER_BATCH = 1;

/**
 * @param {HTMLCanvasElement} target
 * @param {HTMLCanvasElement} source
 * @param {number} displayW
 * @param {number} displayH
 * @param {number} pageNum
 */
function blitThumbCanvas(target, source, displayW, displayH, pageNum) {
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0);
  }
  target.style.width = `${displayW}px`;
  target.style.height = `${displayH}px`;
  target.style.maxWidth = 'none';
  target.style.maxHeight = 'none';
  target.dataset.renderedPage = String(pageNum);
}

/**
 * @param {{
 *   pageNum: number,
 *   active: boolean,
 *   eager: boolean,
 *   onSelect: () => void,
 *   requestRender: (pageNum: number, canvas: HTMLCanvasElement, force?: boolean) => Promise<void>,
 *   label: string,
 * }} props
 */
function PdfThumbnailItem({
  pageNum,
  active,
  eager,
  onSelect,
  requestRender,
  label,
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = '';
      canvas.style.height = '';
      delete canvas.dataset.renderedPage;
    }
    if (frame) {
      frame.style.width = '';
      frame.style.height = '';
    }
  }, [pageNum]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    let cancelled = false;

    const run = (force = false) => {
      void requestRender(pageNum, canvas, force).then((ok) => {
        if (!cancelled && ok) setLoaded(true);
      });
    };

    if (eager) {
      run();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        run();
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 },
    );

    observer.observe(root);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pageNum, eager, requestRender]);

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let cancelled = false;
    void requestRender(pageNum, canvas, true).then((ok) => {
      if (!cancelled && ok) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [active, pageNum, requestRender]);

  return (
    <button
      ref={rootRef}
      type="button"
      className={`pdf-thumb${active ? ' pdf-thumb--active' : ''}`}
      onClick={onSelect}
      aria-label={`${label}페이지`}
      aria-current={active ? 'page' : undefined}
    >
      <span ref={frameRef} className="pdf-thumb__frame">
        <canvas
          ref={canvasRef}
          className={
            loaded ? 'pdf-thumb__canvas' : 'pdf-thumb__canvas pdf-thumb__canvas--loading'
          }
        />
      </span>
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
 * }} props
 */
export default function PdfThumbnailStrip({
  pdf,
  currentPage,
  onSelectPage,
  formatPageLabel = (n) => String(n),
}) {
  const stripRef = useRef(null);
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const numPages = pdf.numPages;

  const setStripRef = useCallback((node) => {
    stripRef.current = node;
  }, []);

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
          if (
            !force &&
            canvas.dataset.renderedPage === String(pageNum) &&
            canvas.width > 0
          ) {
            resolve(true);
            return;
          }

          const offscreen = document.createElement('canvas');

          try {
            const page = await pdf.getPage(pageNum);
            const base = page.getViewport({ scale: 1 });
            const scale = THUMB_HEIGHT_PX / base.height;
            const viewport = page.getViewport({ scale });

            await renderPageToCanvas(pdf, pageNum, offscreen, scale);

            const displayW = Math.max(1, Math.round(viewport.width));
            const displayH = THUMB_HEIGHT_PX;
            blitThumbCanvas(canvas, offscreen, displayW, displayH, pageNum);

            const frame = canvas.parentElement;
            if (frame instanceof HTMLElement) {
              frame.style.width = `${displayW + 4}px`;
              frame.style.height = `${displayH + 4}px`;
            }

            resolve(true);
          } catch {
            resolve(false);
          }
        };

        queueRef.current.push(job);
        pumpQueue();
      });
    },
    [pdf, pumpQueue],
  );

  useEffect(() => {
    queueRef.current = [];
  }, [pdf]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector('.pdf-thumb--active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [currentPage, numPages]);

  return (
    <div
      id="pdf-thumb-strip"
      ref={setStripRef}
      className="pdf-thumb-strip"
      role="navigation"
      aria-label="PDF 페이지 목록"
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
        const eager =
          pageNum === currentPage ||
          pageNum === currentPage - 1 ||
          pageNum === currentPage + 1;
        return (
          <PdfThumbnailItem
            key={pageNum}
            pageNum={pageNum}
            active={pageNum === currentPage}
            eager={eager}
            onSelect={() => onSelectPage(pageNum)}
            requestRender={requestRender}
            label={stripPageLabelPrefix(formatPageLabel(pageNum))}
          />
        );
      })}
    </div>
  );
}
