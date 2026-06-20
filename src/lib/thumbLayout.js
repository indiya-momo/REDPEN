/** 세로 단면 기본 비율 (폴백) */
export const DEFAULT_THUMB_ASPECT = 3.375 / 4.875;

/** 미리보기 바 --pdf-thumb-scale 과 동일 */
export const THUMB_SCALE = 0.8;

export const THUMB_SLOT_COUNT = 5;

const THUMB_BASE_HEIGHT_PX = 62;
const THUMB_GAP_PX = Math.round(4 * THUMB_SCALE);
const THUMB_STRIP_PAD_X = Math.round(8 * THUMB_SCALE);
const THUMB_STRIP_PAD_Y = Math.round(8 * THUMB_SCALE);
const THUMB_LABEL_GAP_PX = 2;
const THUMB_LABEL_HEIGHT_PX = Math.round(14 * THUMB_SCALE);

/**
 * @param {number} [scale]
 */
function scaledDisplayHeight(scale = THUMB_SCALE) {
  return Math.round(THUMB_BASE_HEIGHT_PX * scale);
}

/**
 * @param {number} aspectWidthOverHeight
 * @param {number} displayH
 */
function thumbCanvasSize(aspectWidthOverHeight, displayH) {
  const aspect =
    Number.isFinite(aspectWidthOverHeight) && aspectWidthOverHeight > 0
      ? aspectWidthOverHeight
      : DEFAULT_THUMB_ASPECT;
  return {
    displayW: Math.max(1, Math.round(displayH * aspect)),
    displayH,
    aspect,
  };
}

/**
 * 원고 비율 하나로 썸네일·슬롯·스트립 창 크기를 모두 계산한다.
 *
 * @param {number} aspectWidthOverHeight
 * @param {number} [scale]
 */
export function computeThumbLayout(aspectWidthOverHeight, scale = THUMB_SCALE) {
  const displayH = scaledDisplayHeight(scale);
  const { displayW } = thumbCanvasSize(aspectWidthOverHeight, displayH);
  const slotW = displayW;
  const slotH = displayH + THUMB_LABEL_GAP_PX + THUMB_LABEL_HEIGHT_PX;
  const rowW = THUMB_SLOT_COUNT * slotW + (THUMB_SLOT_COUNT - 1) * THUMB_GAP_PX;

  return {
    displayW,
    displayH,
    slotW,
    slotH,
    stripW: rowW + 2 * THUMB_STRIP_PAD_X,
    stripH: slotH + 2 * THUMB_STRIP_PAD_Y,
  };
}

/**
 * @param {number} aspectWidthOverHeight
 * @param {number} [scale]
 */
export function buildThumbStrip(aspectWidthOverHeight, scale = THUMB_SCALE) {
  const layout = computeThumbLayout(aspectWidthOverHeight, scale);
  return {
    layout,
    style: {
      '--pdf-thumb-display-w': `${layout.displayW}px`,
      '--pdf-thumb-display-h': `${layout.displayH}px`,
      '--pdf-thumb-slot-w': `${layout.slotW}px`,
      '--pdf-thumb-slot-h': `${layout.slotH}px`,
      '--pdf-thumb-gap': `${THUMB_GAP_PX}px`,
      '--pdf-thumb-strip-pad-x': `${THUMB_STRIP_PAD_X}px`,
      '--pdf-thumb-strip-pad-y': `${THUMB_STRIP_PAD_Y}px`,
      '--pdf-thumb-strip-w': `${layout.stripW}px`,
      '--pdf-thumb-strip-h': `${layout.stripH}px`,
    },
  };
}

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {(number | null)[]} slots
 * @returns {Promise<number>}
 */
export async function resolveThumbAspect(pdf, slots) {
  const pageNums = [
    ...new Set(
      slots.filter((n) => n != null && n >= 1 && n <= pdf.numPages),
    ),
  ];
  if (pageNums.length === 0) return DEFAULT_THUMB_ASPECT;

  const aspects = await Promise.all(
    pageNums.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      return viewport.width / viewport.height;
    }),
  );

  const valid = aspects.filter((a) => Number.isFinite(a) && a > 0);
  if (valid.length === 0) return DEFAULT_THUMB_ASPECT;

  return Math.max(...valid);
}
