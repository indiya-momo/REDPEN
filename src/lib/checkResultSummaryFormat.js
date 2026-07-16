import { AUXILIARY_VERB_BADGE_LABEL } from './bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from './consistencyRuleLimit.js';
import { LOANWORD_FEATURE_LABEL } from './loanwordCheckRules.js';

/** 결과 헤더·팝업·카드 뱃지 — 편집자 검토 */
export const EDITOR_REVIEW_BADGE_LABEL = '편집자 검토 필요';
/** 결과 헤더·팝업·카드 뱃지 — 맞춤법 규칙 */
export const SPELLING_RULE_BADGE_LABEL = '맞춤법 규칙';
/** 결과 헤더·팝업·카드 뱃지 — 외래어 표기법 */
export const LOANWORD_BADGE_LABEL = LOANWORD_FEATURE_LABEL;

/** confirm 등 — 활성 기준 개수 표기 */
export function formatCategoryFindingCount(count) {
  return `(${count}기준)`;
}

/** 검수 후 요약 — 활성 기준 수(N기준). 발견 건수는 원형으로 따로 표시 */
export function formatResultsStatCount(count) {
  return `${count}기준`;
}

/** 엑셀 요약 — `라벨 N기준 M발견` */
export function formatExcelCategoryStat(label, criteriaCount, findingsCount) {
  return `${label} ${criteriaCount}기준 ${findingsCount}발견`;
}

/**
 * 맞춤법 엑셀 2행 요약 — N기준은 화면과 동일(발견 있는 기준 그룹 수)
 * 예: `편집자 검토 필요 2기준 10발견 · 맞춤법 규칙 5기준 20발견 · 전체 발견 30`
 * @param {{
 *   cautionCriteriaCount: number,
 *   cautionFindingsCount: number,
 *   builtinCriteriaCount: number,
 *   builtinFindingsCount: number,
 *   loanwordCriteriaCount?: number,
 *   loanwordFindingsCount?: number,
 *   totalFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 *   loanwordSelected?: boolean,
 * }} input
 */
export function formatSpellingExcelSummaryLine({
  cautionCriteriaCount,
  cautionFindingsCount,
  builtinCriteriaCount,
  builtinFindingsCount,
  loanwordCriteriaCount = 0,
  loanwordFindingsCount = 0,
  totalFindings,
  cautionSelected = true,
  builtinSelected = true,
  loanwordSelected = false,
}) {
  const parts = [];
  if (cautionSelected) {
    parts.push(
      formatExcelCategoryStat(
        EDITOR_REVIEW_BADGE_LABEL,
        cautionCriteriaCount,
        cautionFindingsCount,
      ),
    );
  }
  if (builtinSelected) {
    parts.push(
      formatExcelCategoryStat(
        SPELLING_RULE_BADGE_LABEL,
        builtinCriteriaCount,
        builtinFindingsCount,
      ),
    );
  }
  if (loanwordSelected) {
    parts.push(
      formatExcelCategoryStat(
        LOANWORD_BADGE_LABEL,
        loanwordCriteriaCount,
        loanwordFindingsCount,
      ),
    );
  }
  const stats = parts.join(' · ');
  return stats
    ? `${stats} · 전체 발견 ${totalFindings}`
    : `전체 발견 ${totalFindings}`;
}

/**
 * 표기 통일 엑셀 2행 요약 — N기준은 화면과 동일(발견 있는 기준 그룹 수)
 * @param {{
 *   literalCriteriaCount: number,
 *   literalFindingsCount: number,
 *   unifyCriteriaCount?: number,
 *   unifyFindingsCount?: number,
 *   commonStringCriteriaCount: number,
 *   commonStringFindingsCount: number,
 *   auxiliaryCriteriaCount: number,
 *   auxiliaryFindingsCount: number,
 *   totalFindings: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} input
 */
export function formatConsistencyExcelSummaryLine({
  literalCriteriaCount,
  literalFindingsCount,
  unifyCriteriaCount = 0,
  unifyFindingsCount = 0,
  commonStringCriteriaCount,
  commonStringFindingsCount,
  auxiliaryCriteriaCount,
  auxiliaryFindingsCount,
  totalFindings,
  literalSelected = true,
  unifySelected = true,
  commonStringSelected = true,
  auxiliarySelected = true,
}) {
  const parts = [];
  if (literalSelected) {
    parts.push(
      formatExcelCategoryStat(
        LITERAL_FIND_FEATURE_LABEL,
        literalCriteriaCount,
        literalFindingsCount,
      ),
    );
  }
  if (unifySelected) {
    parts.push(
      formatExcelCategoryStat(
        UNIFY_FEATURE_LABEL,
        unifyCriteriaCount,
        unifyFindingsCount,
      ),
    );
  }
  if (commonStringSelected) {
    parts.push(
      formatExcelCategoryStat(
        '공통 항목 찾기',
        commonStringCriteriaCount,
        commonStringFindingsCount,
      ),
    );
  }
  if (auxiliarySelected) {
    parts.push(
      formatExcelCategoryStat(
        AUXILIARY_VERB_BADGE_LABEL,
        auxiliaryCriteriaCount,
        auxiliaryFindingsCount,
      ),
    );
  }
  const stats = parts.join(' · ');
  return stats
    ? `${stats} · 전체 발견 ${totalFindings}`
    : `전체 발견 ${totalFindings}`;
}

