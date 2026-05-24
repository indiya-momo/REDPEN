import { buildCautionCheckRules, defaultCautionEnabled } from './cautionRules.js';
import { BUILT_IN_RULES, builtInEnabledFromSheet } from './builtInRules.js';
import { MAX_RULES } from './ruleTypes.js';

/**
 * 맞춤법 검사에 쓰이는 활성 규칙 수 (내장 + 주의)
 * @param {{
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 * }} input
 */
export function countSpellingActiveRules(input = {}) {
  const builtInEnabled = input.builtInEnabled ?? builtInEnabledFromSheet();
  const cautionEnabled = input.cautionEnabled ?? defaultCautionEnabled();

  const builtIn = BUILT_IN_RULES.filter(
    (r) => builtInEnabled[r.find] !== false,
  ).length;
  const caution = buildCautionCheckRules(cautionEnabled).length;
  return builtIn + caution;
}

/**
 * 일관성 탭 활성 규칙 수
 * @param {import('./ruleTypes.js').Rule[]} [customRules]
 */
export function countConsistencyActiveRules(customRules = []) {
  return customRules.filter((r) => r.enabled).length;
}

/**
 * 활성 규칙 합계 — 내장 맞춤법 + 주의 + 일관성(사용자)
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
