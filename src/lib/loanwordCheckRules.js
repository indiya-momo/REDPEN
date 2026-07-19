/**
 * 외래어 표기법 검수 — 도메인 규칙.
 *
 * 국립국어원 심의를 근거로 선별한 내장 맞춤법 규칙 중 묶음 이름이
 * "자주 틀리는 외래어 표기법(…)"인 규칙들을 별도 구분(세 번째 아코디언)으로 다룬다.
 * (구 시트값 "외래어 표기법(…)"도 호환)
 * 조판에 비유하면 같은 오식 대조표 안에서 "외래어 면"만 따로 철한 것이다.
 *
 * 데이터 형식은 spelling-rules.json 그대로라서(전용 필드 없음)
 * 구글 시트 동기화(sync-spelling)에도 영향이 없다.
 */

/** 구분(카테고리) 표시 이름 — 패널 제목·결과 뱃지·엑셀 구분 열 공용 */
export const LOANWORD_FEATURE_LABEL = '자주 틀리는 외래어 표기법';

/** GroupedResult.category 값 */
export const LOANWORD_CATEGORY = 'loanword';

/** 묶음 이름 앞머리 — 이 프리픽스면 외래어 표기법 구분으로 분류 */
const LOANWORD_DIVIDER_PREFIX = '자주 틀리는 외래어 표기법';
/** 구 시트·JSON 호환 */
const LOANWORD_DIVIDER_PREFIX_LEGACY = '외래어 표기법';

/**
 * 내장 맞춤법 규칙(행)이 외래어 표기법 구분에 속하는지.
 * @param {{ dividerLabel?: string }} ruleOrRow
 */
export function isLoanwordSpellingRule(ruleOrRow) {
  const label = String(ruleOrRow?.dividerLabel ?? '').trim();
  return (
    label.startsWith(LOANWORD_DIVIDER_PREFIX) ||
    label.startsWith(LOANWORD_DIVIDER_PREFIX_LEGACY)
  );
}

/**
 * 오표기 사전 묶음 id — 한글 2음절 이하는 short, 그 외는 main.
 * @param {string} typo
 * @returns {'main' | 'short'}
 */
export function loanwordBundleIdOf(typo) {
  const hangulCount = (String(typo).match(/[\uAC00-\uD7A3]/g) || []).length;
  return hangulCount <= 2 ? 'short' : 'main';
}

/**
 * 바른 표기 배열을 결과 replace 문구로.
 * @param {string[]} corrects
 */
export function buildLoanwordSuggestion(corrects) {
  const list = Array.isArray(corrects) ? corrects.filter(Boolean) : [];
  if (list.length <= 1) return list[0] ?? '';
  return list.join(' 또는 ');
}

/**
 * 결과 tip 문구.
 * @param {string[]} corrects
 * @param {string} [source]
 */
export function buildLoanwordTip(corrects, source = '') {
  const list = Array.isArray(corrects) ? corrects.filter(Boolean) : [];
  const prefix = String(source ?? '').trim();
  if (list.length > 1) {
    return `${prefix} — 바른 표기가 둘 이상, 편집자 확인 필요`;
  }
  return `${prefix} — 국어원 용례집 등재 표기는 '${list[0] ?? ''}'`;
}
