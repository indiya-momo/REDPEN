import { DEFAULT_THUMB_ASPECT } from './thumbDisplaySize.js';

/**
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf
 * @param {number[]} pageNums
 * @returns {Promise<number>}
 */
export async function resolveThumbAspect(pdf, pageNums) {
  const unique = [...new Set(pageNums.filter((n) => n >= 1 && n <= pdf.numPages))];
  if (unique.length === 0) return DEFAULT_THUMB_ASPECT;

  const aspects = await Promise.all(
    unique.map(async (pageNum) => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      return viewport.width / viewport.height;
    }),
  );

  const valid = aspects.filter((a) => Number.isFinite(a) && a > 0);
  if (valid.length === 0) return DEFAULT_THUMB_ASPECT;

  // 슬롯 중 가장 넓은 면(가로 스프레드)에 맞춘다.
  return Math.max(...valid);
}
