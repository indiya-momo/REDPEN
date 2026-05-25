import { buildRulesForAuxiliaryEntry } from './auxiliaryVerbRegister.js';

/**
 * 시트 verb-bon / verb-special 에서 일관성 「본용언+보조용언 찾기」로 옮긴 기본 목록.
 * 새 규칙 세트·마이그레이션 시 없는 항목만 추가(기본 체크 off).
 * @type {readonly string[]}
 */
export const DEFAULT_AUXILIARY_TAIL_WORDS = [
  '보',
  '주',
  '두',
  '놓',
  '가',
  '오',
  '내',
  '지',
  '하',
  '있',
  '해보',
  '해 보',
];

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function ensureDefaultAuxiliaryVerbs(customRules) {
  let rules = [...(customRules ?? [])];
  for (const tail of DEFAULT_AUXILIARY_TAIL_WORDS) {
    const batch = buildRulesForAuxiliaryEntry(rules, tail);
    if (!batch.length) continue;
    rules = [
      ...rules,
      ...batch.map((r) => ({ ...r, enabled: false })),
    ];
  }
  return rules;
}
