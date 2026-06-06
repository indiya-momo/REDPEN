import { useCallback, useEffect, useState } from 'react';
import { consumePendingEventReward } from '../lib/eventRewardQueue.js';
import { earnBadge } from '../lib/userBadges.js';

/**
 * 대기열에 쌓인 이벤트 보상 팝업 — 이미지·트리거 연결 전 골격
 * @param {string | undefined} authUid
 */
export function useEventRewardModal(authUid) {
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
  }, [authUid]);

  const close = useCallback(() => setReward(null), []);

  return {
    open: reward != null,
    reward,
    close,
  };
}
