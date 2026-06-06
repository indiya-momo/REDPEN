import { getKstDayId } from './betaDailyQuota.js';

const STORAGE_PREFIX = 'indiya-work-guide-onboarding-exposure--';

/** 온보딩 말풍선 — 인당 최대 노출 횟수 (하루 1회) */
export const WORK_GUIDE_ONBOARDING_MAX_EXPOSURES = 5;

/**
 * @param {string} uid
 */
function storageKey(uid) {
  return `${STORAGE_PREFIX}${uid.trim()}`;
}

/**
 * @param {string} uid
 * @returns {{ count: number, lastDayId: string | null }}
 */
export function readWorkGuideOnboardingExposure(uid) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) {
    return { count: 0, lastDayId: null };
  }
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return { count: 0, lastDayId: null };
    const parsed = JSON.parse(raw);
    return {
      count: Math.max(0, Math.min(WORK_GUIDE_ONBOARDING_MAX_EXPOSURES, Number(parsed?.count) || 0)),
      lastDayId:
        typeof parsed?.lastDayId === 'string' ? parsed.lastDayId : null,
    };
  } catch {
    return { count: 0, lastDayId: null };
  }
}

/**
 * @param {string} uid
 * @param {{ count: number, lastDayId: string | null }} state
 */
function writeWorkGuideOnboardingExposure(uid, state) {
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) return;
  try {
    localStorage.setItem(
      storageKey(id),
      JSON.stringify({
        count: Math.max(
          0,
          Math.min(WORK_GUIDE_ONBOARDING_MAX_EXPOSURES, state.count),
        ),
        lastDayId: state.lastDayId,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* private mode */
  }
}

/**
 * 오늘 첫 노출 시 슬롯 1회 소비 (렌더마다 호출해도 하루 1회만 증가)
 * @param {string} uid
 * @param {string} [dayId]
 * @returns {{ ok: boolean, committed: boolean }}
 */
export function commitWorkGuideOnboardingExposureSlot(uid, dayId = getKstDayId()) {
  const state = readWorkGuideOnboardingExposure(uid);
  if (state.count >= WORK_GUIDE_ONBOARDING_MAX_EXPOSURES) {
    return { ok: false, committed: false };
  }
  if (state.lastDayId === dayId) {
    return { ok: true, committed: false };
  }
  writeWorkGuideOnboardingExposure(uid, {
    count: state.count + 1,
    lastDayId: dayId,
  });
  return { ok: true, committed: true };
}

/**
 * @param {ReturnType<typeof import('./workGuideChainState.js').getWorkGuideChainState>} chain
 */
export function isWorkGuideChainOpen(chain) {
  return Boolean(chain?.workGuideOpen);
}

/**
 * 체인 노출 가능 여부 (읽기 전용 — 카운트는 commit에서만 증가)
 * @param {string} uid
 * @param {ReturnType<typeof import('./workGuideChainState.js').getWorkGuideChainState>} chain
 * @param {string | null} activeGuideKey
 * @param {boolean} activeGuideDismissed
 * @param {string} [dayId]
 */
export function isWorkGuideOnboardingExposureAllowed(
  uid,
  chain,
  activeGuideKey,
  activeGuideDismissed,
  dayId = getKstDayId(),
) {
  if (!isWorkGuideChainOpen(chain)) {
    return true;
  }
  const id = typeof uid === 'string' ? uid.trim() : '';
  if (!id) return true;

  const state = readWorkGuideOnboardingExposure(uid);
  if (state.count >= WORK_GUIDE_ONBOARDING_MAX_EXPOSURES) {
    return false;
  }

  if (state.lastDayId === dayId) {
    if (!activeGuideKey || activeGuideDismissed) {
      return false;
    }
    return true;
  }

  return state.count < WORK_GUIDE_ONBOARDING_MAX_EXPOSURES;
}
