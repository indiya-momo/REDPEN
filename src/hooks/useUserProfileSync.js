import { useCallback, useEffect, useState } from 'react';
import {
  isOnboardingComplete,
  mergeUserProfileFromCloud,
} from '../lib/userProfileStorage.js';
import { loadUserProfileCloud } from '../lib/userProfileCloud.js';

/**
 * 로그인 계정의 닉네임 프로필을 Firestore에서 불러와 localStorage에 반영한다.
 * @param {string} authUid
 */
export function useUserProfileSync(authUid) {
  const [profileRev, setProfileRev] = useState(0);
  const bumpProfileRev = useCallback(() => {
    setProfileRev((n) => n + 1);
  }, []);

  useEffect(() => {
    const uid = String(authUid ?? '').trim();
    if (!uid) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const cloudProfile = await loadUserProfileCloud(uid);
        if (cancelled || !cloudProfile) return;
        if (mergeUserProfileFromCloud(uid, cloudProfile)) {
          setProfileRev((n) => n + 1);
        }
      } catch {
        /* 네트워크·권한 오류 시 localStorage만 사용 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUid]);

  const uid = String(authUid ?? '').trim();
  const onboardingComplete = uid ? isOnboardingComplete(uid) : false;

  return { profileRev, bumpProfileRev, onboardingComplete };
}
