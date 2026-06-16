import { escapeRegex } from './compoundPatternCommon.js';
import {
  getLineContextAtTextIndex,
  isStandaloneTitleOnLine,
} from '../toc-body/lib/pdfHeadingExtract.js';

const FIND_GAP = String.raw`[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]*`;

/** @param {string} ch */
function isSpaceChar(ch) {
  return /\s/.test(ch);
}

/**
 * span 안에서 phrase를 찾는다. phrase·span 사이 합성 공백(음절 경계)은 무시.
 * @param {string} span
 * @param {string} phrase
 * @returns {{ start: number, end: number } | null}
 */
export function findPhraseInSpan(span, phrase) {
  const phraseN = String(phrase ?? '').trim().normalize('NFKC');
  const spanN = String(span ?? '').normalize('NFKC');
  if (!phraseN || !spanN) return null;

  for (let i = 0; i <= spanN.length - phraseN.length; i += 1) {
    if (spanN.slice(i, i + phraseN.length) === phraseN) {
      return { start: i, end: i + phraseN.length };
    }
  }

  const gluedPhrase = phraseN.replace(/\s+/g, '');
  if (!gluedPhrase) return null;

  for (let i = 0; i < spanN.length; i += 1) {
    if (isSpaceChar(spanN[i])) continue;
    let gi = 0;
    let j = i;
    while (j < spanN.length && gi < gluedPhrase.length) {
      if (isSpaceChar(spanN[j])) {
        j += 1;
        continue;
      }
      if (spanN[j] !== gluedPhrase[gi]) break;
      gi += 1;
      j += 1;
    }
    if (gi === gluedPhrase.length) {
      return { start: i, end: j };
    }
  }

  return null;
}

/**
 * @param {{ start: number, end: number }[]} candidates
 * @param {number} preferNear
 */