/**
 * @param {{
 *   cautionWithFindings: number,
 *   builtinWithFindings: number,
 *   loanwordWithFindings?: number,
 *   totalFindings: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 *   loanwordSelected?: boolean,
 * }} input
 */
export function formatSpellingResultsSummaryLine({
  cautionWithFindings,
  builtinWithFindings,
  loanwordWithFindings = 0,
  totalFindings,
  cautionSelected = true,
  builtinSelected = true,
  loanwordSelected = false,
}) {
  const parts = [];
  if (cautionSelected) {
    parts.push(
      `${EDITOR_REVIEW_BADGE_LABEL} ${formatResultsStatCount(cautionWithFindings)}`,
    );
  }
  if (builtinSelected) {
    parts.push(
      `${SPELLING_RULE_BADGE_LABEL} ${formatResultsStatCount(builtinWithFindings)}`,
    );
  }
  if (loanwordSelected) {
    parts.push(
      `${LOANWORD_BADGE_LABEL} ${formatResultsStatCount(loanwordWithFindings)}`,
    );
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
    parts.push(`${UNIFY_FEATURE_LABEL} ${formatResultsStatCount(unifyWithFindings)}`);
  }
  if (commonStringSelected) {
    parts.push(
      `공통 항목 찾기 ${formatResultsStatCount(commonStringWithFindings)}`,
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
 *   loanwordWithFindings?: number,
 *   editorReviewFindings?: number,
 *   spellingFindings?: number,
 *   loanwordFindings?: number,
 *   cautionSelected?: boolean,
 *   builtinSelected?: boolean,
 *   loanwordSelected?: boolean,
 * }} input
 * @returns {Array<{ badge: string, count: number, findingsCount: number, tone: import('./resultPillarTone.js').ResultBadgeTone }>}
 */
export function buildSpellingResultSummaryStats({
  cautionWithFindings,
  builtinWithFindings,
  loanwordWithFindings = 0,
  editorReviewFindings = 0,
  spellingFindings = 0,
  loanwordFindings = 0,
  cautionSelected = true,
  builtinSelected = true,
  loanwordSelected = false,
}) {
  const stats = [];
  if (cautionSelected) {
    stats.push({
      badge: EDITOR_REVIEW_BADGE_LABEL,
      count: cautionWithFindings,
      findingsCount: editorReviewFindings,
      tone: 'spelling-caution',
    });
  }
  if (builtinSelected) {
    stats.push({
      badge: SPELLING_RULE_BADGE_LABEL,
      count: builtinWithFindings,
      findingsCount: spellingFindings,
      tone: 'spelling-builtin',
    });
  }
  if (loanwordSelected) {
    stats.push({
      badge: LOANWORD_BADGE_LABEL,
      count: loanwordWithFindings,
      findingsCount: loanwordFindings,
      tone: 'spelling-loanword',
    });
  }
  return stats;
}

/**
 * @param {{
 *   literalWithFindings: number,
 *   unifyWithFindings?: number,
 *   commonStringWithFindings: number,
 *   auxiliaryWithFindings: number,
 *   literalFindings?: number,
 *   unifyFindings?: number,
 *   commonStringFindings?: number,
 *   auxiliaryFindings?: number,
 *   literalSelected?: boolean,
 *   unifySelected?: boolean,
 *   commonStringSelected?: boolean,
 *   auxiliarySelected?: boolean,
 * }} input
 * @returns {Array<{ badge: string, count: number, findingsCount: number, tone: import('./resultPillarTone.js').ResultBadgeTone }>}
 */
export function buildConsistencyResultSummaryStats({
  literalWithFindings,
  unifyWithFindings = 0,
  commonStringWithFindings,
  auxiliaryWithFindings,
  literalFindings = 0,
  unifyFindings = 0,
  commonStringFindings = 0,
  auxiliaryFindings = 0,
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
      findingsCount: literalFindings,
      tone: 'consistency-literal',
    });
  }
  if (unifySelected) {
    stats.push({
      badge: UNIFY_FEATURE_LABEL,
      count: unifyWithFindings,
      findingsCount: unifyFindings,
      tone: 'consistency-unify',
    });
  }
  if (commonStringSelected) {
    stats.push({
      badge: '공통 항목 찾기',
      count: commonStringWithFindings,
      findingsCount: commonStringFindings,
      tone: 'consistency-common',
    });
  }
  if (auxiliarySelected) {
    stats.push({
      badge: AUXILIARY_VERB_BADGE_LABEL,
      count: auxiliaryWithFindings,
      findingsCount: auxiliaryFindings,
      tone: 'auxiliary',
    });
  }
  return stats;
}
