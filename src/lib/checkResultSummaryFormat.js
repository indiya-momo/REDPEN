import { AUXILIARY_VERB_BADGE_LABEL } from './bonBojoRules.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';

/** confirm 등 — 활성 기준 개수 표기 */
export function formatCategoryFindingCount(count) {
  return `(${count}건)`;
}

/** 검수 후 요약 — 결과 헤더와 동일한 N건 표기 */
export function formatResultsStatCount(count) {
  return `${count}건`;
}

/**
 * @param {{
 *   cautionWithFindings: number,
 *   builtinWithFindings: number,
 *   totalFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 * }} input
 */
export function formatSpellingResultsSummaryLine({
  cautionWithFindings,
  builtinWithFindings,
  totalFindings,
  cautionSelected = true,
  builtinSelected = true,
}) {
  const parts = [];
  if (cautionSelected) {
    parts.push(
      `편집자 검토 ${formatResultsStatCount(cautionWithFindings)}`,
    );
  }
  if (builtinSelected) {
    parts.push(`맞춤법 ${formatResultsStatCount(builtinWithFindings)}`);
  }
  const stats = parts.join(', ');
  return stats
    ? `${stats} 전체 발견 ${totalFindings}`
    : `전체 발견 ${totalFindings}`;
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   totalFindings: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} input
 */
export function formatConsistencyResultsSummaryLine({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  totalFindings,
  literalSelected = true,
  unifySelected = true,
  commonStringSelected = true,
  auxiliarySelected = true,
}) {
  const parts = [];
  if (literalSelected) {
    parts.push(
      `${LITERAL_FIND_FEATURE_LABEL} ${formatResultsStatCount(literalWithFindings)}`,
    );
  }
  if (unifySelected) {
    parts.push(`통일형 찾기 ${formatResultsStatCount(unifyWithFindings)}`);
  }
  if (commonStringSelected) {
    parts.push(
      `공통 문자열 찾기 ${formatResultsStatCount(commonStringWithFindings)}`,
    );
  }
  if (auxiliarySelected) {
    parts.push(
      `${AUXILIARY_VERB_BADGE_LABEL} ${formatResultsStatCount(auxiliaryWithFindings)}`,
    );
  }
  const stats = parts.join(', ');
  return stats
    ? `${stats} 전체 발견 ${totalFindings}`
    : `전체 발견 ${totalFindings}`;
}

/**
 * @param {{
 *   cautionWithFindings: number,
 *   builtinWithFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 * }} input
 * @returns {Array<{ badge: string, count: number }>}
 */
export function buildSpellingResultSummaryStats({
  cautionWithFindings,
  builtinWithFindings,
  cautionSelected = true,
  builtinSelected = true,
}) {
  const stats = [];
  if (cautionSelected) {
    stats.push({ badge: '편집자 검토', count: cautionWithFindings });
  }
  if (builtinSelected) {
    stats.push({ badge: '맞춤법', count: builtinWithFindings });
  }
  return stats;
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} input
 * @returns {Array<{ badge: string, count: number }>}
 */
export function buildConsistencyResultSummaryStats({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  literalSelected = true,
  unifySelected = true,
  commonStringSelected = true,
  auxiliarySelected = true,
}) {
  const stats = [];
  if (literalSelected) {
    stats.push({
      badge: LITERAL_FIND_FEATURE_LABEL,
      count: literalWithFindings,
    });
  }
  if (unifySelected) {
    stats.push({ badge: '통일형 찾기', count: unifyWithFindings });
  }
  if (commonStringSelected) {
    stats.push({
      badge: '공통 문자열 찾기',
      count: commonStringWithFindings,
    });
  }
  if (auxiliarySelected) {
    stats.push({
      badge: AUXILIARY_VERB_BADGE_LABEL,
      count: auxiliaryWithFindings,
    });
  }
  return stats;
}
