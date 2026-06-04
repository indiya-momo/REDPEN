import { useCallback, useEffect, useState } from 'react';
import {
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnabled,
} from '../lib/betaDailyQuota.js';

/**
 * 오픈베타 검수 한도 — 첫 1회 무료, 이후 1일 1회 (로그인 uid)
 * @param {string} uid
 */
export function useBetaDailyQuota(uid) {
  const [loading, setLoading] = useState(true);
  const [consumedToday, setConsumedToday] = useState(false);
  const [hasWelcomeRemaining, setHasWelcomeRemaining] = useState(false);
  const [dayId, setDayId] = useState('');

  const refresh = useCallback(async () => {
    if (!isBetaDailyQuotaEnabled() || !uid.trim()) {
      setLoading(false);
      setConsumedToday(false);
      setHasWelcomeRemaining(false);
      setDayId('');
      return;
    }
    setLoading(true);
    const status = await getBetaDailyQuotaStatus(uid);
    setConsumedToday(status.consumedToday);
    setHasWelcomeRemaining(status.hasWelcomeRemaining);
    setDayId(status.dayId);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enforced = isBetaDailyQuotaEnabled() && Boolean(uid.trim());
  const canRunCheck =
    !enforced ||
    (!loading && (hasWelcomeRemaining || !consumedToday));

  return {
    loading,
    enforced,
    consumedToday,
    hasWelcomeRemaining,
    dayId,
    canRunCheck,
    refresh,
  };
}
