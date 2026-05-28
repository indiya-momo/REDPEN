// legacy 빌드: Map.getOrInsertComputed 등 최신 JS API 폴리필 (구형 Chrome·Cursor 내장 브라우저)
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * @typedef {Object} TextItemRef
 * @property {number} start
 * @property {number} end
 * @property {number} itemIndex
 */

/**
 * @typedef {Object} PageData
 * @property {number} pageNum
 * @property {string} text
 * @property {import('pdfjs-dist').TextItem[]} items
 * @property {TextItemRef[]} itemRefs
 */

/**
 * @param {ArrayBuffer} buffer
 */
export async function loadPdfFromBuffer(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
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
    const content = await page.getTextContent();
    const { text, itemRefs } = buildPageText(content.items);
    pages.push({
      pageNum: i,
      text,
      items: content.items.filter((it) => 'str' in it),
      itemRefs,
    });
    onProgress?.(i, total);
  }

  return pages;
}

/**
 * @param {import('pdfjs-dist').TextItem[]} items
 */
function buildPageText(items) {
  /** @type {{ y: number, entries: { item: import('pdfjs-dist').TextItem, itemIndex: number }[] }[]} */
  const lines = [];

  items.forEach((item, itemIndex) => {
    if (!('str' in item) || !item.str) return;
    const y = item.transform?.[5] ?? 0;
    const lineH =
      Math.max(Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0), 8) *
      0.55;
    let line = lines.find((l) => Math.abs(l.y - y) <= lineH);
    if (!line) {
      line = { y, entries: [] };
      lines.push(line);
    }
    line.entries.push({ item, itemIndex });
  });

  lines.sort((a, b) => b.y - a.y);

  let text = '';
  /** @type {TextItemRef[]} */
  const itemRefs = [];

  for (const line of lines) {
    line.entries.sort(
      (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
    );
    for (let i = 0; i < line.entries.length; i++) {
      const { item, itemIndex } = line.entries[i];
      const start = text.length;
      text += item.str;
      itemRefs.push({ start, end: text.length, itemIndex });
      if (i < line.entries.length - 1) {
        const gap =
          (line.entries[i + 1].item.transform?.[4] ?? 0) -
          ((item.transform?.[4] ?? 0) + (item.width ?? 0));
        const lineH =
          Math.max(
            Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0),
            8,
          ) * 0.35;
        if (gap > lineH) text += ' ';
      }
    }
    text += '\n';
  }

  return { text, itemRefs };
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
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2d context unavailable');
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
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

  const { index, matchedText } = instance;
  const end = index + matchedText.length;
  const slice = pageData.text.slice(index, end);

  if (slice === matchedText) {
    return { start: index, end };
  }

  const found = pageData.text.indexOf(matchedText, Math.max(0, index - 80));
  if (found === -1) {
    const anywhere = pageData.text.indexOf(matchedText);
    if (anywhere === -1) return null;
    return { start: anywhere, end: anywhere + matchedText.length };
  }

  return { start: found, end: found + matchedText.length };
}

/**
 * 매칭 구간만 좁혀 하이라이트 (문장 전체 text item 방지)
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {import('pdfjs-dist').PageViewport} viewport
 * @param {import('pdfjs-dist').TextItem[]} items
 * @param {TextItemRef[]} itemRefs
 * @param {number} matchStart
 * @param {number} matchEnd
 * @returns {Array<{ left: number, top: number, width: number, height: number }>}
 */
export function highlightRectsForTextRange(
  page,
  viewport,
  items,
  itemRefs,
  matchStart,
  matchEnd,
) {
  const rects = [];

  for (const ref of itemRefs) {
    if (ref.end <= matchStart || ref.start >= matchEnd) continue;

    const item = items[ref.itemIndex];
    if (!item || !('str' in item) || !item.str) continue;

    const localStart = Math.max(0, matchStart - ref.start);
    const localEnd = Math.min(item.str.length, matchEnd - ref.start);
    if (localEnd <= localStart) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const fullWidth = (item.width ?? 0) * viewport.scale;
    const strLen = item.str.length || 1;
    const ratioStart = localStart / strLen;
    const ratioLen = (localEnd - localStart) / strLen;

    rects.push({
      left: tx[4] + fullWidth * ratioStart,
      top: tx[5] - fontHeight,
      width: Math.max(fullWidth * ratioLen, 3),
      height: Math.max(fontHeight * 1.15, 6),
    });
  }

  return rects;
}
