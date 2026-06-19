import {
  buildPhysicalLines,
  getLineContextAtTextIndex,
  isStandaloneTitleOnLine,
} from '../toc-body/lib/pdfHeadingExtract.js';
import { findPhraseRangeOnLine } from './pdfHighlightRange.js';

/**
 * @typedef {Object} PhraseOccurrence
 * @property {number} index
 * @property {string} matchedText
 * @property {string} lineText
 * @property {number} maxFont
 * @property {number} y
 * @property {boolean} standalone
 */

/**
 * 페이지에서 구문이 나오는 모든 위치(줄·글꼴 크기·단독 소제목 여부)
 * @param {import('./pdfService.js').PageData} page
 * @param {string} phrase
 * @returns {PhraseOccurrence[]}
 */
export function findPhraseOccurrencesOnPage(page, phrase) {
  const needle = String(phrase ?? '').trim();
  if (!needle || !page?.text) return [];

  /** @type {PhraseOccurrence[]} */
  const out = [];
  let offset = 0;
  for (const rawLine of page.text.split('\n')) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const onLine = findPhraseRangeOnLine(rawLine, needle);
    if (!onLine) continue;

    const index = lineStart + onLine.start;
    const matchedText = page.text.slice(lineStart + onLine.start, lineStart + onLine.end);
    if (!matchedText) continue;

    const ctx = getLineContextAtTextIndex(page, index);
    out.push({
      index,
      matchedText,
      lineText: ctx?.lineText ?? '',
      maxFont: ctx?.maxFont ?? 0,
      y: ctx?.y ?? 0,
      standalone: ctx
        ? isStandaloneTitleOnLine(ctx.lineText, matchedText)
        : false,
    });
  }
  return out;
}

/**
 * @param {import('./pdfService.js').PageData | undefined} page
 * @param {import('./ruleEngine.js').MatchInstance} instance
 */
export function isBodyMentionOnlyMatch(page, instance) {
  if (!page?.itemRefs?.length || !instance?.matchedText) return false;
  const ctx = getLineContextAtTextIndex(page, instance.index);
  if (!ctx?.lineText) return false;
  return !isStandaloneTitleOnLine(ctx.lineText, instance.matchedText);
}

/**
 * page.text 줄 분리와 달리 PDF y밴드상 한 줄인 소제목 등 (붙여 추출 줄)
 * @param {import('./pdfService.js').PageData} page
 * @param {string} phrase
 * @returns {{ index: number, matchedText: string, standalone: boolean }[]}
 */
/**
 * @param {number[]} indexMap
 * @param {number} bandStart
 * @param {number} bandEnd
 */
function mapBandRangeToPage(indexMap, bandStart, bandEnd) {
  if (!indexMap.length || bandStart >= bandEnd) return null;
  const start = indexMap[bandStart];
  const endChar = indexMap[Math.min(bandEnd - 1, indexMap.length - 1)];
  if (start == null || endChar == null) return null;
  return { start, end: endChar + 1 };
}

export function scanPhysicalLinesForPhrase(page, phrase) {
  const needle = String(phrase ?? '').trim();
  if (!needle || !page?.itemRefs?.length) return [];

  /** @type {{ index: number, matchedText: string, standalone: boolean }[]} */
  const out = [];
  for (const line of buildPhysicalLines(page)) {
    if (!findPhraseRangeOnLine(line.text, needle)) continue;

    const ctx = getLineContextAtTextIndex(page, line.startIndex);
    if (!ctx) continue;

    /** @type {number[]} */
    const indexMap = [];
    let band = '';
    for (let i = ctx.lineStart; i < ctx.lineEnd; i++) {
      const ch = page.text[i] ?? '';
      if (ch === '\n') continue;
      band += ch;
      indexMap.push(i);
    }
    const onBand = findPhraseRangeOnLine(band, needle);
    if (!onBand) continue;

    const mapped = mapBandRangeToPage(indexMap, onBand.start, onBand.end);
    if (!mapped) continue;

    const matchedText = page.text.slice(mapped.start, mapped.end);
    if (!matchedText) continue;

    out.push({
      index: mapped.start,
      matchedText,
      standalone: isStandaloneTitleOnLine(ctx.lineText, matchedText),
    });
  }
  return out;
}