function pickNearestRange(candidates, preferNear) {
  if (!candidates.length) return null;
  if (preferNear < 0) return candidates[0];

  let best = candidates[0];
  let bestDist = Math.abs(best.start - preferNear);
  for (const c of candidates.slice(1)) {
    const dist = Math.abs(c.start - preferNear);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * @param {string} lineN
 * @param {string} phraseN
 * @returns {{ start: number, end: number }[]}
 */
function collectExactRanges(lineN, phraseN) {
  /** @type {{ start: number, end: number }[]} */
  const out = [];
  let pos = 0;
  while (pos <= lineN.length - phraseN.length) {
    const at = lineN.indexOf(phraseN, pos);
    if (at < 0) break;
    out.push({ start: at, end: at + phraseN.length });
    pos = at + 1;
  }
  return out;
}

/**
 * @param {string} line
 * @param {string} matchedText
 * @param {number} [preferNear] — 줄 내 상대 인덱스(가까운 후보 우선)
 * @returns {{ start: number, end: number } | null}
 */
export function findPhraseRangeOnLine(line, matchedText, preferNear = -1) {
  const phrase = String(matchedText ?? '').trim();
  if (!phrase || !line) return null;

  const lineN = line.normalize('NFKC');
  const phraseN = phrase.normalize('NFKC');

  const exact = collectExactRanges(lineN, phraseN);
  if (exact.length) {
    return pickNearestRange(exact, preferNear);
  }

  const parts = phraseN.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const re = new RegExp(parts.map(escapeRegex).join(FIND_GAP), 'gu');
    /** @type {{ start: number, end: number }[]} */
    const flex = [];
    let m;
    while ((m = re.exec(lineN)) !== null) {
      if (!m[0]) {
        re.lastIndex += 1;
        continue;
      }
      flex.push({ start: m.index, end: m.index + m[0].length });
    }
    const picked = pickNearestRange(flex, preferNear);
    if (picked) return picked;
  }

  const glued = parts.join('');
  if (glued) {
    /** @type {{ start: number, end: number }[]} */
    const gluedRanges = [];
    for (let i = 0; i < lineN.length; i += 1) {
      const found = findPhraseInSpan(lineN.slice(i), glued);
      if (found?.start === 0) {
        gluedRanges.push({ start: i, end: i + found.end });
      }
    }
    const picked = pickNearestRange(gluedRanges, preferNear);
    if (picked) return picked;
  }

  return null;
}

/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {string} matchedText
 * @param {number} preferNear
 * @returns {{ start: number, end: number, lineText: string }[]}
 */
function collectPhraseRangesOnPage(pageData, matchedText, preferNear) {
  /** @type {{ start: number, end: number, lineText: string }[]} */
  const ranges = [];
  let offset = 0;
  for (const rawLine of pageData.text.split('\n')) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const onLine = findPhraseRangeOnLine(rawLine, matchedText, preferNear - lineStart);
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
 * @param {{ index: number, matchedText: string, highlightText?: string, highlightIndex?: number }} instance
 * @returns {{ start: number, end: number } | null}
 */
export function resolveHighlightRange(pageData, instance) {
  if (!pageData?.text || !instance?.matchedText) return null;

  const matchIndex = instance.index ?? 0;
  const { matchedText } = instance;
  const phrase = String(instance.highlightText ?? matchedText).trim();
  if (!phrase) return null;

  const matchEnd = matchIndex + matchedText.length;

  // 편집자 검토: 매칭된 구간 안의 어간(highlightText)만 — 페이지 전체 재검색 없음
  if (instance.highlightText?.trim()) {
    const withinMatch = findPhraseInSpan(
      pageData.text.slice(matchIndex, matchEnd),
      phrase,
    );
    if (withinMatch) {
      return {
        start: matchIndex + withinMatch.start,
        end: matchIndex + withinMatch.end,
      };
    }
    const anchorIndex =
      instance.highlightIndex ??
      matchIndex + Math.max(0, matchedText.length - phrase.length);
    return { start: anchorIndex, end: anchorIndex + phrase.length };
  }

  const phraseEnd = matchIndex + phrase.length;
  if (pageData.text.slice(matchIndex, phraseEnd) === phrase) {
    return { start: matchIndex, end: phraseEnd };
  }

  const matchSpanLen = Math.max(matchedText.length, phrase.length);
  const pageSpan = pageData.text.slice(matchIndex, matchIndex + matchSpanLen);
  const inSpan = findPhraseInSpan(pageSpan, phrase);
  if (inSpan) {
    return {
      start: matchIndex + inSpan.start,
      end: matchIndex + inSpan.end,
    };
  }

  const ctx = getLineContextAtTextIndex(pageData, matchIndex);
  if (ctx) {
    const line = pageData.text.slice(ctx.lineStart, ctx.lineEnd);
    const relIndex = matchIndex - ctx.lineStart;
    const onLine = findPhraseRangeOnLine(line, phrase, relIndex);
    if (onLine) {
      return {
        start: ctx.lineStart + onLine.start,
        end: ctx.lineStart + onLine.end,
      };
    }
  }

  const allRanges = collectPhraseRangesOnPage(pageData, phrase, matchIndex);
  const containing = allRanges.filter(
    (r) => matchIndex >= r.start && matchIndex < r.end,
  );
  if (containing.length) {
    return pickHighlightRange(pageData, matchIndex, phrase, containing);
  }
  const picked = pickHighlightRange(pageData, matchIndex, phrase, allRanges);
  if (picked) return picked;

  const windowStart = Math.max(0, matchIndex - 120);
  const windowEnd = Math.min(pageData.text.length, matchIndex + 120);
  const window = pageData.text.slice(windowStart, windowEnd);
  const onWindow = findPhraseRangeOnLine(
    window,
    phrase,
    matchIndex - windowStart,
  );
  if (onWindow) {
    return {
      start: windowStart + onWindow.start,
      end: windowStart + onWindow.end,
    };
  }

  return null;
}
