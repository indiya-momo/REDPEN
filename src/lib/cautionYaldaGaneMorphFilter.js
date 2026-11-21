/**
 * 주의「얇다, 가늘다」— stem `가는` 동형(가다 vs 가늘다) 2차 필터.
 * 1차 기본 stems에는 단독 `가는`을 두지 않는다(마음 가는=가다 오탐).
 * 시트가 `가는`을 다시 넣으면 이 필터가 가늘다(VA)만 남기고
 * 가다(VV)·분석 실패는 버린다(fail-closed).
 */

import { prefetchBareunAnalyze } from './bareunMorph/prefetch.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { bootKiwiIfNeeded } from './kiwiMorph/bootLocal.js';
import { getRemoteAnalyze } from './kiwiMorph/remoteCache.js';
import { getKiwiInstance } from './kiwiMorph/runtime.js';
import { prefetchKiwiAnalyze } from './kiwiMorph/serverRunner.js';

export const YALDA_CAUTION_ID = 'verb-verb-yalda';
export const GANE_STEM = '가는';

/** @param {string | undefined} tag */
function tagBase(tag) {
  return String(tag ?? '').split('-')[0];
}

/**
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 */
export function isYaldaGaneInstance(inst) {
  const stem = String(inst?.highlightText ?? '').trim();
  if (stem === GANE_STEM) return true;
  const matched = String(inst?.matchedText ?? '').trim();
  return matched === GANE_STEM || matched.endsWith(GANE_STEM);
}

/** @param {import('./ruleEngine.js').GroupedResult | null | undefined} group */
export function isYaldaCautionGroup(group) {
  if (!group) return false;
  if (group.cautionId === YALDA_CAUTION_ID) return true;
  const label = String(group.label ?? '').replace(/\s+/g, '');
  return label.includes('얇다') && label.includes('가늘다');
}

/**
 * 분석 입력 — 하이라이트 `가는` + 바로 뒤 한글 어절(금실 등)까지.
 * @param {string} pageText
 * @param {import('./ruleEngine.js').MatchInstance} inst
 */
export function ganeAnalyzeSurface(pageText, inst) {
  const text = String(pageText ?? '');
  const stem = GANE_STEM;
  const highlightIndex = Number(inst?.highlightIndex);
  const matchIndex = Number(inst?.index);
  const start = Number.isFinite(highlightIndex)
    ? highlightIndex
    : Number.isFinite(matchIndex)
      ? matchIndex
      : text.indexOf(stem);
  if (!Number.isFinite(start) || start < 0) {
    return String(inst?.matchedText ?? stem).trim() || stem;
  }
  const stemEnd = start + stem.length;
  if (text.slice(start, stemEnd) !== stem) {
    const matched = String(inst?.matchedText ?? '').trim();
    return matched || stem;
  }
  const after = text.slice(stemEnd);
  const next = after.match(/^[ \u00A0]*([\uAC00-\uD7A3]+)/);
  const end = next ? stemEnd + next[0].length : stemEnd;
  const from = Math.max(0, Math.min(start, Number.isFinite(matchIndex) ? matchIndex : start));
  return text.slice(from, end).replace(/\s+/g, ' ').trim() || stem;
}

/**
 * @param {{ tokens?: { str?: string, tag?: string }[] } | null | undefined} analyzed
 * @returns {boolean | null} true=가늘다 유지, false=가다 DROP, null=판단 불가→DROP
 */
