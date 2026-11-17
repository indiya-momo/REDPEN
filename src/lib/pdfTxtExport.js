/**
 * PDF → TXT 내려받기 (브라우저 로컬).
 * 조판 머리말·쪽수·캡션을 가려 내지 않은 추출본이다.
 */
import { extractAllPagesText, loadPdfFromBuffer } from './pdfService.js';
import { isPdfSizeOverMax, PDF_SIZE_MAX_MESSAGE } from './pdfSizeLimits.js';

/**
 * @param {string} filename
 * @returns {string}
 */
export function txtFilenameFromPdfName(filename) {
  const base = String(filename ?? 'document')
    .replace(/\.pdf$/i, '')
    .trim();
  return `${base || 'document'}.txt`;
}

/**
 * @param {string} text
 * @param {string} filename
 */
export function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @returns {string}
 */
export function joinPagesAsTxt(pages) {
  return (pages ?? [])
    .map((page) => {
      const body = String(page.visualText ?? page.text ?? '').replace(/\s+$/u, '');
      return body;
    })
    .filter((body) => body.length > 0)
    .join('\n\n');
}

/**
 * @param {File} file
 * @param {{ onProgress?: (current: number, total: number) => void }} [opts]
 * @returns {Promise<{ filename: string, text: string, pageCount: number }>}
 */
export async function convertPdfFileToTxt(file, opts = {}) {
  if (!file || file.type !== 'application/pdf') {
    if (!file?.name?.toLowerCase().endsWith('.pdf')) {
      throw new Error('PDF 파일만 TXT로 변환할 수 있습니다.');
    }
  }
  if (isPdfSizeOverMax(file.size)) {
    throw new Error(PDF_SIZE_MAX_MESSAGE);
  }
  const buffer = await file.arrayBuffer();
  const pdf = await loadPdfFromBuffer(buffer);
  try {
    const pages = await extractAllPagesText(pdf, opts.onProgress);
    const text = joinPagesAsTxt(pages);
    if (!text.trim()) {
      throw new Error(
        '이 PDF에서 글자를 읽지 못했습니다. 스캔본이 아닌 텍스트 PDF인지 확인해 주세요.',
      );
    }
    return {
      filename: txtFilenameFromPdfName(file.name),
      text,
      pageCount: pages.length,
    };
  } finally {
    await pdf.destroy?.();
  }
}
