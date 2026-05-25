import { buildCautionCheckRules, defaultCautionEnabled } from './cautionRules.js';
import { BUILT_IN_RULES, builtInEnabledFromSheet, isBuiltInRuleEnabled } from './builtInRules.js';
import { MAX_RULES } from './ruleTypes.js';

/** @param {{ builtInEnabled?: Record<string, boolean> }} [input] */
export function countBuiltInActiveRules(input = {}) {
  const builtInEnabled = input.builtInEnabled ?? builtInEnabledFromSheet();
  return BUILT_IN_RULES.filter((r) =>
    isBuiltInRuleEnabled(builtInEnabled, r.find),
  ).length;
}

/** @param {{ cautionEnabled?: Record<string, boolean> }} [input] */
export function countSpacingReviewActiveRules(input = {}) {
  const cautionEnabled = input.cautionEnabled ?? defaultCautionEnabled();
  return buildCautionCheckRules(cautionEnabled).length;
}

/**
 * 맞춤법 탭 검사에 쓰이는 활성 규칙 수 (자동 맞춤법 + 띄어쓰기 검토)
 * @param {{
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 * }} input
 */
export function countSpellingActiveRules(input = {}) {
  return (
    countBuiltInActiveRules(input) + countSpacingReviewActiveRules(input)
  );
}

/**
 * 일관성 탭 활성 규칙 수
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export function countConsistencyActiveRules(customRules = []) {
  return customRules.filter((r) => r.enabled).length;
}

/**
 * 활성 규칙 합계 — 자동 맞춤법 + 띄어쓰기 검토 + 일관성(사용자)
 * @param {{
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 *   customRules?: import('./ruleTypes.js').Rule[],
 * }} input
 */
export function countActiveRules(input = {}) {
  const customRules = input.customRules ?? [];
  return (
    countSpellingActiveRules(input) + countConsistencyActiveRules(customRules)
  );
}

/** @param {number} count */
export function isOverMaxRules(count) {
  return count > MAX_RULES;
}

/** @param {number} [count] */
export function maxRulesExceededMessage(count) {
  const n = count ?? MAX_RULES + 1;
  return `활성 규칙이 ${n}개입니다. 최대 ${MAX_RULES}개까지 줄인 뒤 다시 시도하세요.`;
}
