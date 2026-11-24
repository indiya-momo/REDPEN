/**
 * 오른자리 옮김표(들여쓰기) — 표 이미지와 같은 연속 path.
 *
 *      │   ← 위 눈금 (팔 끝에서 위로만)
 *   ┌──┘
 *   │      ← 왼쪽 세로
 *   └──┐
 *      │   ← 아래 눈금 (팔 끝에서 아래로만)
 *
 * M(xR,yTop) V(yArm1) H(xL) V(yArm2) H(xR) V(yBottom)
 * 오른쪽에서 위·아래 눈금을 잇는 세로선 없음.
 */

/**
 * @param {{ left: number, top: number, width: number, height: number }} charBox
 * @returns {{
 *   xL: number,
 *   xR: number,
 *   yTop: number,
 *   yArm1: number,
 *   yArm2: number,
 *   yBottom: number,
 *   strokeWidth: number,
 *   pathD: string,
 * } | null}
 */
export function indentMarkGeometry(charBox) {
  if (!charBox || !(charBox.width > 0) || !(charBox.height > 0)) return null;

  const yArm1 = charBox.top;
  const yArm2 = charBox.top + charBox.height;
  const spine = yArm2 - yArm1;
  /* 눈금 각 ~25%, 가운데 세로 ~50% → 눈금 = spine/2, 전체 = 2*spine */
  const tickLen = Math.max(2, spine * 0.5);
  const yTop = yArm1 - tickLen;
  const yBottom = yArm2 + tickLen;
  const totalH = yBottom - yTop;

  const gap = Math.max(1, charBox.width * 0.12);
  const xL = charBox.left - gap;
  /* 팔 ≈ 전체 높이 30%, 또는 첫 글자가 들어가게 폭+여유 */
  const armLen = Math.max(totalH * 0.3, charBox.width + gap);
  const xR = xL + armLen;

  const strokeWidth = Math.max(1, spine * 0.08);
  const pathD = `M ${xR} ${yTop} V ${yArm1} H ${xL} V ${yArm2} H ${xR} V ${yBottom}`;

  return {
    xL,
    xR,
    yTop,
    yArm1,
    yArm2,
    yBottom,
    strokeWidth,
    pathD,
    /* PdfViewer 호환 별칭 */
    x: xL,
    top: yArm1,
    bottom: yArm2,
    armRight: xR,
  };
}

/**
 * @param {string} text
 * @param {number} start
 */
export function firstGraphemeEnd(text, start) {
  const s = Math.max(0, Number(start) || 0);
  const slice = String(text ?? '').slice(s, s + 8);
  if (!slice) return s;
  const ch = Array.from(slice)[0];
  return s + (ch?.length ?? 1);
}

/**
 * @param {{
 *   page: import('pdfjs-dist').PDFPageProxy,
 *   viewport: import('pdfjs-dist').PageViewport,
 *   pageData: import('../pdfService.js').PageData,
 *   textIndex: number,
 *   highlightRectsForTextRange: Function,
 * }} args
 */
export function indentMarkGeometryFromPage({
  page,
  viewport,
  pageData,
  textIndex,
  highlightRectsForTextRange,
}) {
  const text = String(pageData?.text ?? pageData?.visualText ?? '');
  const start = Math.max(0, Number(textIndex) || 0);
  const end = firstGraphemeEnd(text, start);
  const charRects = highlightRectsForTextRange(
    page,
    viewport,
    pageData.items,
    pageData.itemRefs,
    start,
    end,
    pageData,
  );
  const charBox = charRects?.[0];
  if (!charBox) return null;
  return indentMarkGeometry(charBox);
}
