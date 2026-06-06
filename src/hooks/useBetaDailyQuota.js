import { useCallback, useEffect, useState } from 'react';
import {
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnforcedForUser,
} from '../lib/betaDailyQuota.js';

/**
 * 오픈베타 검수 한도 — 맞춤법·일관성 탭별 하루 2회 (피드백 시 각 3회)
 * @param {string} uid
 * @param {string} [email]
 */
export function useBetaDailyQuota(uid, email = '') {
  const [loading, setLoading] = useState(true);
  const [spellingConsumed, setSpellingConsumed] = useState(false);
  const [consistencyConsumed, setConsistencyConsumed] = useState(false);
  const [dayId, setDayId] = useState('');

  const refresh = useCallback(async () => {
    if (!isBetaDailyQuotaEnforcedForUser(uid, email)) {
      setLoading(false);
      setSpellingConsumed(false);
      setConsistencyConsumed(false);
      setDayId('');
      return;
    }
    setLoading(true);
    const status = await getBetaDailyQuotaStatus(uid, email);
    setSpellingConsumed(status.spellingConsumed);
    setConsistencyConsumed(status.consistencyConsumed);
    setDayId(status.dayId);
    setLoading(false);
  }, [uid, email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enforced = isBetaDailyQuotaEnforcedForUser(uid, email);
  const canRunSpellingCheck = !enforced || (!loading && !spellingConsumed);
  const canRunConsistencyCheck =
    !enforced || (!loading && !consistencyConsumed);

  return {
    loading,
    enforced,
    canRunSpellingCheck,
    canRunConsistencyCheck,
    spellingConsumed,
    consistencyConsumed,
    dayId,
    refresh,
  };
}
