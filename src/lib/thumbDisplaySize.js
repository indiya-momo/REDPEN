/** PDF 렌더 스케일 기준 높이 (--pdf-thumb-frame-h @ scale 0.8, 1rem=16px) */
export const THUMB_HEIGHT_PX = 62;

/**
 * CSS .pdf-thumb__frame 과 동일한 표시 박스 (padding·border 제외 내부 영역)
 * --pdf-thumb-frame-w/h × --pdf-thumb-scale(0.8)
 */
export const THUMB_FIT_BOX_W_PX = 43;
export const THUMB_FIT_BOX_H_PX = THUMB_HEIGHT_PX;

const THUMB_PORTRAIT_ASPECT = 3.375 / 4.875;

/**
 * 고정 프레임 안에 비율을 유지하며 맞춤(contain).
 *
 * @param {number} [aspectWidthOverHeight]
 * @param {number} [boxW]
 * @param {number} [boxH]
 * @returns {{ displayW: number, displayH: number, aspect: number }}
 */
export function thumbFitInBox(
  aspectWidthOverHeight,
  boxW = THUMB_FIT_BOX_W_PX,
  boxH = THUMB_FIT_BOX_H_PX,
) {
  const aspect =
    Number.isFinite(aspectWidthOverHeight) && aspectWidthOverHeight > 0
      ? aspectWidthOverHeight
      : THUMB_PORTRAIT_ASPECT;
  const boxAspect = boxW / boxH;

  let displayW;
  let displayH;
  if (aspect >= boxAspect) {
    displayW = boxW;
    displayH = Math.max(1, Math.round(boxW / aspect));
  } else {
    displayH = boxH;
    displayW = Math.max(1, Math.round(boxH * aspect));
  }

  return { displayW, displayH, aspect };
}

/** @deprecated thumbFitInBox 사용 */
export function thumbDisplaySize(aspectWidthOverHeight, heightPx = THUMB_HEIGHT_PX) {
  const aspect =
    Number.isFinite(aspectWidthOverHeight) && aspectWidthOverHeight > 0
      ? aspectWidthOverHeight
      : THUMB_PORTRAIT_ASPECT;
  const displayH = heightPx;
  const displayW = Math.max(1, Math.round(displayH * aspect));
  return { displayW, displayH, aspect };
}
