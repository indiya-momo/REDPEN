import { useCallback, useEffect, useState } from 'react';
import {
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnforcedForUser,
} from '../lib/betaDailyQuota.js';

/**
 * 오픈베타 검수 한도 — 첫 1회 무료, 이후 1일 1회 (로그인 uid)
 * @param {string} uid
 * @param {string} [email]
 */
export function useBetaDailyQuota(uid, email = '') {
  const [loading, setLoading] = useState(true);
  const [consumedToday, setConsumedToday] = useState(false);
  const [hasWelcomeRemaining, setHasWelcomeRemaining] = useState(false);
  const [dayId, setDayId] = useState('');

  const refresh = useCallback(async () => {
    if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
      setLoading(false);
      setConsumedToday(false);
      setHasWelcomeRemaining(false);
      setDayId('');
      return;
    }
    setLoading(true);
    const status = await getBetaDailyQuotaStatus(uid, email);
    setConsumedToday(status.consumedToday);
    setHasWelcomeRemaining(status.hasWelcomeRemaining);
    setDayId(status.dayId);
    setLoading(false);
  }, [uid, email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enforced = isBetaDailyQuotaEnforcedForUser(uid, email);
  const canRunCheck =
    !enforced ||
    (!loading && (hasWelcomeRemaining || !consumedToday));

  return {
    loading,
    enforced,
    canRunCheck,
    refresh,
  };
}
