/**
 * SLM 요청 맥락 — 줄 내 앞·뒤 40자 (스케치 §3.2).
 */

import {
  prepareUnifyScanText,
  splitUnifyScanLines,
} from '../unifyCandidateDiscover.js';

/** @typedef {import('../unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster */
/** @typedef {import('../unifyCandidateDiscover.js').UnifyVariantOccurrence} UnifyVariantOccurrence */

export const JOSA_SLM_CONTEXT_MAX = 40;

const PUNCT_BOUNDARY_RE = /[。.!?…,;]/u;

/**
 * @param {string} s
 * @returns {number}
 */
export function graphemeCount(s) {
  return [...String(s ?? '')].length;
}

/**
 * @param {string} line
 * @param {number} start
 * @param {number} end
 * @param {'before' | 'after'} side
 * @param {number} [maxLen]
 * @returns {string}
 */
export function sliceJosaSlmContextSide(line, start, end, side, maxLen = JOSA_SLM_CONTEXT_MAX) {
  const text = String(line ?? '');
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  const raw = side === 'before' ? text.slice(0, safeStart) : text.slice(safeEnd);
  const chars = [...raw];
  if (chars.length <= maxLen) {
    return raw.trim();
  }

  const window =
    side === 'before'
      ? chars.slice(-maxLen).join('')
      : chars.slice(0, maxLen).join('');

  if (side === 'before') {
    let cut = 0;
    for (let i = 0; i < window.length; i += 1) {
      if (PUNCT_BOUNDARY_RE.test(window[i])) cut = i + 1;
    }
    if (cut > 0 && cut < window.length) {
      return window.slice(cut).trim();
    }
    return window.trim();
  }

  let cut = window.length;
  for (let i = 0; i < window.length; i += 1) {
    if (PUNCT_BOUNDARY_RE.test(window[i])) {
      cut = i;
      break;
    }
  }
  if (cut > 0 && cut < window.length) {
    return window.slice(0, cut).trim();
  }
  return window.trim();
}

/**
 * @param {string} line
 * @param {number} start
 * @param {number} end
 * @returns {{ contextBefore: string, contextAfter: string }}
 */
export function sliceJosaSlmContextFromLine(line, start, end) {
  return {
    contextBefore: sliceJosaSlmContextSide(line, start, end, 'before'),
    contextAfter: sliceJosaSlmContextSide(line, start, end, 'after'),
  };
}

/**
 * @param {string} line
 * @param {string} matchedText
 * @param {string} [variant]
 * @returns {{ start: number, end: number } | null}
 */
export function findMatchRangeInLine(line, matchedText, variant = '') {
  const candidates = [matchedText, variant].filter(Boolean);
  for (const needle of candidates) {
    const idx = line.indexOf(needle);
    if (idx >= 0) {
      return { start: idx, end: idx + needle.length };
    }
  }
  const collapsedLine = line.replace(/\s+/g, ' ');
  for (const needle of candidates) {
    const collapsedNeedle = needle.replace(/\s+/g, ' ');
    const idx = collapsedLine.indexOf(collapsedNeedle);
    if (idx >= 0) {
      return { start: idx, end: idx + collapsedNeedle.length };
    }
  }
  return null;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }} page
 * @returns {string}
 */
export function unifyPageSourceText(page) {
  if (typeof page?.textLayout === 'string' && page.textLayout.length > 0) {
    return page.textLayout;
  }
  return page?.text ?? '';
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {Map<number, string[]>}
 */
export function buildUnifyPageLinesByNum(pageTexts) {
  /** @type {Map<number, string[]>} */
  const byNum = new Map();
  for (const page of pageTexts ?? []) {
    const pageNum = Number(page?.pageNum) || 0;
    if (!pageNum) continue;
    const source = prepareUnifyScanText(unifyPageSourceText(page));
    byNum.set(pageNum, splitUnifyScanLines(source));
  }
  return byNum;
}

/**
 * @param {string[]} lines
 * @param {UnifyVariantOccurrence} occ
 * @param {string} variant
 * @returns {{ line: string, start: number, end: number } | null}
 */
export function findOccurrenceLineContext(lines, occ, variant) {
  const matchedText = occ.matchedText || variant;
  for (const line of lines) {
    const range = findMatchRangeInLine(line, matchedText, variant);
    if (range) {
      return { line, start: range.start, end: range.end };
    }
  }
  return null;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {{ occ: UnifyVariantOccurrence, variant: string } | null}
 */
export function pickJosaSlmRepresentativeOccurrence(cluster) {
  const variants = cluster.variants ?? [];
  const spaced =
    variants.find((v) => /\s/.test(v) && (cluster.counts?.[v] ?? 0) > 0) ||
    variants.find((v) => /\s/.test(v)) ||
    variants.find((v) => (cluster.counts?.[v] ?? 0) > 0) ||
    variants[0];
  if (!spaced) return null;
  const occs = cluster.occurrencesByVariant?.[spaced] ?? [];
  if (!occs.length) return null;
  return { occ: occs[0], variant: spaced };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {{ contextBefore: string, contextAfter: string }}
 */
export function buildJosaSlmContextForCluster(cluster, pageTexts) {
  const picked = pickJosaSlmRepresentativeOccurrence(cluster);
  if (!picked) {
    return { contextBefore: '', contextAfter: '' };
  }
  const linesByPage = buildUnifyPageLinesByNum(pageTexts);
  const lines = linesByPage.get(picked.occ.pageNum) ?? [];
  const hit = findOccurrenceLineContext(lines, picked.occ, picked.variant);
  if (!hit) {
    return { contextBefore: '', contextAfter: '' };
  }
  return sliceJosaSlmContextFromLine(hit.line, hit.start, hit.end);
}
