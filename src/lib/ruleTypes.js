/** @typedef {'literal' | 'regex'} RulePattern */

/**
 * @typedef {'compound-tail' | 'compound-spacing' | 'custom-regex'} RuleKind
 */

/**
 * @typedef {Object} Rule
 * @property {string} find
 * @property {string} replace
 * @property {boolean} enabled
 * @property {boolean} [builtIn]
 * @property {RulePattern} [pattern] — 기본 literal
 * @property {string} [label] — 목록 표시용
 * @property {RuleKind} [patternKind]
 * @property {string} [tailWord] — 붙임 패턴일 때 사용자 [단어]
 * @property {string[]} [excludePrefixes] — 이 앞말($1)이면 검사 제외
 * @property {string[]} [excludePhrases] — 이 구문 전체가 매칭되면 제외
 * @property {'spelling' | 'consistency' | 'caution' | 'custom'} [category]
 * @property {string} [cautionId]
 * @property {string} [tip] — 시트 tip (맞춤법 결과 안내)
 * @property {string} [memo] — 시트 memo (관리용)
 */

export const MAX_RULES = 30;
