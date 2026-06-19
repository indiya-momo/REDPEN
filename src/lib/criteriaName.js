export const CRITERIA_NAME_PLACEHOLDER = '프로젝트 이름 입력·선택';

/** 예전 기본 세트·입력창에 넣던 안내 문구 — 실제 이름으로 취급하지 않음 */
export const LEGACY_DEFAULT_CRITERIA_HINT =
  '선택한 맞춤법 /일관성 기준을 저장합니다';

const LEGACY_CRITERIA_NAME_PLACEHOLDER = '기준 이름 입력·선택';

const NON_SAVEABLE_NAMES = new Set([
  CRITERIA_NAME_PLACEHOLDER,
  LEGACY_CRITERIA_NAME_PLACEHOLDER,
  LEGACY_DEFAULT_CRITERIA_HINT,
]);

/** localStorage·active set 이름 → 입력창 value (빈 문자열이면 placeholder만 표시) */
export function criteriaNameForInput(storedName) {
  const trimmed = String(storedName ?? '').trim();
  if (!trimmed || NON_SAVEABLE_NAMES.has(trimmed)) return '';
  return trimmed;
}

/** 저장 버튼용 — placeholder·레거시 안내 문구는 빈 이름으로 처리 */
export function criteriaNameForSave(rawName) {
  return criteriaNameForInput(rawName);
}
