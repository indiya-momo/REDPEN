/**
 * 본조 2차 — 시트·regex로 후보를 잡은 뒤, 형태소로 **용언이 확인된 것만** 남긴다.
 * 1차 찾기는 그대로. 분석 실패·토큰 없음은 버린다(fail-closed).
 */

import { prefetchBareunAnalyze } from './bareunMorph/prefetch.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { getRemoteAnalyze } from './kiwiMorph/remoteCache.js';
import { getKiwiInstance } from './kiwiMorph/runtime.js';
import { prefetchKiwiAnalyze } from './kiwiMorph/serverRunner.js';
import { isJosaTag } from './kiwiMorph/tokens.js';

/** @param {string | undefined} tag */
function tagBase(tag) {
  return String(tag ?? '').split('-')[0];
}

/** @param {string | undefined} tag */
function isNounTag(tag) {
  const base = tagBase(tag);
  return base === 'NNG' || base === 'NNP' || base === 'NNB';
}

/**
 * 본용언·보조용언 — 보조 결합 후보로 인정.
 * VA만(어두운)·VCP만(아들인)은 제외. VA/VCP 앞에 있어도 VV/VX/XSV가 있으면 통과.
 */
function isAuxiliaryPredicateTag(tag) {
  const base = tagBase(tag);
  return base === 'VV' || base === 'VX' || base === 'XSV';
}

/**
 * @param {{ bonBojoItemId?: string, label?: string, groupDisplayLabel?: string } | null | undefined} group
 */
export function isDeuldaAuxiliaryGroup(group) {
  if (group?.bonBojoItemId === 'verb-delda') return true;
  const label = `${group?.groupDisplayLabel ?? ''} ${group?.label ?? ''}`;
  return /\+\s*들다/.test(label);
}

/**
 * 형태소에 VV/VX/XSV가 있으면 보조 후보로 인정.
 * surface1to1이 아니어도 된다(되어간다·해보이는 등).
 * VA만(어두운)·VCP만(아들인·나라이다)은 인정하지 않는다.
 * @param {{ tokens?: { str?: string, tag?: string }[] } | null | undefined} analyzed
 * @returns {boolean | null} true=인정, false=비용언, null=판단 불가
 */
export function isConfirmedAuxiliaryMorph(analyzed) {
  if (!analyzed) return null;
  const tokens = analyzed.tokens ?? [];
  if (!tokens.length) return null;
  return tokens.some((t) => isAuxiliaryPredicateTag(t.tag));
}

/**
 * @deprecated 들다 전용 블랙리스트. 신규는 isConfirmedAuxiliaryMorph.
 * @param {string} matched
 * @param {{ tokens?: { str?: string, tag?: string }[], surface1to1?: boolean } | null | undefined} analyzed
 */
export function isFalseDeuldaAuxiliaryMorph(matched, analyzed) {
  if (!String(matched ?? '').trim()) return false;
  if (!analyzed || analyzed.surface1to1 !== true) return false;
  const tokens = analyzed.tokens ?? [];
  if (!tokens.length) return false;
  for (const t of tokens) {
    const str = String(t.str ?? '');
    const tag = String(t.tag ?? '');
    const base = tagBase(tag);
    if (str === '들' && (base === 'XSN' || tag.startsWith('XSN'))) return true;
    if (str === '아들' && isNounTag(tag)) return true;
    if (str === '딸' && isNounTag(tag)) return true;
    if (str === '아' && (isJosaTag(tag) || base === 'IC')) return true;
  }
  return false;
}

/**
 * 본조 후보 matchedText 수집 — prefetch용.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @returns {string[]}
 */
export function collectAuxiliaryMorphSurfaces(groups) {
  /** @type {string[]} */
  const out = [];
  for (const group of groups ?? []) {
    if (group?.patternKind !== 'auxiliary-verb') continue;
    for (const inst of group.instances ?? []) {
      const matched = String(inst?.matchedText ?? '').trim();
      if (matched) out.push(matched);
    }
  }
  return out;
}

/**
 * 로컬 Kiwi가 없으면 서버 prefetch로 remoteCache를 채운다.
 * 테스트가 `analyze`를 넘기면 생략.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ analyze?: typeof analyzeLine, morphPrefetchMaxMs?: number }} [opts]
 */
export async function warmAuxiliaryMorphCache(groups, opts = {}) {
  if (typeof opts.analyze === 'function') return 0;
  try {
    if (getKiwiInstance()?.ready?.()) return 0;
  } catch {
    /* prefetch */
  }
  const texts = collectAuxiliaryMorphSurfaces(groups);
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
 * @param {{ analyze?: typeof analyzeLine, kiwi?: unknown }} [opts]
 */
export function pruneAuxiliaryFalseMorph(groups, opts = {}) {
  const analyze = opts.analyze ?? analyzeLine;
  return (groups ?? []).map((group) => {
    if (group?.patternKind !== 'auxiliary-verb') return group;
    const instances = (group.instances ?? []).filter((inst) => {
      const matched = String(inst?.matchedText ?? '');
      if (!matched) return false;
      const analyzed = analyze(matched, opts);
      // fail-closed: 용언 태그가 확인된 것만 남긴다
      return isConfirmedAuxiliaryMorph(analyzed) === true;
    });
    return { ...group, instances };
  });
}
