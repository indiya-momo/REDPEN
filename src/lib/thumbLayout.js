import { DEFAULT_THUMB_ASPECT, thumbDisplaySize } from './thumbDisplaySize.js';

/** 미리보기 바 --pdf-thumb-scale 과 동일 */
export const THUMB_SCALE = 0.8;

/** 표시 높이 기준 (px, scale 적용 전) */
export const THUMB_BASE_HEIGHT_PX = 62;

export const THUMB_SLOT_COUNT = 5;

const THUMB_GAP_PX = Math.round(4 * THUMB_SCALE);
const THUMB_STRIP_PAD_X = Math.round(8 * THUMB_SCALE);
const THUMB_STRIP_PAD_Y = Math.round(8 * THUMB_SCALE);
const THUMB_LABEL_GAP_PX = 2;
const THUMB_LABEL_HEIGHT_PX = Math.round(14 * THUMB_SCALE);

/**
 * @param {number} [scale]
 * @returns {number}
 */
export function scaledThumbHeightPx(scale = THUMB_SCALE) {
  return Math.round(THUMB_BASE_HEIGHT_PX * scale);
}

/**
 * 원고 비율 하나로 썸네일·슬롯·스트립 창 크기를 모두 계산한다.
 *
 * @param {number} aspectWidthOverHeight
 * @param {number} [scale]
 */
export function computeThumbLayout(aspectWidthOverHeight, scale = THUMB_SCALE) {
  const aspect =
    Number.isFinite(aspectWidthOverHeight) && aspectWidthOverHeight > 0
      ? aspectWidthOverHeight
      : DEFAULT_THUMB_ASPECT;
  const displayH = scaledThumbHeightPx(scale);
  const { displayW } = thumbDisplaySize(aspect, displayH);

  const slotW = displayW;
  const slotH = displayH + THUMB_LABEL_GAP_PX + THUMB_LABEL_HEIGHT_PX;
  const rowW = THUMB_SLOT_COUNT * slotW + (THUMB_SLOT_COUNT - 1) * THUMB_GAP_PX;
  const stripW = rowW + 2 * THUMB_STRIP_PAD_X;
  const stripH = slotH + 2 * THUMB_STRIP_PAD_Y;

  return {
    aspect,
    scale,
    displayW,
    displayH,
    slotW,
    slotH,
    gap: THUMB_GAP_PX,
    stripPadX: THUMB_STRIP_PAD_X,
    stripPadY: THUMB_STRIP_PAD_Y,
    stripW,
    stripH,
  };
}

/**
 * @param {number} aspectWidthOverHeight
 * @param {number} [scale]
 * @returns {Record<string, string>}
 */
export function thumbStripCssVars(aspectWidthOverHeight, scale = THUMB_SCALE) {
  const layout = computeThumbLayout(aspectWidthOverHeight, scale);
  return {
    '--pdf-thumb-display-w': `${layout.displayW}px`,
    '--pdf-thumb-display-h': `${layout.displayH}px`,
    '--pdf-thumb-slot-w': `${layout.slotW}px`,
    '--pdf-thumb-slot-h': `${layout.slotH}px`,
    '--pdf-thumb-gap': `${layout.gap}px`,
    '--pdf-thumb-strip-pad-x': `${layout.stripPadX}px`,
    '--pdf-thumb-strip-pad-y': `${layout.stripPadY}px`,
    '--pdf-thumb-strip-w': `${layout.stripW}px`,
    '--pdf-thumb-strip-h': `${layout.stripH}px`,
  };
}
