import { MANUAL_SOURCE } from './types.js';
import { addManualFindingToGroups } from './findingsSink.js';

/**
 * 공백만 고침 — 내용이 비는 삭제와 같아서 Replace 샘플이 없다.
 * trim하지 않은 채 검사한다. 「  」→「 」도 공백만이면 막힌다.
 * @param {string} replace
 */
export function isBlankReplace(replace) {
  return /^\s*$/.test(String(replace ?? ''));
}

/**
 * @param {string} value
 */
export function hasManualLineBreak(value) {
  return /[\n\r]/.test(String(value ?? ''));
}

/**
 * @param {import('./types.js').ManualFinding | null | undefined} manual
 * @param {{ text?: string, visualText?: string } | null | undefined} [page]
 */
export function canAddManualFinding(manual, page) {
  const matchedText = String(manual?.matchedText ?? '');
  const replace = String(manual?.replace ?? '');
  const tip = String(manual?.tip ?? '');
  const start = Number(manual?.start);
  const end = Number(manual?.end);
  if (!matchedText) return false;
  if (!(end > start)) return false;
  if (isBlankReplace(replace)) return false;
  if (hasManualLineBreak(replace) || hasManualLineBreak(tip)) return false;
  if (replace === matchedText) return false;
  const text = String(page?.text ?? page?.visualText ?? '');
  if (matchedText !== text.slice(start, end)) return false;
  return true;
}

/**
 * 확인 폼에 보여줄 거부 이유. 통과면 빈 문자열.
 * @param {import('./types.js').ManualFinding | null | undefined} manual
 * @param {{ text?: string, visualText?: string } | null | undefined} [page]
 */
export function manualAddRejectReason(manual, page) {
  if (canAddManualFinding(manual, page)) return '';
  const replace = String(manual?.replace ?? '');
  const tip = String(manual?.tip ?? '');
  if (isBlankReplace(replace)) return '수정을 입력하세요.';
  if (hasManualLineBreak(replace) || hasManualLineBreak(tip)) {
    return '수정과 메모에는 줄바꿈을 넣을 수 없습니다.';
  }
  if (replace === String(manual?.matchedText ?? '')) {
    return '원본과 다른 수정을 입력하세요.';
  }
  return '선택한 구간이 원문과 맞지 않습니다.';
}

/**
 * 수정 추가 유스케이스. 거부면 목록을 그대로 둔다.
 * @param {import('../ruleEngine.js').GroupedResult[]} groups
 * @param {import('./types.js').ManualFinding} manual
 * @param {{ text?: string, visualText?: string } | null | undefined} [page]
 * @returns {import('../ruleEngine.js').GroupedResult[]}
 */
export function addManualFinding(groups, manual, page) {
  if (!canAddManualFinding(manual, page)) return groups ?? [];
  const matchedText = String(manual.matchedText ?? '');
  return addManualFindingToGroups(groups, {
    ...manual,
    matchedText,
    replace: String(manual.replace ?? ''),
    source: MANUAL_SOURCE,
  });
}
