/** PDF 렌더·표시 기준 높이 (--pdf-thumb-frame-h @ scale 0.8, 1rem=16px) */
export const THUMB_HEIGHT_PX = 62;

/** 세로 단면 기본 비율 (CSS 초기값·폴백) */
export const DEFAULT_THUMB_ASPECT = 3.375 / 4.875;

/**
 * 원고와 동일 비율 — 높이 고정, 너비는 페이지 가로세로비에 비례.
 *
 * @param {number} [aspectWidthOverHeight]
 * @param {number} [heightPx]
 * @returns {{ displayW: number, displayH: number, aspect: number }}
 */
export function thumbDisplaySize(
  aspectWidthOverHeight,
  heightPx = THUMB_HEIGHT_PX,
) {
  const aspect =
    Number.isFinite(aspectWidthOverHeight) && aspectWidthOverHeight > 0
      ? aspectWidthOverHeight
      : DEFAULT_THUMB_ASPECT;
  const displayH = heightPx;
  const displayW = Math.max(1, Math.round(displayH * aspect));
  return { displayW, displayH, aspect };
}
