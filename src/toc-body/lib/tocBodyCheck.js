import { escapeRegex } from '../../lib/compoundPatternCommon.js';
import { isBodyMentionOnlyMatch } from '../../lib/pdfTextAudit.js';
import {
  collectTitleLineCandidates,
  extractPdfHeadingLines,
} from './pdfHeadingExtract.js';

/** @typedef {import('./pdfHeadingExtract.js').PdfHeadingLine} PdfHeadingLine */

/** 목차 제목 — 단어(어절) 사이: 공백·줄바꿈 1칸 이상 */
const TOC_TITLE_FLEX_SPACE = String.raw`(?:[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\uFEFF]+|[\r\n])+`;

/** 같은 어절 안 음절 사이: 붙어 있거나(PDF 한 덩어리) 줄바꿈으로 쪼개진 경우 모두 */
const TOC_SYLLABLE_GAP = String.raw`(?:[ \t\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\uFEFF]|[\r\n])*`;

/** @typedef {'match' | 'missing' | 'mismatch' | 'outline-extra'} TocBodyStatus */

/** @typedef {import('../../lib/ruleEngine.js').GroupedResult & {
 *   patternKind: 'toc-body',
 *   tocStatus: TocBodyStatus,
 *   tocLineIndex: number,
 *   outlineHint?: PdfHeadingLine | null,
 *   tocMismatchReason?: 'body-mention-only',
 * }} TocBodyGroup */

const TOC_STATUS_ORDER = /** @type {const} */ ({
  match: 0,
  missing: 1,
  mismatch: 2,
  'outline-extra': 3,
});

export const TOC_STATUS_LABELS = {
  match: '일치',
  missing: '누락',
  mismatch: '불일치 예상',
  'outline-extra': 'PDF 제목만',
};

const OUTLINE_MATCH_THRESHOLD = 0.88;
const OUTLINE_HINT_THRESHOLD = 0.72;

/** 목차 조판용 세로선(│｜┃|) — 본문에는 없음 */
const TOC_BAR_SPLIT = /[│｜┃|]/;
const TOC_BAR_REPLACE = /[│｜┃|]/g;

const TOC_PAGE_NUM = String.raw`[0-9０-９]{1,4}`;

/**
 * @param {string} digits
 * @returns {number | null}
 */
