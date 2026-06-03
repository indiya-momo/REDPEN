import { escapeRegex } from './compoundPatternCommon.js';
import {
  getLineContextAtTextIndex,
  isStandaloneTitleOnLine,
} from '../toc-body/lib/pdfHeadingExtract.js';

const FIND_GAP = String.raw`[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*`;

/**
 * @param {string} line
 * @param {string} matchedText
 * @returns {{ start: number, end: number } | null}
 */
export function findPhraseRangeOnLine(line, matchedText) {
  const phrase = String(matchedText ?? '').trim();
  if (!phrase || !line) return null;

  const lineN = line.normalize('NFKC');
  const phraseN = phrase.normalize('NFKC');

  const exact = lineN.indexOf(phraseN);
  if (exact >= 0) {
    return { start: exact, end: exact + phraseN.length };
  }

  const parts = phraseN.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const re = new RegExp(
      parts.map(escapeRegex).join(FIND_GAP),
      'u',
    );
    const m = re.exec(lineN);
    if (m?.index != null && m[0]) {
      return { start: m.index, end: m.index + m[0].length };
    }
  }

  const glued = parts.join('');
  if (glued) {
    const at = lineN.indexOf(glued);
    if (at >= 0) return { start: at, end: at + glued.length };
  }

  return null;
}

/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {string} matchedText
 * @returns {{ start: number, end: number, lineText: string }[]}
 */
function collectPhraseRangesOnPage(pageData, matchedText) {
  /** @type {{ start: number, end: number, lineText: string }[]} */
  const ranges = [];
  let offset = 0;
  for (const rawLine of pageData.text.split('\n')) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const onLine = findPhraseRangeOnLine(rawLine, matchedText);
    if (!onLine) continue;
    ranges.push({
      start: lineStart + onLine.start,
      end: lineStart + onLine.end,
      lineText: rawLine.replace(/\s+/g, ' ').trim(),
    });
  }
  return ranges;
}

/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {number} index
 * @param {string} matchedText
 * @param {{ start: number, end: number, lineText: string }[]} ranges
 */
function pickHighlightRange(pageData, index, matchedText, ranges) {
  if (!ranges.length) return null;

  const containing = ranges.filter(
    (r) => index >= r.start && index < r.end,
  );
  const pool = containing.length ? containing : ranges;

  let best = pool[0];
  let bestScore = -Infinity;
  for (const r of pool) {
    const ctx = getLineContextAtTextIndex(pageData, r.start);
    const standalone = isStandaloneTitleOnLine(r.lineText, matchedText);
    const dist = Math.abs(r.start - index);
    const score =
      (standalone ? 1_000 : 0) +
      (ctx?.maxFont ?? 0) * 10 -
      dist * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return { start: best.start, end: best.end };
}

/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {{ index: number, matchedText: string }} instance
 * @returns {{ start: number, end: number } | null}
 */
export function resolveHighlightRange(pageData, instance) {
  if (!pageData?.text || !instance?.matchedText) return null;

  const { index, matchedText } = instance;
  const end = index + matchedText.length;
  const slice = pageData.text.slice(index, end);
  if (slice === matchedText) {
    return { start: index, end };
  }

  const allRanges = collectPhraseRangesOnPage(pageData, matchedText);
  const containing = allRanges.filter(
    (r) => index >= r.start && index < r.end,
  );
  if (containing.length) {
    return pickHighlightRange(pageData, index, matchedText, containing);
  }
  const picked = pickHighlightRange(pageData, index, matchedText, allRanges);
  if (picked) return picked;

  const ctx = getLineContextAtTextIndex(pageData, index);
  if (ctx) {
    const line = pageData.text.slice(ctx.lineStart, ctx.lineEnd);
    const onLine = findPhraseRangeOnLine(line, matchedText);
    if (onLine) {
      return {
        start: ctx.lineStart + onLine.start,
        end: ctx.lineStart + onLine.end,
      };
    }
  }

  const windowStart = Math.max(0, index - 120);
  const windowEnd = Math.min(pageData.text.length, index + 120);
  const window = pageData.text.slice(windowStart, windowEnd);
  const onWindow = findPhraseRangeOnLine(window, matchedText);
  if (onWindow) {
    return {
      start: windowStart + onWindow.start,
      end: windowStart + onWindow.end,
    };
  }

  return null;
}
