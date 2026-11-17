/**
 * 본조 2차 — 시트·regex로 후보를 잡은 뒤, 형태소로 **용언이 확인된 것만** 남긴다.
 * 1차 찾기는 그대로. 분석 실패·토큰 없음은 현행 유지(fail-open).
 */

import { analyzeLine } from './kiwiMorph/analyze.js';
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

/** 본용언·보조용언·형용사 등 — 보조 결합 후보를 용언으로 인정 */
function isPredicateTag(tag) {
  const base = tagBase(tag);
  return (
    base === 'VV' ||
    base === 'VX' ||
    base === 'VA' ||
    base === 'VCP' ||
    base === 'XSV'
  );
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
 * 형태소에 용언(VV/VX/VA…)이 있으면 보조 후보로 인정.
 * surface1to1이 아니어도 된다(되어간다·해보이는 등).
 * @param {{ tokens?: { str?: string, tag?: string }[] } | null | undefined} analyzed
 * @returns {boolean | null} true=인정, false=비용언, null=판단 불가(fail-open)
 */
export function isConfirmedAuxiliaryMorph(analyzed) {
  if (!analyzed) return null;
  const tokens = analyzed.tokens ?? [];
  if (!tokens.length) return null;
  return tokens.some((t) => isPredicateTag(t.tag));
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
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ analyze?: typeof analyzeLine, kiwi?: unknown }} [opts]
 */
export function pruneAuxiliaryFalseMorph(groups, opts = {}) {
  const analyze = opts.analyze ?? analyzeLine;
  return (groups ?? []).map((group) => {
    if (group?.patternKind !== 'auxiliary-verb') return group;
    const instances = (group.instances ?? []).filter((inst) => {
      const matched = String(inst?.matchedText ?? '');
      if (!matched) return true;
      const analyzed = analyze(matched, opts);
      const confirmed = isConfirmedAuxiliaryMorph(analyzed);
      // 분석 불가면 유지. 용언 태그가 확인된 것만 남긴다.
      if (confirmed === null) return true;
      return confirmed;
    });
    return { ...group, instances };
  });
}