export function parseTocPageDigits(digits) {
  const normalized = String(digits).replace(
    /[０-９]/g,
    (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  const n = Number.parseInt(normalized, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/**
 * 목차 줄·조각 끝 쪽수 (아라비아·전각)
 * @param {string} segment
 * @returns {number | null}
 */
export function parseTrailingTocPage(segment) {
  const t = String(segment ?? '').trim();
  if (!t) return null;
  const leader = t.match(
    new RegExp(`[.…··\\u2024-\\u2027]+\\s*(${TOC_PAGE_NUM})\\s*$`),
  );
  if (leader) return parseTocPageDigits(leader[1]);
  const spaced = t.match(new RegExp(`\\s+(${TOC_PAGE_NUM})\\s*$`));
  if (spaced) return parseTocPageDigits(spaced[1]);
  return null;
}

/**
 * @param {string} segment
 */
function stripTrailingTocPage(segment) {
  let t = segment;
  t = t.replace(
    new RegExp(`[.…··\\u2024-\\u2027]+\\s*${TOC_PAGE_NUM}\\s*$`),
    '',
  );
  t = t.replace(/[.…··\u2024-\u2027]+\s*$/u, '');
  t = t.replace(new RegExp(`\\s+${TOC_PAGE_NUM}\\s*$`), '');
  return t;
}

/**
 * 목차 한 조각(페이지 번호·│ 제거) — 본문 검색용 문자열
 * @param {string} segment
 */
export function normalizeTocLine(segment) {
  let t = String(segment ?? '').trim();
  if (!t) return '';
  t = t.replace(TOC_BAR_REPLACE, ' ');
  t = stripTrailingTocPage(t);
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} rawSegment
 */
function rawSegmentHasTrailingPage(rawSegment) {
  return parseTrailingTocPage(rawSegment) !== null;
}

/** @typedef {{ title: string, tocPage: number | null }} TocBodyEntry */

/**
 * `만들기  26 경제는` 은 항목 구분, `PART 1 경제는` 은 한 제목으로 본다
 * @param {string} left
 * @param {string} pageDigits
 * @param {string} right
 */
function isLikelyInternalTocSplit(left, pageDigits, right) {
  const tocPage = parseTocPageDigits(pageDigits);
  if (tocPage === null) return false;
  if (tocPage >= 10) return true;
  const l = left.trim();
  const r = right.trim();
  if (/^(PART|CHAPTER)$/i.test(l)) return false;
  if (/^(PART|CHAPTER)\s+\d{1,2}$/i.test(`${l} ${pageDigits.trim()}`)) {
    return false;
  }
  return /[\uAC00-\uD7A3]/.test(l) && /[\uAC00-\uD7A3]/.test(r);
}

function expandPlainTocLineEntries(line) {
  const normalized = line.replace(TOC_BAR_REPLACE, ' ').trim();
  if (!normalized) return [];

  /** @type {TocBodyEntry[]} */
  const out = [];
  let rest = normalized;
  const internalRe = new RegExp(`^(.+?)\\s+(${TOC_PAGE_NUM})\\s+(.+)$`);

  while (rest) {
    const m = rest.match(internalRe);
    if (m && isLikelyInternalTocSplit(m[1], m[2], m[3])) {
      const title = m[1].replace(/\s+/g, ' ').trim();
      const tocPage = parseTocPageDigits(m[2]);
      if (title) out.push({ title, tocPage });
      rest = m[3].trim();
      continue;
    }
    const title = normalizeTocLine(rest);
    const tocPage = parseTrailingTocPage(rest);
    if (title) out.push({ title, tocPage });
    break;
  }
  return out;
}

/**
 * @param {string} line
 * @returns {TocBodyEntry[]}
 */
function expandBarTocLineEntries(line) {
  const rawParts = line.split(TOC_BAR_SPLIT);
  /** @type {TocBodyEntry[]} */
  const out = [];
  for (const part of rawParts) {
    const title = normalizeTocLine(part);
    if (title) out.push({ title, tocPage: parseTrailingTocPage(part) });
  }

  const onlyLastHasPage =
    rawParts.length > 1 &&
    rawParts.slice(0, -1).every((p) => !rawSegmentHasTrailingPage(p)) &&
    rawSegmentHasTrailingPage(rawParts[rawParts.length - 1]);

  if (onlyLastHasPage) {
    const merged = normalizeTocLine(line.replace(TOC_BAR_REPLACE, ' '));
    const mergedPage = parseTrailingTocPage(rawParts[rawParts.length - 1] ?? line);
    if (merged && !out.some((e) => e.title === merged)) {
      out.push({ title: merged, tocPage: mergedPage });
    }
  }

  return out;
}

/**
 * │·공백 목차 한 줄 → 검사 항목
 * - `제목1 26│제목2 29` / `만들기  26 경제는  29`(공백만) 모두 지원
 * @param {string} raw
 * @returns {TocBodyEntry[]}
 */
export function expandTocRawLineEntries(raw) {
  const line = String(raw ?? '').trim();
  if (!line) return [];
  if (TOC_BAR_SPLIT.test(line)) return expandBarTocLineEntries(line);
  return expandPlainTocLineEntries(line);
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function expandTocRawLine(raw) {
  return expandTocRawLineEntries(raw).map((e) => e.title);
}

/**
 * @param {string} line
 */
function isTocLineContinuation(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^(PART|CHAPTER)\s/i.test(t)) return false;
  if (/^다!/.test(t)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function preprocessTocTextLines(text) {
  const rawLines = String(text ?? '').split(/\r?\n/);
  /** @type {string[]} */
  const merged = [];
  for (const line of rawLines) {
    const t = line.trim();
    if (!t) continue;
    if (merged.length > 0 && isTocLineContinuation(t)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${t}`;
    } else {
      merged.push(t);
    }
  }
  return merged;
}

/**
 * @param {string} text
 * @returns {TocBodyEntry[]}
 */
export function parseTocBodyEntries(text) {
  const lines = preprocessTocTextLines(text);
  /** @type {TocBodyEntry[]} */
  const entries = [];
  const seen = new Set();
  for (const raw of lines) {
    for (const entry of expandTocRawLineEntries(raw)) {
      if (!entry.title || seen.has(entry.title)) continue;
      seen.add(entry.title);
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function parseTocBodyText(text) {
  return parseTocBodyEntries(text).map((e) => e.title);
}

/**
 * @param {string} s
 */
function normalizeCompareText(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** @type {Record<string, string>} */
const UNICODE_ROMAN_TO_ASCII = {
  'Ⅰ': 'I',
  'Ⅱ': 'II',
  'Ⅲ': 'III',
  'Ⅳ': 'IV',
  'Ⅴ': 'V',
  'Ⅵ': 'VI',
  'Ⅶ': 'VII',
  'Ⅷ': 'VIII',
  'Ⅸ': 'IX',
  'Ⅹ': 'X',
  'Ⅺ': 'XI',
  'Ⅻ': 'XII',
  'Ⅼ': 'L',
  'Ⅽ': 'C',
  'Ⅾ': 'D',
  'Ⅿ': 'M',
};

/**
 * @param {string} s
 */
function romanToAsciiDigits(s) {
  return [...s].map((c) => UNICODE_ROMAN_TO_ASCII[c] ?? c).join('');
}

/** 본문과 90% 이상 비슷하지만 완전 일치가 아니면 불일치 */
export const TOC_MISMATCH_SIMILARITY_THRESHOLD = 0.9;

/**
 * 유사도 비교용(로마 숫자 Ⅰ/I는 그대로, 공백·마침표만 제거)
 * @param {string} s
 */
function similarityKeyForToc(s) {
  return normalizeCompareText(s)
    .replace(/[.…··\u2024-\u2027]/g, '')
    .replace(/\s+/g, '');
}

/**
 * @param {string} a
 * @param {string} b
 */
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  /** @type {number[]} */
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    /** @type {number[]} */
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(
        curr[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost,
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * @param {string} title
 * @param {string} matchedText
 */
export function tocTitleSimilarity(title, matchedText) {
  const a = similarityKeyForToc(title);
  const b = similarityKeyForToc(matchedText);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

/**
 * @param {string} title
 * @param {import('./ruleEngine.js').MatchInstance[]} instances
 * @returns {import('./ruleEngine.js').MatchInstance | null}
 */
function pickTocInstance(title, instances, status) {
  if (!instances.length || status === 'missing') return null;
  const want = normalizeCompareText(title);
  if (status === 'match') {
    return (
      instances.find((i) => normalizeCompareText(i.matchedText) === want) ??
      instances[0]
    );
  }
  let best = instances[0];
  let bestScore = -1;
  for (const inst of instances) {
    const score = tocTitleSimilarity(title, inst.matchedText);
    if (score > bestScore) {
      bestScore = score;
      best = inst;
    }
  }
  return best;
}

/**
 * @param {string} word
 */
function isHangulWord(word) {
  const chars = [...word];
  return (
    chars.length > 1 &&
    chars.every((c) => c >= '\uAC00' && c <= '\uD7A3')
  );
}

/**
 * PART Ⅰ. ↔ PART I (본문) 등
 * @param {string} token
 */
function buildLatinTokenPattern(token) {
  const punctMatch = token.match(/^(.+?)([.)])$/);
  const core = punctMatch ? punctMatch[1] : token;
  const punct = punctMatch ? punctMatch[2] : '';
  const punctPat = punct ? `\\${punct}?` : '';

  if (/^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫⅬⅭⅮⅯ]+$/u.test(core)) {
    const unicode = escapeRegex(core);
    const ascii = escapeRegex(romanToAsciiDigits(core));
    /** @type {string[]} */
    const alts = [unicode, ascii];
    if (core === 'Ⅰ') alts.push('1');
    return `(?:${alts.join('|')})${punctPat}`;
  }

  if (/^[IVXLCDM]+$/i.test(core)) {
    const ascii = escapeRegex(core.toUpperCase());
    const unicodeForm = Object.entries(UNICODE_ROMAN_TO_ASCII).find(
      ([, a]) => a === ascii,
    )?.[0];
    const alts = unicodeForm
      ? [ascii, escapeRegex(unicodeForm)]
      : [ascii];
    if (core.toUpperCase() === 'I') alts.push('1');
    return `(?:${alts.join('|')})${punctPat}`;
  }

  if (punctMatch) {
    return `${escapeRegex(core)}${punctPat}`;
  }

  return `${escapeRegex(token)}\\.?`;
}

/**
 * PDF 추출 시 음절·줄이 쪼개져도 찾기 (감 / 수 / 의 / 글)
 * @param {string} word
 */
function buildHangulSyllablePattern(word) {
  return [...word].map((c) => escapeRegex(c)).join(TOC_SYLLABLE_GAP);
}

/**
 * PDF에 `경제 왕국`처럼 띄어 쓴 경우 — 목차 `경제왕국`도 찾기
 * @param {string} word
 */
function buildHangulWordPattern(word) {
  const syllable = buildHangulSyllablePattern(word);
  if (word.length < 4) return syllable;
  const headLen = Math.min(2, word.length - 2);
  const head = word.slice(0, headLen);
  const tail = word.slice(headLen);
  const split = `${buildHangulSyllablePattern(head)}${TOC_TITLE_FLEX_SPACE}${buildHangulSyllablePattern(tail)}`;
  return `(?:${syllable}|${split})`;
}

function buildWordPattern(word) {
  if (isHangulWord(word)) {
    return buildHangulWordPattern(word);
  }
  return buildLatinTokenPattern(word);
}

/** 목차·본문 제목 — 한글 어절 사이 조사·구둣점(분위기와 경제, 분위기·경제 등) */
const TOC_HANGUL_PART_BRIDGE =
  String.raw`(?:[와과]\s*|[·•・/]\s*|[,，]\s*)`;

/**
 * 한글 어절 사이는 공백 없어도 검색 (띄어쓰기 불일치 검출용)
 * @param {string} left
 * @param {string} right
 */
function buildTitlePartGap(left, right) {
  if (isHangulWord(left) && isHangulWord(right)) {
    return `(?:${TOC_TITLE_FLEX_SPACE}|${TOC_HANGUL_PART_BRIDGE})?`;
  }
  return TOC_TITLE_FLEX_SPACE;
}

/**
 * @param {string} title
 */
function buildTitleSearchRegex(title) {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const patterns = parts.map((p) => buildWordPattern(p));
  let body = patterns[0];
  for (let i = 1; i < patterns.length; i++) {
    body += buildTitlePartGap(parts[i - 1], parts[i]) + patterns[i];
  }
  return new RegExp(body, 'gu');
}

/**
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {RegExp} re
 * @param {number} [maxCount]
 */
function findTitleInstances(pages, re, maxCount = 1) {
  /** @type {import('./ruleEngine.js').MatchInstance[]} */
  const instances = [];
  const limit = Math.max(1, maxCount);
  for (const page of pages) {
    const text = page.text;
    const regex = new RegExp(re.source, re.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!match[0]) {
        regex.lastIndex += 1;
        continue;
      }
      instances.push({
        find: `toc-body:${match[0]}`,
        replace: match[0],
        matchedText: match[0],
        suggestedText: match[0],
        pageNum: page.pageNum,
        index: match.index,
      });
      if (instances.length >= limit) return instances;
    }
  }
  return instances;
}

/**
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @param {RegExp} re
 * @param {PdfHeadingLine[]} headingLines
 * @param {number} [maxCount]
 */
function findTitleInstancesOnHeadings(pages, re, headingLines, maxCount = 1) {
  const pageSet = new Set(pages.map((p) => p.pageNum));
  /** @type {import('./ruleEngine.js').MatchInstance[]} */
  const instances = [];
  const limit = Math.max(1, maxCount);
  for (const line of headingLines) {
    if (!pageSet.has(line.pageNum)) continue;
    const regex = new RegExp(re.source, re.flags);
    let match;
    while ((match = regex.exec(line.text)) !== null) {
      if (!match[0]) {
        regex.lastIndex += 1;
        continue;
      }
      instances.push({
        find: `toc-body:${match[0]}`,
        replace: match[0],
        matchedText: match[0],
        suggestedText: match[0],
        pageNum: line.pageNum,
        index: line.startIndex + match.index,
      });
      if (instances.length >= limit) return instances;
    }
  }
  return instances;
}

/**
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @param {RegExp} re
 * @param {string} title
 * @param {PdfHeadingLine[]} headingLines
 * @returns {import('./ruleEngine.js').MatchInstance[]}
 */
function findFirstValidTitleOnPages(pages, re, title, headingLines) {
  if (!pages.length) return [];

  const pageSet = new Set(pages.map((p) => p.pageNum));
  const headingsOnPages = headingLines.filter((h) => pageSet.has(h.pageNum));

  /** @type {import('./ruleEngine.js').MatchInstance[]} */
  const ordered = [];
  const seen = new Set();

  const pushUnique = (list) => {
    for (const inst of list) {
      const key = `${inst.pageNum}:${inst.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push(inst);
    }
  };

  if (headingsOnPages.length) {
    pushUnique(
      findTitleInstancesOnHeadings(pages, re, headingsOnPages, 12),
    );
  }

  for (const row of collectTitleLineCandidates(pages, re)) {
    pushUnique([row.inst]);
  }

  pushUnique(findTitleInstances(pages, re, 8));

  for (const inst of ordered) {
    if (classifyTocTitle(title, [inst]) !== 'missing') return [inst];
  }
  return [];
}

/**
 * @param {string} title
 * @param {TocBodyStatus} status
 * @param {import('./ruleEngine.js').MatchInstance[]} found
 * @param {import('./pdfService.js').PageData[]} searchPages
 * @returns {{ status: TocBodyStatus, tocMismatchReason?: 'body-mention-only' }}
 */
export function resolveTocTitleStatus(title, status, found, searchPages) {
  if (status !== 'match' || !found.length) {
    return { status };
  }
  const inst = found[0];
  const page = searchPages.find((p) => p.pageNum === inst.pageNum);
  if (!page || !isBodyMentionOnlyMatch(page, inst)) {
    return { status };
  }
  return { status: 'mismatch', tocMismatchReason: 'body-mention-only' };
}

/**
 * @param {string} title
 * @param {PdfHeadingLine[]} headings
 * @param {Set<string>} usedIds
 */
function findBestOutlineMatch(title, headings, usedIds) {
  let best = null;
  let bestScore = 0;
  for (const h of headings) {
    if (usedIds.has(h.id)) continue;
    const score = tocTitleSimilarity(title, h.text);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  if (!best || bestScore < OUTLINE_MATCH_THRESHOLD) return null;
  return best;
}

/**
 * @param {TocBodyEntry[]} tocEntries
 * @param {PdfHeadingLine[]} headings
 */
export function diffTocWithPdfOutline(tocEntries, headings) {
  const used = new Set();
  /** @type {Map<string, PdfHeadingLine>} */
  const hints = new Map();

  for (const entry of tocEntries) {
    const paired = findBestOutlineMatch(entry.title, headings, used);
    if (paired) {
      used.add(paired.id);
      continue;
    }
    let hint = null;
    let hintScore = 0;
    for (const h of headings) {
      const score = tocTitleSimilarity(entry.title, h.text);
      if (score > hintScore) {
        hintScore = score;
        hint = h;
      }
    }
    if (hint && hintScore >= OUTLINE_HINT_THRESHOLD) {
      hints.set(entry.title, hint);
    }
  }

  const outlineOnly = headings.filter((h) => !used.has(h.id));
  return { hints, outlineOnly };
}

/**
 * 펼침면 6–7P에 목차 7쪽, 또는 30쪽 이후 본문
 * @param {number} printLeft
 * @param {number} listedPrintPage
 */
export function printPageReachesListedPrint(printLeft, listedPrintPage) {
  if (!Number.isFinite(printLeft) || !Number.isFinite(listedPrintPage)) {
    return false;
  }
  const left = Math.floor(printLeft);
  const listed = Math.floor(listedPrintPage);
  if (left <= listed && listed <= left + 1) return true;
  return left >= listed;
}

/**
 * @param {number} printLeft
 * @param {number} listedPrintPage
 */
export function printPageCoversListedPrint(printLeft, listedPrintPage) {
  const left = Math.floor(printLeft);
  const listed = Math.floor(listedPrintPage);
  return left <= listed && listed <= left + 1;
}

/**
 * `PART Ⅰ. 경제는 분위기다` 안에 `경제는 분위기다`가 있을 때 앞쪽 오매칭 방지
 * @param {string} title
 * @param {TocBodyEntry[]} entries
 */
export function isTitleShadowedByLongerTocEntry(title, entries) {
  const t = title.trim();
  if (!t) return false;
  return entries.some(
    (e) =>
      e.title !== t &&
      e.title.length > t.length &&
      e.title.includes(t),
  );
}

/**
 * @param {import('./pdfService.js').PageData[]} searchPages
 * @param {RegExp} re
 * @param {string} title
 * @param {number | null} systemTocPage
 * @param {boolean} allowBeforeListedFilePage
 * @param {PdfHeadingLine[]} headingLines
 */
function findInstancesOnFilePages(
  searchPages,
  re,
  title,
  systemTocPage,
  allowBeforeListedFilePage,
  headingLines,
) {
  if (systemTocPage != null) {
    /** @type {import('./pdfService.js').PageData[]} */
    const ordered = [
      ...searchPages.filter((p) => p.pageNum === systemTocPage),
      ...searchPages
        .filter((p) => p.pageNum > systemTocPage)
        .sort((a, b) => a.pageNum - b.pageNum),
    ];
    if (allowBeforeListedFilePage) {
      ordered.push(
        ...searchPages
          .filter((p) => p.pageNum < systemTocPage)
          .sort((a, b) => b.pageNum - a.pageNum),
      );
    }
    return findFirstValidTitleOnPages(ordered, re, title, headingLines);
  }

  return findFirstValidTitleOnPages(searchPages, re, title, headingLines);
}

/**
 * @param {import('./pdfService.js').PageData[]} searchPages
 * @param {RegExp} re
 * @param {string} title
 * @param {number} listedPrintPage
 * @param {(systemPage: number) => number} mapSystemPageToPrint
 * @param {PdfHeadingLine[]} headingLines
 */
function findInstancesOnPrintPages(
  searchPages,
  re,
  title,
  listedPrintPage,
  mapSystemPageToPrint,
  headingLines,
) {
  const listed = Math.floor(listedPrintPage);
  const ranked = searchPages
    .map((page) => ({
      page,
      printLeft: mapSystemPageToPrint(page.pageNum),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.printLeft) &&
        printPageReachesListedPrint(row.printLeft, listed),
    )
    .sort((a, b) => {
      const aCover = printPageCoversListedPrint(a.printLeft, listed) ? 0 : 1;
      const bCover = printPageCoversListedPrint(b.printLeft, listed) ? 0 : 1;
      if (aCover !== bCover) return aCover - bCover;
      const aOn = Math.floor(a.printLeft) === listed ? 0 : 1;
      const bOn = Math.floor(b.printLeft) === listed ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      if (a.printLeft !== b.printLeft) return a.printLeft - b.printLeft;
      return a.page.pageNum - b.page.pageNum;
    });
  return findFirstValidTitleOnPages(
    ranked.map((row) => row.page),
    re,
    title,
    headingLines,
  );
}

/**
 * 목차 줄 끝 쪽수(인쇄) 우선 · 항목당 1건
 * @param {import('./pdfService.js').PageData[]} searchPages
 * @param {RegExp} re
 * @param {number | null} systemTocPage
 * @param {string} title
 * @param {number | null} listedPrintPage
 * @param {(systemPage: number) => number} [mapSystemPageToPrint]
 * @param {TocBodyEntry[]} tocEntries
 * @param {PdfHeadingLine[]} headingLines
 */
function findInstancesForEntry(
  searchPages,
  re,
  systemTocPage,
  title,
  listedPrintPage,
  mapSystemPageToPrint,
  tocEntries,
  headingLines,
) {
  const shadowed = isTitleShadowedByLongerTocEntry(title, tocEntries);

  if (listedPrintPage != null && mapSystemPageToPrint) {
    const onPrint = findInstancesOnPrintPages(
      searchPages,
      re,
      title,
      listedPrintPage,
      mapSystemPageToPrint,
      headingLines,
    );
    if (onPrint.length) return onPrint;
  }

  return findInstancesOnFilePages(
    searchPages,
    re,
    title,
    systemTocPage,
    !shadowed,
    headingLines,
  );
}

/**
 * @param {string} s
 */
function hasHangul(s) {
  return /[\uAC00-\uD7A3]/.test(s);
}

/**
 * 글자는 같고 공백·줄바꿈 배치만 다른 한글 (보여 준다 ↔ 보여준다)
 * @param {string} title
 * @param {string} matchedText
 */
export function isTocHangulSpacingMismatch(title, matchedText) {
  if (!hasHangul(title) && !hasHangul(matchedText)) return false;
  if (similarityKeyForToc(title) !== similarityKeyForToc(matchedText)) {
    return false;
  }
  if (normalizeCompareText(title) === normalizeCompareText(matchedText)) {
    return false;
  }
  return !/[\r\n]/.test(matchedText);
}

/**
 * @param {string} title
 * @param {import('./ruleEngine.js').MatchInstance[]} instances
 * @returns {TocBodyStatus}
 */
export function classifyTocTitle(title, instances) {
  if (!instances.length) return 'missing';
  const wantStrict = normalizeCompareText(title);
  const wantKey = similarityKeyForToc(title);

  if (
    instances.some(
      (i) => normalizeCompareText(i.matchedText) === wantStrict,
    )
  ) {
    return 'match';
  }

  // PDF 줄나눔·음절 추출(공백만 다름) → 일치
  if (
    instances.some((i) => {
      if (similarityKeyForToc(i.matchedText) !== wantKey) return false;
      return /[\r\n]/.test(i.matchedText);
    })
  ) {
    return 'match';
  }

  // 띄어쓰기만 다른 한글 → 불일치
  if (
    instances.some((i) =>
      isTocHangulSpacingMismatch(title, i.matchedText),
    )
  ) {
    return 'mismatch';
  }

  let best = 0;
  for (const inst of instances) {
    best = Math.max(best, tocTitleSimilarity(title, inst.matchedText));
  }
  if (best >= TOC_MISMATCH_SIMILARITY_THRESHOLD) return 'mismatch';
  // 후보는 잡혔으나 유사도만 낮을 때 — 누락 대신 불일치로 표시(위치 확인 가능)
  if (instances.length) return 'mismatch';
  return 'missing';
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseTocBodyStartPage(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** @param {string} token */
function parseTocPageToken(token) {
  const t = token.trim().replace(/(?:쪽|P\.?)\s*$/iu, '');
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

const TOC_PAGE_RANGE_SEP = /[-–—~\u2010-\u2015\uFF0D～]+/;

/**
 * PDF 목차가 인쇄된 페이지(검색 제외). "18", "18-22", "17, 18, 19", "18~22쪽"
 * @param {unknown} value
 * @returns {Set<number>}
 */
export function parseTocBodyExcludePages(value) {
  /** @type {Set<number>} */
  const pages = new Set();
  if (value === null || value === undefined || value === '') return pages;
  const raw = String(value).trim();
  if (!raw) return pages;

  for (const part of raw.split(/[,，、]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.match(
      new RegExp(`^(\\d+)\\s*${TOC_PAGE_RANGE_SEP.source}\\s*(\\d+)`),
    );
    if (range) {
      const a = parseTocPageToken(range[1]);
      const b = parseTocPageToken(range[2]);
      if (a != null && b != null) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let p = lo; p <= hi; p++) pages.add(p);
      }
      continue;
    }
    const n = parseTocPageToken(trimmed);
    if (n != null) pages.add(n);
  }
  return pages;
}

/**
 * 인쇄 쪽(뷰어 표시) → PDF 파일 페이지. 보정 없으면 그대로.
 * @param {unknown} excludePages
 * @param {(printPage: number) => number} [mapPrintPageToSystem]
 * @returns {Set<number>}
 */
export function resolveTocBodyExcludeSystemPages(
  excludePages,
  mapPrintPageToSystem,
) {
  const display = parseTocBodyExcludePages(excludePages);
  if (!display.size) return new Set();
  const map = mapPrintPageToSystem ?? ((n) => n);
  /** @type {Set<number>} */
  const system = new Set();
  for (const d of display) {
    const s = map(d);
    if (Number.isFinite(s) && s >= 1) system.add(Math.floor(s));
  }
  return system;
}

/**
 * 인쇄(보정) 쪽 번호 기준 — 목차판 18–23만 빼고 28쪽 본문 파일 페이지는 남김
 * @param {number} systemPage
 * @param {Set<number>} excludePrintPages
 * @param {(systemPage: number) => number} mapSystemPageToPrint
 */
export function isSystemPageInTocExcludePrintRange(
  systemPage,
  excludePrintPages,
  mapSystemPageToPrint,
) {
  if (!excludePrintPages.size) return false;
  const left = mapSystemPageToPrint(systemPage);
  if (!Number.isFinite(left)) return false;
  const l = Math.floor(left);
  if (excludePrintPages.has(l)) return true;
  if (excludePrintPages.has(l + 1)) return true;
  return false;
}

/**
 * 목차 줄 끝 쪽수(인쇄 쪽) → 파일 페이지
 * @param {number | null} tocPage
 * @param {(printPage: number) => number} [mapPrintPageToSystem]
 */
export function resolveTocEntrySystemPage(tocPage, mapPrintPageToSystem) {
  if (!tocPage) return null;
  const map = mapPrintPageToSystem ?? ((n) => n);
  const s = map(tocPage);
  return Number.isFinite(s) && s >= 1 ? Math.floor(s) : tocPage;
}

/**
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {number | null | undefined} startPage
 * @param {unknown} [excludePages]
 * @param {(printPage: number) => number} [mapPrintPageToSystem]
 * @param {(systemPage: number) => number} [mapSystemPageToPrint] 보정된 인쇄 쪽(왼쪽)
 */
export function filterPagesForTocBodyCheck(
  pages,
  startPage,
  excludePages,
  mapPrintPageToSystem,
  mapSystemPageToPrint,
) {
  const excludePrint = parseTocBodyExcludePages(excludePages);
  const excludeSystem = resolveTocBodyExcludeSystemPages(
    excludePages,
    mapPrintPageToSystem,
  );
  const from = parseTocBodyStartPage(startPage);
  const fromSystem =
    from != null
      ? resolveTocEntrySystemPage(from, mapPrintPageToSystem) ?? from
      : null;
  return pages.filter((p) => {
    if (fromSystem && p.pageNum < fromSystem) return false;
    if (excludePrint.size) {
      if (mapSystemPageToPrint) {
        if (
          isSystemPageInTocExcludePrintRange(
            p.pageNum,
            excludePrint,
            mapSystemPageToPrint,
          )
        ) {
          return false;
        }
      } else if (excludeSystem.size && excludeSystem.has(p.pageNum)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {string} tocBodyText
 * @param {number | null | undefined} [bodyStartPage]
 * @param {unknown} [excludePdfTocPages] 목차 PDF 페이지(검색 제외, 인쇄 쪽 입력 가능)
 * @param {(printPage: number) => number} [mapPrintPageToSystem] 인쇄 쪽 → 파일 페이지
 * @param {(systemPage: number) => number} [mapSystemPageToPrint] 파일 페이지 → 인쇄 쪽(왼쪽)
 * @returns {TocBodyGroup[]}
 */
export function runTocBodyCheck(
  pages,
  tocBodyText,
  bodyStartPage = null,
  excludePdfTocPages = null,
  mapPrintPageToSystem = undefined,
  mapSystemPageToPrint = undefined,
) {
  const entries = parseTocBodyEntries(tocBodyText);
  const searchPages = filterPagesForTocBodyCheck(
    pages,
    bodyStartPage,
    excludePdfTocPages,
    mapPrintPageToSystem,
    mapSystemPageToPrint,
  );
  if (!entries.length) return [];

  const headingLines = extractPdfHeadingLines(searchPages);
  const { hints } = diffTocWithPdfOutline(entries, headingLines);

  /** @type {TocBodyGroup[]} */
  const groups = [];

  entries.forEach(({ title, tocPage }, tocLineIndex) => {
    const re = buildTitleSearchRegex(title);
    if (!re) return;
    const systemTocPage = resolveTocEntrySystemPage(
      tocPage,
      mapPrintPageToSystem,
    );
    const found = findInstancesForEntry(
      searchPages,
      re,
      systemTocPage,
      title,
      tocPage,
      mapSystemPageToPrint,
      entries,
      headingLines,
    );
    const rawStatus = classifyTocTitle(title, found);
    const { status, tocMismatchReason } = resolveTocTitleStatus(
      title,
      rawStatus,
      found,
      searchPages,
    );
    const chosen =
      status === 'missing' ? null : pickTocInstance(title, found, status);
    const instances = chosen ? [chosen] : [];
    const outlineHint =
      status === 'missing' ? hints.get(title) ?? null : null;

    groups.push({
      find: `toc-body:${tocLineIndex}:${title}`,
      replace: title,
      label: title,
      category: 'consistency',
      patternKind: 'toc-body',
      tocStatus: status,
      tocLineIndex,
      groupDisplayLabel: TOC_STATUS_LABELS[status],
      instances,
      outlineHint,
      tocMismatchReason,
    });
  });

  return groups.sort((a, b) => {
    const sa = TOC_STATUS_ORDER[a.tocStatus] ?? 9;
    const sb = TOC_STATUS_ORDER[b.tocStatus] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.tocLineIndex - b.tocLineIndex;
  });
}

/**
 * @param {string} tocBodyText
 */
export function hasTocBodyEntries(tocBodyText) {
  return parseTocBodyText(tocBodyText).length > 0;
}
