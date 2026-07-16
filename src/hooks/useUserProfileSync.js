import { useCallback, useEffect, useState } from 'react';
import {
  consumeResetOnboardingQuery,
  isOnboardingComplete,
  mergeUserProfileFromCloud,
  shouldSkipProfileCloudMerge,
  syncUserPlanFromCloud,
} from '../lib/userProfileStorage.js';
import { loadUserProfileCloud } from '../lib/userProfileCloud.js';

/**
 * 로그인 계정의 닉네임 프로필을 Firestore에서 불러와 localStorage에 반영한다.
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

    (async () => {
      try {
        const cloudProfile = await loadUserProfileCloud(uid);
        if (cancelled) return;
        if (cloudProfile) {
          let changed = false;
          if (syncUserPlanFromCloud(uid, cloudProfile.plan)) changed = true;
          if (mergeUserProfileFromCloud(uid, cloudProfile)) changed = true;
          if (changed) setProfileRev((n) => n + 1);
        }
      } catch {
        /* 네트워크·권한 오류 시 localStorage만 사용 */
      } finally {
        if (!cancelled) setProfileSyncDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUid]);

  const uid = String(authUid ?? '').trim();
  const onboardingComplete = uid ? isOnboardingComplete(uid) : false;

  return { profileRev, bumpProfileRev, onboardingComplete, profileSyncDone };
}
