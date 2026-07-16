import { isBetaQuotaAdminExempt } from './betaDailyQuota.js';
import { isPaidPlan, normalizeUserPlan } from './userPlan.js';
import { getLocalUserPlan } from './userProfileStorage.js';

/** 무료 계정 — 저장한 기준(이름 붙인 프리셋) 상한 */
export const MAX_CRITERIA_PRESETS_FREE = 1;

/** 유료 계정 — 저장 상한 */
export const MAX_CRITERIA_PRESETS_PAID = 3;

/**
 * 선반 UI·하위 호환용 — 유료 상한과 동일.
 * 실제 한도는 `getMaxCriteriaPresets`를 쓴다.
 */
export const MAX_CRITERIA_PRESETS = MAX_CRITERIA_PRESETS_PAID;

/**
 * @param {number | null} maxSlots null = 무제한(관리자)
 */
export function formatCriteriaPresetLimitMessage(maxSlots) {
  if (maxSlots == null) {
    return '프로젝트 저장 한도가 없습니다.';
  }
  return `프로젝트는 계정당 ${maxSlots}개까지 저장할 수 있습니다.`;
}

/** @deprecated `formatCriteriaPresetLimitMessage(getMaxCriteriaPresets(...))` 권장 */
export const CRITERIA_PRESET_LIMIT_MESSAGE =
  formatCriteriaPresetLimitMessage(MAX_CRITERIA_PRESETS_FREE);

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
 * @param {string} [uid]
 * @param {string} [email]
 * @param {unknown} [plan] 생략 시 로컬 프로필 plan
 * @returns {number | null} null = 무제한
 */
export function getMaxCriteriaPresets(uid = '', email = '', plan) {
  if (isCriteriaPresetLimitExempt(uid, email)) return null;
  const resolved =
    plan === undefined ? getLocalUserPlan(uid) : normalizeUserPlan(plan);
  return isPaidPlan({ plan: resolved })
    ? MAX_CRITERIA_PRESETS_PAID
    : MAX_CRITERIA_PRESETS_FREE;
}

/**
 * 새 이름으로 기준 저장 가능 여부 (동일 이름 덮어쓰기는 항상 허용)
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} name
 * @param {string} [uid]
 * @param {string} [email]
 * @param {unknown} [plan]
 */
export function canAddCriteriaPreset(ruleSets, name, uid, email = '', plan) {
  const maxSlots = getMaxCriteriaPresets(uid, email, plan);
  if (maxSlots == null) return true;
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return false;
  const existing = ruleSets.find((s) => (s.name || '').trim() === trimmed);
  if (existing) return true;
  return countSavedCriteriaPresets(ruleSets) < maxSlots;
}

/**
 * 비관리자 — 저장 프리셋이 상한을 넘으면 가장 최근 N개만 유지
 * @param {import('./ruleSetsStorage.js').RuleSet[]} ruleSets
 * @param {string} [uid]
 * @param {string} [email]
 * @param {unknown} [plan]
 */
export function enforceMaxCriteriaPresets(ruleSets, uid, email = '', plan) {
  const maxSlots = getMaxCriteriaPresets(uid, email, plan);
  if (maxSlots == null) return ruleSets;
  const list = ruleSets ?? [];
  const saved = list.filter((s) => Boolean(s.savedAt));
  if (saved.length <= maxSlots) return list;

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
      .slice(0, maxSlots)
      .map((s) => s.id),
  );

  return list.filter((s) => !s.savedAt || keepIds.has(s.id));
}
