/**
 * PDF → TXT 내려받기 (브라우저 로컬).
 * 검수전 추출 → 줄바꿈 확인 → 최종 TXT.
 */
import { extractAllPagesText, loadPdfFromBuffer } from './pdfService.js';
import { isPdfSizeOverMax, PDF_SIZE_MAX_MESSAGE } from './pdfSizeLimits.js';
import { cleanPageLinesForTxt } from './pdfTxtBodyClean.js';
import {
  applyLinebreakDecisions,
  findLinebreakCandidates,
  joinPagesWithMarkers,
} from './pdfTxtLinebreakReview.js';

/**
 * @param {string} filename
 * @returns {string}
 */
export function pdfStemFromName(filename) {
  const base = String(filename ?? 'document')
    .replace(/\.pdf$/i, '')
    .trim();
  return base || 'document';
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function txtFilenameFromPdfName(filename) {
  const stem = pdfStemFromName(filename).replace(/_검수전$/u, '');
  return `${stem || 'document'}_검수전.txt`;
}

/**
 * 화면 확인 후 최종본 — `_검수전` 없음.
 * @param {string} filename
 * @returns {string}
 */
export function finalTxtFilenameFromPdfName(filename) {
  const stem = pdfStemFromName(filename).replace(/_검수전$/u, '');
  return `${stem || 'document'}.txt`;
}

/**
 * Windows 메모장·한글용 — UTF-8 BOM + CRLF.
 * @param {string} text
 * @returns {string}
 */
export function encodeTxtForDownload(text) {
  const body = String(text ?? '').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return `\uFEFF${body}`;
}

/**
 * @param {string} text
 * @param {string} filename
 */
export function downloadTextFile(text, filename) {
  const blob = new Blob([encodeTxtForDownload(text)], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {{ pageNum?: number, text?: string, visualText?: string, items?: import('pdfjs-dist').TextItem[] }[]} pages
 * @returns {string}
 */
export function joinPagesAsTxt(pages) {
  return joinPagesWithMarkers(cleanPageLinesForTxt(pages));
}

/**
 * @param {File} file
 * @param {{ onProgress?: (current: number, total: number) => void }} [opts]
 * @returns {Promise<{
 *   sourceName: string,
 *   pageCount: number,
 *   cleanedPages: { pageNum: number, lines: string[] }[],
 *   draftWithMarkers: string,
 *   candidates: import('./pdfTxtLinebreakReview.js').LinebreakCandidate[],
 *   draftFilename: string,
 *   finalFilename: string,
 * }>}
 */
export async function preparePdfTxtReview(file, opts = {}) {
  if (!file || file.type !== 'application/pdf') {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      throw new Error('PDF 파일만 TXT로 변환할 수 있습니다.');
    }
  }
  if (isPdfSizeOverMax(file.size)) {
    throw new Error(PDF_SIZE_MAX_MESSAGE);
  }
  const raw = await file.arrayBuffer();
  const buffer = raw.slice(0);
  const pdf = await loadPdfFromBuffer(buffer);
  try {
    const pages = await extractAllPagesText(pdf, opts.onProgress);
    const cleanedPages = cleanPageLinesForTxt(pages);
    const draftWithMarkers = joinPagesWithMarkers(cleanedPages);
    if (!draftWithMarkers.trim()) {
      throw new Error(
        '이 PDF에서 글자를 읽지 못했습니다. 스캔본이 아닌 텍스트 PDF인지 확인해 주세요.',
      );
    }
    return {
      sourceName: file.name,
      pageCount: pages.length,
      cleanedPages,
      draftWithMarkers,
      candidates: findLinebreakCandidates(cleanedPages),
      draftFilename: txtFilenameFromPdfName(file.name),
      finalFilename: finalTxtFilenameFromPdfName(file.name),
    };
  } finally {
    await pdf.destroy?.();
  }
}

/**
 * @param {{ pageNum: number, lines: string[] }[]} cleanedPages
 * @param {Record<string, 'join' | 'keep'>} decisions
 * @returns {string}
 */
export function buildFinalTxt(cleanedPages, decisions) {
  return applyLinebreakDecisions(cleanedPages, decisions);
}

/**
 * @param {File} file
 * @param {{ onProgress?: (current: number, total: number) => void }} [opts]
 * @returns {Promise<{ filename: string, text: string, pageCount: number }>}
 */
export async function convertPdfFileToTxt(file, opts = {}) {
  const prepared = await preparePdfTxtReview(file, opts);
  return {
    filename: prepared.draftFilename,
    text: prepared.draftWithMarkers,
    pageCount: prepared.pageCount,
  };
}