export function isGanuldaGaneMorph(analyzed) {
  if (!analyzed) return null;
  const tokens = analyzed.tokens ?? [];
  if (!tokens.length) return null;

  let sawGaVv = false;
  for (const t of tokens) {
    const str = String(t.str ?? '');
    const base = tagBase(t.tag);
    if (
      (str === '가늘' || str.startsWith('가늘') || str === '가느') &&
      (base === 'VA' || base === 'XSA')
    ) {
      return true;
    }
    if (str === GANE_STEM && (base === 'VA' || base === 'XSA')) {
      return true;
    }
    if (str === '가' && (base === 'VV' || base === 'VX')) {
      sawGaVv = true;
      continue;
    }
    if (sawGaVv && (str === '는' || str === 'ㄴ') && (base === 'ETM' || base === 'ETN')) {
      return false;
    }
    if (str === GANE_STEM && (base === 'VV' || base === 'VX')) {
      return false;
    }
    if (base !== 'EP' && base !== 'EC') {
      sawGaVv = false;
    }
  }
  return null;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @returns {string[]}
 */
export function collectYaldaGaneSurfaces(groups, pages) {
  /** @type {Map<number, string>} */
  const byPage = new Map();
  for (const page of pages ?? []) {
    const n = Number(page?.pageNum);
    if (!Number.isFinite(n)) continue;
    byPage.set(n, String(page.text ?? page.visualText ?? ''));
  }
  /** @type {string[]} */
  const out = [];
  for (const group of groups ?? []) {
    if (!isYaldaCautionGroup(group)) continue;
    for (const inst of group.instances ?? []) {
      if (!isYaldaGaneInstance(inst)) continue;
      const pageText = byPage.get(Number(inst.pageNum)) ?? '';
      const surface = ganeAnalyzeSurface(pageText, inst);
      if (surface) out.push(surface);
    }
  }
  return out;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @param {{ analyze?: typeof analyzeLine, morphPrefetchMaxMs?: number }} [opts]
 */
export async function warmYaldaGaneMorphCache(groups, pages, opts = {}) {
  if (typeof opts.analyze === 'function') return 0;
  try {
    if (getKiwiInstance()?.ready?.()) return 0;
  } catch {
    /* prefetch */
  }
  const texts = collectYaldaGaneSurfaces(groups, pages);
  if (!texts.length) return 0;
  const maxMs = opts.morphPrefetchMaxMs ?? 12_000;
  let stored = await prefetchKiwiAnalyze(texts, { maxMs });
  const stillMissing = texts.filter((t) => !getRemoteAnalyze(t));
  if (stillMissing.length) {
    stored += await prefetchBareunAnalyze(stillMissing, { maxMs });
  }
  return stored;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @param {{ analyze?: typeof analyzeLine }} [opts]
 */
export function pruneYaldaGaneFalseMorph(groups, pages, opts = {}) {
  const analyze = opts.analyze ?? analyzeLine;
  /** @type {Map<number, string>} */
  const byPage = new Map();
  for (const page of pages ?? []) {
    const n = Number(page?.pageNum);
    if (!Number.isFinite(n)) continue;
    byPage.set(n, String(page.text ?? page.visualText ?? ''));
  }

  return (groups ?? []).map((group) => {
    if (!isYaldaCautionGroup(group)) return group;
    const instances = (group.instances ?? []).filter((inst) => {
      if (!isYaldaGaneInstance(inst)) return true;
      const pageText = byPage.get(Number(inst.pageNum)) ?? '';
      const surface = ganeAnalyzeSurface(pageText, inst);
      if (!surface) return false;
      const analyzed = analyze(surface, opts);
      return isGanuldaGaneMorph(analyzed) === true;
    });
    return { ...group, instances };
  });
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ pageNum?: number, text?: string, visualText?: string }[]} pages
 * @param {{ analyze?: typeof analyzeLine, morphPrefetchMaxMs?: number }} [opts]
 */
export async function enrichCautionYaldaGaneMorph(groups, pages, opts = {}) {
  // 맞춤법만 돌릴 때도 Kiwi를 먼저 켠다. 안 켜면 remote만 보고,
  // 세션 복원·Bareun 키 없음이면 동형 판정이 비어 오탐이 남을 수 있다.
  if (typeof opts.analyze !== 'function') {
    try {
      await bootKiwiIfNeeded({
        auxMorph: true,
        maxWaitMs: opts.morphPrefetchMaxMs ?? 12_000,
      });
    } catch {
      /* fail-closed prune */
    }
  }
  await warmYaldaGaneMorphCache(groups, pages, opts);
  return pruneYaldaGaneFalseMorph(groups, pages, opts);
}
