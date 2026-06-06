// legacy 빌드: Map.getOrInsertComputed 등 최신 JS API 폴리필 (구형 Chrome·Cursor 내장 브라우저)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { resolveHighlightRange } from './pdfHighlightRange.js';
import {
  findRefForTextIndex,
  getLineContextAtTextIndex,
  isStandaloneTitleOnLine,
} from '../toc-body/lib/pdfHeadingExtract.js';
import {
  buildPageText,
  dedupeOverlayTextItems,
  shouldInsertLayoutSpaceBetweenPdfItems,
  shouldInsertSpaceBetweenPdfItems,
} from './pdfPageText.js';

export {
  buildPageText,
  dedupeOverlayTextItems,
  shouldInsertLayoutSpaceBetweenPdfItems,
  shouldInsertSpaceBetweenPdfItems,
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** @param {string} relativePath public/ 기준 (끝 슬래시 없음) */
export function resolvePdfJsPublicUrl(relativePath) {
  const base = import.meta.env.BASE_URL || '/';
  const trimmed = relativePath.replace(/^\/+/, '');
  const joined = `${base}${trimmed}`;
  if (/^https?:\/\//i.test(joined)) {
    return joined.endsWith('/') ? joined : `${joined}/`;
  }
  const withSlash = joined.startsWith('/') ? joined : `/${joined}`;
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`;
}

/**
 * @param {ArrayBuffer | Uint8Array} buffer
 */
export function buildPdfDocumentInit(buffer) {
  const data =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);
  return {
    data,
    cMapUrl: resolvePdfJsPublicUrl('pdfjs/cmaps/'),
    cMapPacked: true,
  };
}

/**
 * @typedef {Object} TextItemRef
 * @property {number} start
 * @property {number} end
 * @property {number} itemIndex
 */

/**
 * @typedef {Object} PageData
 * @property {number} pageNum
 * @property {string} text — 음절 경계 공백 포함(맞춤법·일관성 찾기·하이라이트)
 * @property {string} [textLayout] — PDF 실제 띄움만(본용언+보조용언 검사)
 * @property {import('pdfjs-dist').TextItem[]} items
 * @property {TextItemRef[]} itemRefs
 * @property {TextItemRef[]} [itemRefsLayout]
 */

/**
 * @param {ArrayBuffer} buffer
 */
export async function loadPdfFromBuffer(buffer) {
  const loadingTask = pdfjsLib.getDocument(buildPdfDocumentInit(buffer));
  const pdf = await loadingTask.promise;
  return pdf;
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @returns {Promise<PageData[]>}
 */
export async function extractAllPagesText(pdf, onProgress) {
  const pages = [];
  const total = pdf.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({
      disableCombineTextItems: true,
    });
    const items = dedupeOverlayTextItems(
      content.items.filter((it) => 'str' in it),
    );
    const { text, itemRefs, textLayout, itemRefsLayout } =
      buildPageText(items);
    pages.push({
      pageNum: i,
      text,
      textLayout,
      items,
      itemRefs,
      itemRefsLayout,
    });
    onProgress?.(i, total);
  }

  return pages;
}

/**
 * @param {{ width: number, height: number }} pageSize — scale 1 viewport
 * @param {{ width: number, height: number }} containerSize
 * @param {number} [padding]
 */
export function scaleToFitContainer(pageSize, containerSize, padding = 4) {
  const availW = Math.max(containerSize.width - padding * 2, 1);
  const availH = Math.max(containerSize.height - padding * 2, 1);
  const fit = Math.min(availW / pageSize.width, availH / pageSize.height);
  return Math.max(0.25, Math.min(fit, 4));
}

/** 패널 맞춤(100%) 대비 사용자 확대 배율 */
export const PDF_ZOOM_FACTOR_MIN = 0.5;
export const PDF_ZOOM_FACTOR_MAX = 2.5;
export const PDF_ZOOM_PERCENT_MIN = 50;
export const PDF_ZOOM_PERCENT_MAX = 250;
export const PDF_ZOOM_FACTOR_STEP = 0.25;
export const PDF_RENDER_SCALE_MAX = 6;
/** HiDPI 캔버스 상한 — 4K·고배율 줌 시 메모리 폭주 방지 */
export const PDF_OUTPUT_SCALE_MAX = 2.5;

/**
 * CSS 표시 크기 대비 실제 캔버스 해상도 배율 (Retina 등).
 * @returns {number}
 */
export function getPdfOutputScale() {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  return Math.min(Math.max(dpr, 1), PDF_OUTPUT_SCALE_MAX);
}

/**
 * @param {number} factor
 */
export function clampPdfZoomFactor(factor) {
  if (!Number.isFinite(factor)) return 1;
  return Math.min(
    PDF_ZOOM_FACTOR_MAX,
    Math.max(PDF_ZOOM_FACTOR_MIN, factor),
  );
}

/**
 * @param {number} fitScale
 * @param {number} zoomFactor
 */
export function computePdfRenderScale(fitScale, zoomFactor) {
  const fit = Number.isFinite(fitScale) ? fitScale : 1;
  const zoom = clampPdfZoomFactor(zoomFactor);
  return Math.min(
    PDF_RENDER_SCALE_MAX,
    Math.max(0.25, fit * zoom),
  );
}

/**
 * @param {number} current
 * @param {number} direction — +1 확대, -1 축소
 */
export function stepPdfZoomFactor(current, direction) {
  const next = clampPdfZoomFactor(current + direction * PDF_ZOOM_FACTOR_STEP);
  return Math.round(next * 100) / 100;
}

/**
 * @param {number | string} percent — 정수 퍼센트 (예: 160)
 * @returns {number | null}
 */
export function zoomFactorFromPercent(percent) {
  const raw =
    typeof percent === 'string' ? percent.trim() : String(percent);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (
    parsed < PDF_ZOOM_PERCENT_MIN ||
    parsed > PDF_ZOOM_PERCENT_MAX
  ) {
    return null;
  }
  return clampPdfZoomFactor(parsed / 100);
}

/**
 * @param {number} factor
 */
export function zoomPercentFromFactor(factor) {
  return Math.round(clampPdfZoomFactor(factor) * 100);
}

/**
 * @param {import('pdfjs-dist').RenderTask | null | undefined} renderTask
 */
export function cancelRenderTask(renderTask) {
  if (!renderTask) return Promise.resolve();
  renderTask.cancel();
  return renderTask.promise.catch(() => {});
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {number} pageNum
 * @param {HTMLCanvasElement} canvas
 * @param {number} [scale]
 * @param {import('pdfjs-dist').PDFPageProxy} [pageProxy]
 */
export async function renderPageToCanvas(
  pdf,
  pageNum,
  canvas,
  scale = 1.2,
  pageProxy = null,
) {
  const page = pageProxy ?? (await pdf.getPage(pageNum));
  const viewport = page.getViewport({ scale });
  const outputScale = getPdfOutputScale();
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2d context unavailable');
  }

  const cssWidth = Math.floor(viewport.width);
  const cssHeight = Math.floor(viewport.height);
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const transform =
    outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
    transform,
  });

  try {
    await renderTask.promise;
  } catch (error) {
    if (renderTask.cancelled) {
      const err = new Error('Render cancelled');
      err.code = 'RENDER_CANCELLED';
      throw err;
    }
    throw error;
  }

  return { page, viewport, renderTask };
}

/**
 * @param {PageData} pageData
 * @param {{ pageNum: number, index: number, matchedText: string }} instance
 * @returns {{ start: number, end: number } | null}
 */
export function highlightRangeForInstance(pageData, instance) {
  if (!pageData || !instance?.matchedText) return null;
  if (instance.pageNum !== pageData.pageNum) return null;

  return resolveHighlightRange(pageData, instance);
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('pdfjs-dist').TextItem} item
 * @param {number} localStart
 * @param {number} localEnd
 */
function viewportBoxForTextItem(page, viewport, item, localStart, localEnd) {
  const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(tx[2], tx[3]);
  const scaledItemWidth = (item.width ?? 0) * viewport.scale;
  const strLen = item.str.length || 1;
  const charWidth =
    scaledItemWidth > 0
      ? scaledItemWidth / strLen
      : Math.max(fontHeight * 0.52, 4);
  const spanLen = Math.max(localEnd - localStart, 0);

  return {
    left: tx[4] + charWidth * localStart,
    top: tx[5] - fontHeight,
    width: Math.max(charWidth * spanLen, 4),
    height: Math.max(fontHeight * 1.15, 6),
  };
}

/**
 * @param {Array<{ left: number, top: number, width: number, height: number }>} boxes
 */
function mergeHighlightBoxes(boxes) {
  if (!boxes.length) return [];
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;
  for (const b of boxes) {
    minL = Math.min(minL, b.left);
    minT = Math.min(minT, b.top);
    maxR = Math.max(maxR, b.left + b.width);
    maxB = Math.max(maxB, b.top + b.height);
  }
  return [
    {
      left: minL,
      top: minT,
      width: Math.max(maxR - minL, 4),
      height: Math.max(maxB - minT, 6),
    },
  ];
}

/**
 * @param {PageData} pageData
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {number} matchStart
 * @param {number} matchEnd
 */
function highlightRectsFromLineContext(pageData, page, viewport, matchStart, matchEnd) {
  const items = pageData.items ?? [];
  const itemRefs = pageData.itemRefs ?? [];
  const ctx = getLineContextAtTextIndex(pageData, matchStart);
  if (!ctx) return [];

  const onLineRefs = itemRefs.filter(
    (ref) => ref.end > ctx.lineStart && ref.start < ctx.lineEnd,
  );

  const overlapping = onLineRefs.filter(
    (ref) => ref.end > matchStart && ref.start < matchEnd,
  );
  const matchedSlice = pageData.text.slice(matchStart, matchEnd);
  const standalone = isStandaloneTitleOnLine(ctx.lineText, matchedSlice);
  const pool = standalone && onLineRefs.length ? onLineRefs : overlapping;

  /** @type {Array<{ left: number, top: number, width: number, height: number }>} */
  const boxes = [];
  for (const ref of pool) {
    const item = items[ref.itemIndex];
    if (!item || !('str' in item) || !item.str) continue;

    const localStart = Math.max(0, matchStart - ref.start);
    const localEnd = Math.min(item.str.length, matchEnd - ref.start);
    if (standalone) {
      boxes.push(viewportBoxForTextItem(page, viewport, item, 0, item.str.length));
      continue;
    }
    if (localEnd <= localStart) continue;
    boxes.push(viewportBoxForTextItem(page, viewport, item, localStart, localEnd));
  }

  if (!boxes.length) return [];
  return standalone ? mergeHighlightBoxes(boxes) : boxes;
}

/**
 * 매칭 구간만 좁혀 하이라이트 (문장 전체 text item 방지)
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('pdfjs-dist').TextItem[]} items
 * @param {TextItemRef[]} itemRefs
 * @param {number} matchStart
 * @param {number} matchEnd
 * @param {PageData} [pageData]
 * @returns {Array<{ left: number, top: number, width: number, height: number }>}
 */
export function highlightRectsForTextRange(
  page,
  viewport,
  items,
  itemRefs,
  matchStart,
  matchEnd,
  pageData = null,
) {
  /** @type {Array<{ left: number, top: number, width: number, height: number }>} */
  const rects = [];

  for (const ref of itemRefs) {
    if (ref.end <= matchStart || ref.start >= matchEnd) continue;

    const item = items[ref.itemIndex];
    if (!item || !('str' in item) || !item.str) continue;

    const localStart = Math.max(0, matchStart - ref.start);
    const localEnd = Math.min(item.str.length, matchEnd - ref.start);
    if (localEnd <= localStart) continue;

    rects.push(
      viewportBoxForTextItem(page, viewport, item, localStart, localEnd),
    );
  }

  if (rects.length) return rects;

  if (pageData) {
    const fromLine = highlightRectsFromLineContext(
      pageData,
      page,
      viewport,
      matchStart,
      matchEnd,
    );
    if (fromLine.length) return fromLine;
  }

  if (!itemRefs.length) return [];

  const hit = findRefForTextIndex(itemRefs, matchStart);
  const anchor = hit ? items[hit.itemIndex] : null;
  const y = anchor?.transform?.[5] ?? 0;
  const lineH =
    Math.max(
      Math.hypot(anchor?.transform?.[2] ?? 0, anchor?.transform?.[3] ?? 0),
      8,
    ) * 0.55;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.transform) continue;
    const iy = item.transform[5] ?? 0;
    if (Math.abs(iy - y) > lineH) continue;
    rects.push(
      viewportBoxForTextItem(page, viewport, item, 0, item.str?.length ?? 0),
    );
  }

  return rects;
}
