import {
  isBetaQuotaAdminExempt,
  isLocalDevQuotaRelaxed,
} from './betaDailyQuota.js';

/** 일반 계정 — 저장한 기준(이름 붙인 프리셋) 상한 */
export const MAX_CRITERIA_PRESETS = 1;

export const CRITERIA_PRESET_LIMIT_MESSAGE =
  '프로젝트는 계정당 1개만 저장할 수 있습니다.';

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 */
export function countSavedCriteriaPresets(ruleSets) {
  return ruleSets.filter((s) => Boolean(s.savedAt)).length;
}

/**
 * @param {string} [uid]
 * @param {string} [email]
 */
export function isCriteriaPresetLimitExempt(uid, email = '') {
  return isLocalDevQuotaRelaxed() || isBetaQuotaAdminExempt(uid, email);
}

/**
 * 새 이름으로 기준 저장 가능 여부 (동일 이름 덮어쓰기는 항상 허용)
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} name
 * @param {string} [uid]
 * @param {string} [email]
 */
export function canAddCriteriaPreset(ruleSets, name, uid, email = '') {
  if (isCriteriaPresetLimitExempt(uid, email)) return true;
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return false;
  const existing = ruleSets.find((s) => (s.name || '').trim() === trimmed);
  if (existing) return true;
  return countSavedCriteriaPresets(ruleSets) < MAX_CRITERIA_PRESETS;
}

/**
 * 비관리자 — 저장 프리셋이 상한을 넘으면 가장 최근 1개만 유지
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} [uid]
 * @param {string} [email]
 */
export function enforceMaxCriteriaPresets(ruleSets, uid, email = '') {
  if (isCriteriaPresetLimitExempt(uid, email)) return ruleSets;
  const saved = ruleSets.filter((s) => Boolean(s.savedAt));
  if (saved.length <= MAX_CRITERIA_PRESETS) return ruleSets;

  const newest = [...saved].sort((a, b) => {
    const timeDiff =
      Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? '');
    if (timeDiff !== 0) return timeDiff;
    const aNamed = (a.name || '').trim() ? 1 : 0;
    const bNamed = (b.name || '').trim() ? 1 : 0;
    return bNamed - aNamed;
  })[0];
  if (!newest) return ruleSets;

  return ruleSets.filter((s) => !s.savedAt || s.id === newest.id);
}
