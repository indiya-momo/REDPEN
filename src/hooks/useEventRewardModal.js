import { useCallback, useEffect, useState } from 'react';
import { consumePendingEventReward } from '../lib/eventRewardQueue.js';
import { earnBadge } from '../lib/userBadges.js';

/**
 * 대기열에 쌓인 이벤트 보상 팝업
 * @param {string | undefined} authUid
 * @param {number} [checkTick] — 피드백 복귀 등 직후 재조회
 */
export function useEventRewardModal(authUid, checkTick = 0) {
  const [reward, setReward] = useState(
    /** @type {import('../lib/eventRewardCatalog.js').EventRewardDefinition | null} */ (
      null
    ),
  );

  useEffect(() => {
    const uid = authUid?.trim();
    if (!uid) return;
    const pending = consumePendingEventReward(uid);
    if (!pending) return;
    if (pending.badgeId) {
      earnBadge(uid, pending.badgeId);
    }
    setReward(pending);
  }, [authUid, checkTick]);

  const close = useCallback(() => setReward(null), []);

  return {
    open: reward != null,
    reward,
    close,
  };
}
