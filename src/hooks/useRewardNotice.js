import { useCallback, useEffect, useState } from 'react';
import {
  clearRewardNotice,
  hasRewardNotice,
} from '../lib/rewardNotice.js';

/**
 * @param {string} uid
 * @param {number} [refreshTick]
 */
export function useRewardNotice(uid, refreshTick = 0) {
  const [visible, setVisible] = useState(() => hasRewardNotice(uid));

  const refresh = useCallback(() => {
    setVisible(hasRewardNotice(uid));
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [uid, refreshTick, refresh]);

  const dismiss = useCallback(() => {
    clearRewardNotice(uid);
    setVisible(false);
  }, [uid]);

  return { visible, refresh, dismiss };
}
