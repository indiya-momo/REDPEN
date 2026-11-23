/**
 * 「다보면」「다보니」오탐 KEEP — 들여다보다 등재·형태소 2차.
 * 시트 lookbehind `(?<!들여)` 대신 추출본·Kiwi로 판정한다.
 */

import { analyzeLine } from './kiwiMorph/analyze.js';
import { bootKiwiIfNeeded } from './kiwiMorph/bootLocal.js';
import {
  ensureStdictVerbFormsLoaded,
  isSpaceRequiredCompoundLemma,
  resolveSpaceRequiredLemma,
} from './stdictVerbForms.js';

const DABO_SURFACES = Object.freeze(['다보면', '다보니']);
const KEEP_LEMMAS = Object.freeze(['들여다보다', '들여다보이다']);
const STEM = '들여다보';

/** @param {string} ch */
function isHangulSyllable(ch) {
  return ch.length === 1 && ch >= '\uAC00' && ch <= '\uD7A3';
}

/** @param {string} raw */
function hangulOnly(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * @param {string} matched
 */
export function isDaboKeepSurface(matched) {
  const s = String(matched ?? '').trim();
  return DABO_SURFACES.includes(s);
}

/**
 * 매치 구간을 감싼 한글 어절(앞뒤 한글 연속).
 * @param {string} text
 * @param {number} index
 * @param {number} [matchLen]
 */
export function eojeolAroundMatch(text, index, matchLen = 0) {
  const t = String(text ?? '');
  let start = Math.max(0, Number(index) || 0);
  let end = start + Math.max(0, Number(matchLen) || 0);
  while (start > 0 && isHangulSyllable(t[start - 1] ?? '')) start -= 1;
  while (end < t.length && isHangulSyllable(t[end] ?? '')) end += 1;
  return hangulOnly(t.slice(start, end));
}

/**
 * @param {{ tokens?: { str?: string, tag?: string }[] } | null | undefined} analyzed
 */
export function hasDeulyeodaboVerbStem(analyzed) {
  const tokens = analyzed?.tokens ?? [];
  for (const t of tokens) {
    const str = String(t?.str ?? '');
    const tag = String(t?.tag ?? '').split('-')[0];
    if (!(tag === 'VV' || tag === 'VX' || tag === 'XSV')) continue;
    if (str === STEM || str.startsWith(STEM)) return true;
  }
  return false;
}

/**
 * 어절이 다보면/다보니를 포함할 때 들여다보다 계열이면 KEEP.
 * @param {string} eojeol
 * @param {{
 *   analyze?: typeof analyzeLine,
 *   kiwi?: { ready?: () => boolean, analyze: Function } | null,
 * }} [opts]
 */
export function shouldKeepDaboInsideCompound(eojeol, opts = {}) {
  const surface = hangulOnly(eojeol);
  if (!surface) return false;
  if (!DABO_SURFACES.some((s) => surface.includes(s))) return false;

  const fromForm = resolveSpaceRequiredLemma('', surface);
  if (KEEP_LEMMAS.includes(fromForm)) return true;

  for (const lemma of KEEP_LEMMAS) {
    if (!isSpaceRequiredCompoundLemma(lemma)) continue;
    const stem = lemma.replace(/다$/, '');
    if (surface.startsWith(stem)) return true;
  }

  const analyze = opts.analyze ?? analyzeLine;
  const analyzed = analyze(surface, opts.kiwi ? { kiwi: opts.kiwi } : {});
  return hasDeulyeodaboVerbStem(analyzed);
}

/**
 * closedSpacingFixes 등 동기 스캔용 — 텍스트·매치 위치에서 어절을 뽑아 KEEP 여부.
 * @param {string} text
 * @param {number} index
 * @param {string} matched
 * @param {{ analyze?: typeof analyzeLine }} [opts]
 */
export function shouldKeepDaboMatchInText(text, index, matched, opts = {}) {
  if (!isDaboKeepSurface(matched)) return false;
  const eojeol = eojeolAroundMatch(text, index, String(matched).length);
  return shouldKeepDaboInsideCompound(eojeol || matched, opts);
}

/**
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 */
export function isDaboSpellingInstance(inst) {
  if (!inst) return false;
  const matched = String(inst.matchedText ?? '').trim();
  if (isDaboKeepSurface(matched)) return true;
  const highlight = String(inst.highlightText ?? '').trim();
  return isDaboKeepSurface(highlight);
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 */
export function spellingGroupsHaveDaboHits(groups) {
  for (const group of groups ?? []) {
    for (const inst of group.instances ?? []) {
      if (isDaboSpellingInstance(inst)) return true;
    }
  }
  return false;
}

/**
 * 맞춤법 결과에서 들여다보다 계열 다보- 히트만 제거.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @param {{ analyze?: typeof analyzeLine }} [opts]
 */
export function pruneDaboInsideCompoundHits(groups, pages, opts = {}) {
  /** @type {Map<number, string>} */
  const byPage = new Map();
  for (const page of pages ?? []) {
    const n = Number(page?.pageNum);
    if (!Number.isFinite(n)) continue;
    byPage.set(n, String(page.text ?? page.visualText ?? ''));
  }

  return (groups ?? [])
    .map((group) => {
      const instances = (group.instances ?? []).filter((inst) => {
        if (!isDaboSpellingInstance(inst)) return true;
        const pageText = byPage.get(Number(inst.pageNum)) ?? '';
        const matched = String(inst.matchedText ?? inst.highlightText ?? '').trim();
        const idx =
          typeof inst.index === 'number'
            ? inst.index
            : typeof inst.highlightIndex === 'number'
              ? inst.highlightIndex
              : -1;
        const eojeol =
          idx >= 0
            ? eojeolAroundMatch(pageText, idx, matched.length)
            : hangulOnly(matched);
        return !shouldKeepDaboInsideCompound(eojeol || matched, opts);
      });
      return { ...group, instances };
    })
    .filter((g) => (g.instances?.length ?? 0) > 0);
}

/**
 * 다보 히트가 있을 때만 추출본·Kiwi를 채운 뒤 2차 KEEP 제거.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @param {{
 *   analyze?: typeof analyzeLine,
 *   fetchImpl?: typeof fetch,
 *   morphPrefetchMaxMs?: number,
 * }} [opts]
 */
export async function enrichSpellingDaboInsideCompoundKeep(groups, pages, opts = {}) {
  if (!spellingGroupsHaveDaboHits(groups)) return groups;
  await ensureStdictVerbFormsLoaded({ fetchImpl: opts.fetchImpl });
  if (typeof opts.analyze !== 'function') {
    try {
      await bootKiwiIfNeeded({
        auxMorph: true,
        maxWaitMs: opts.morphPrefetchMaxMs ?? 12_000,
      });
    } catch {
      /* extract-only KEEP */
    }
  }
  return pruneDaboInsideCompoundHits(groups, pages, opts);
}
