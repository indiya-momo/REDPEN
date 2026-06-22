/** 스크롤·줌 오차(서브픽셀·스크롤바) 허용 */
export const PDF_STAGE_OVERFLOW_EPSILON = 1;

/**
 * @param {HTMLElement | null | undefined} stage
 * @param {HTMLElement | null | undefined} wrap
 * @param {number} [epsilon]
 */
export function pdfPageOverflowsStage(stage, wrap, epsilon = PDF_STAGE_OVERFLOW_EPSILON) {
  if (!stage || !wrap) return false;
  return (
    wrap.offsetWidth > stage.clientWidth + epsilon ||
    wrap.offsetHeight > stage.clientHeight + epsilon
  );
}

/**
 * @param {HTMLElement | null | undefined} stage
 */
export function scrollPdfStageToOrigin(stage) {
  if (!stage) return;
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
}

/**
 * @param {HTMLElement | null | undefined} stage
 * @param {HTMLElement | null | undefined} wrap
 */
export function scrollPdfStageToCenter(stage, wrap) {
  if (!stage) return;
  stage.scrollLeft = Math.max(
    0,
    (wrap.offsetWidth - stage.clientWidth) / 2,
  );
  stage.scrollTop = Math.max(
    0,
    (wrap.offsetHeight - stage.clientHeight) / 2,
  );
}

/**
 * 원고가 뷰포트보다 크면 scroll을 가운데, 아니면 (0,0).
 * 시각적 맞춤(100% 이하)은 CSS flex center가 담당한다.
 *
 * @param {HTMLElement | null | undefined} stage
 * @param {HTMLElement | null | undefined} wrap
 */
export function syncPdfStageScroll(stage, wrap) {
  if (!stage || !wrap) return;
  if (pdfPageOverflowsStage(stage, wrap)) {
    scrollPdfStageToCenter(stage, wrap);
  } else {
    scrollPdfStageToOrigin(stage);
  }
}

/**
 * 레이아웃·캔버스 치수 반영 후 scroll 동기화 (paint 이후).
 *
 * @param {HTMLElement | null | undefined} stage
 * @param {HTMLElement | null | undefined} wrap
 */
export function syncPdfStageScrollAfterLayout(stage, wrap) {
  if (!stage || !wrap) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncPdfStageScroll(stage, wrap);
    });
  });
}
