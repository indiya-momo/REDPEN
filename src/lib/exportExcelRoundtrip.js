/** 엑셀 → 나중에 ManualFinding으로 올리기 위한 내려받기 열 (스펙 2026-11-20) */

export const MACHINE_COL_HEADERS = [
  '행ID※수정하지 마세요',
  'pageNum※수정하지 마세요',
  'start※수정하지 마세요',
  'end※수정하지 마세요',
  'pdfName※수정하지 마세요',
  'pdfPages※수정하지 마세요',
  'pageFp※수정하지 마세요',
];

export const EXCEL_ROUNDTRIP_EDIT_GUIDE =
  '수정안만 고치세요. 오른쪽 「※수정하지 마세요」 열은 건드리지 마세요.';

/**
 * 쪽 본문 짧은 지문 (같은 PDF·같은 추출 방식일 때만 일치).
 * @param {string} text
 */
export function pageTextFingerprint(text) {
  const s = String(text ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * @param {{ pageNum: number, start: number, end: number, sourceKey: string }} parts
 */
export function buildExportRowId({ pageNum, start, end, sourceKey }) {
  return `${pageNum}:${start}:${end}:${String(sourceKey ?? '')}`;
}

/**
 * MatchInstance 구간 — `index` 우선, 없으면 start/end.
 * @param {{ index?: number, start?: number, end?: number, matchedText?: string } | null | undefined} inst
 * @returns {{ start: number, end: number } | null}
 */
export function resolveExportInstanceRange(inst) {
  const matched = String(inst?.matchedText ?? '');
  const fromIndex = Number(inst?.index);
  const fromStart = Number(inst?.start);
  const start = Number.isFinite(fromIndex)
    ? fromIndex
    : Number.isFinite(fromStart)
      ? fromStart
      : NaN;
  if (!Number.isFinite(start) || start < 0) return null;
  const fromEnd = Number(inst?.end);
  const end =
    Number.isFinite(fromEnd) && fromEnd > start
      ? fromEnd
      : start + Math.max(matched.length, 0);
  return { start, end };
}

/**
 * @param {import('./pdfService.js').PageData[] | null | undefined} pageTexts
 * @returns {Map<number, string>}
 */
export function buildPageFingerprintMap(pageTexts) {
  /** @type {Map<number, string>} */
  const map = new Map();
  for (const page of pageTexts ?? []) {
    const n = Number(page?.pageNum);
    if (!Number.isFinite(n)) continue;
    map.set(n, pageTextFingerprint(page?.text ?? page?.visualText ?? ''));
  }
  return map;
}

/**
 * @param {{
 *   inst: object,
 *   sourceKey: string,
 *   pdfName?: string,
 *   pdfPages?: number | string,
 *   pageFpByNum?: Map<number, string>,
 * }} opts
 */
export function buildMachineExportFields({
  inst,
  sourceKey,
  pdfName = '',
  pdfPages = '',
  pageFpByNum,
}) {
  const pageNum = Number(inst?.pageNum);
  const range = resolveExportInstanceRange(inst);
  if (!Number.isFinite(pageNum) || !range) {
    return {
      rowId: '',
      pageNum: '',
      start: '',
      end: '',
      pdfName: String(pdfName ?? ''),
      pdfPages: pdfPages === '' || pdfPages == null ? '' : Number(pdfPages),
      pageFp: '',
    };
  }
  const pageFp =
    pageFpByNum?.get(pageNum) ??
    pageTextFingerprint('');
  return {
    rowId: buildExportRowId({
      pageNum,
      start: range.start,
      end: range.end,
      sourceKey,
    }),
    pageNum,
    start: range.start,
    end: range.end,
    pdfName: String(pdfName ?? ''),
    pdfPages: pdfPages === '' || pdfPages == null ? '' : Number(pdfPages),
    pageFp,
  };
}

/**
 * 엑셀이 `=` `+` `-` `@`로 시작하는 칸을 수식으로 열지 않게 문자열로 둔다.
 * @param {import('exceljs').Cell} cell
 * @param {string} value
 */
export function setExcelTextCell(cell, value) {
  const text = String(value ?? '');
  cell.value = text;
  cell.numFmt = '@';
}
