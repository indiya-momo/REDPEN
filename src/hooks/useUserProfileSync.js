import { useCallback, useEffect, useState } from 'react';
import {
  consumeResetOnboardingQuery,
  isOnboardingComplete,
  mergeUserProfileFromCloud,
  shouldSkipProfileCloudMerge,
  syncUserPlanFromCloud,
} from '../lib/userProfileStorage.js';
import { loadUserCriteriaCloud } from '../lib/userProfileCloud.js';

/**
 * 로그인 계정의 닉네임 프로필·plan 을 Firestore에서 불러와 localStorage에 반영한다.
 * plan 은 닉네임/온보딩 여부와 무관하게 항상 동기화한다.
 * @param {string} authUid
 */
export function useUserProfileSync(authUid) {
  const [profileRev, setProfileRev] = useState(0);
  const [profileSyncDone, setProfileSyncDone] = useState(() => {
    const uid = String(authUid ?? '').trim();
    return !uid;
  });
  const bumpProfileRev = useCallback(() => {
    setProfileRev((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!consumeResetOnboardingQuery()) return;
    setProfileRev((n) => n + 1);
  }, []);

  useEffect(() => {
    const uid = String(authUid ?? '').trim();
    if (!uid) {
      setProfileSyncDone(true);
      return undefined;
    }
    if (shouldSkipProfileCloudMerge()) {
      setProfileSyncDone(true);
      return undefined;
    }

    let cancelled = false;
    setProfileSyncDone(false);

    async function syncFromCloud({ markDone }) {
      let changed = false;
      try {
        const { plan, profile } = await loadUserCriteriaCloud(uid);
        if (cancelled) return;
        // plan 은 nickname 없이도 문서에 있을 수 있음 (관리자 선등록)
        if (syncUserPlanFromCloud(uid, plan)) changed = true;
        if (profile && mergeUserProfileFromCloud(uid, profile)) changed = true;
      } catch {
        /* 네트워크·권한 오류 시 localStorage만 사용 */
      } finally {
        if (cancelled) return;
        if (markDone) setProfileSyncDone(true);
        if (changed) setProfileRev((n) => n + 1);
      }
    }

    void syncFromCloud({ markDone: true });

    const refreshPlan = () => {
      if (document.visibilityState !== 'visible') return;
      void syncFromCloud({ markDone: false });
    };
    window.addEventListener('focus', refreshPlan);
    document.addEventListener('visibilitychange', refreshPlan);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshPlan);
      document.removeEventListener('visibilitychange', refreshPlan);
    };
  }, [authUid]);

  const uid = String(authUid ?? '').trim();
  const onboardingComplete = uid ? isOnboardingComplete(uid) : false;

  return { profileRev, bumpProfileRev, onboardingComplete, profileSyncDone };
}
