import { isBetaQuotaAdminExempt } from './betaDailyQuota.js';

/** 일반 계정 — 저장한 기준(이름 붙인 프리셋) 상한 */
export const MAX_CRITERIA_PRESETS = 3;

export const CRITERIA_PRESET_LIMIT_MESSAGE =
  '프로젝트는 계정당 3개까지 저장할 수 있습니다.';

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
  // 프로젝트 슬롯은 로컬 완화와 무관 — 한도·안내 팝업을 항상 맞춤.
  return isBetaQuotaAdminExempt(uid, email);
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
 * 비관리자 — 저장 프리셋이 상한을 넘으면 가장 최근 N개만 유지
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} [uid]
 * @param {string} [email]
 */
export function enforceMaxCriteriaPresets(ruleSets, uid, email = '') {
  if (isCriteriaPresetLimitExempt(uid, email)) return ruleSets;
  const list = ruleSets ?? [];
  const saved = list.filter((s) => Boolean(s.savedAt));
  if (saved.length <= MAX_CRITERIA_PRESETS) return list;

  const keepIds = new Set(
    [...saved]
      .sort((a, b) => {
        const timeDiff =
          Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? '');
        if (timeDiff !== 0) return timeDiff;
        const aNamed = (a.name || '').trim() ? 1 : 0;
        const bNamed = (b.name || '').trim() ? 1 : 0;
        return bNamed - aNamed;
      })
      .slice(0, MAX_CRITERIA_PRESETS)
      .map((s) => s.id),
  );

  return list.filter((s) => !s.savedAt || keepIds.has(s.id));
}
