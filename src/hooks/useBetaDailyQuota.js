import { useCallback, useEffect, useState } from 'react';
import { syncBoostApprovedBadge } from '../lib/badgeGrants.js';
import {
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnforcedForUser,
  isLocalDevQuotaRelaxed,
} from '../lib/betaDailyQuota.js';

/**
 * 오픈베타 검수 한도 — 탭별 1회 / 피드백 2회 / 우수 선정 3회
 * @param {string} uid
 * @param {string} [email]
 */
export function useBetaDailyQuota(uid, email = '') {
  const [loading, setLoading] = useState(true);
  const [spellingConsumed, setSpellingConsumed] = useState(false);
  const [consistencyConsumed, setConsistencyConsumed] = useState(false);
  const [spellingCount, setSpellingCount] = useState(0);
  const [consistencyCount, setConsistencyCount] = useState(0);
  const [tabLimit, setTabLimit] = useState(1);
  const [hasFeedbackBonusToday, setHasFeedbackBonusToday] = useState(false);
  const [hasBoostApprovedToday, setHasBoostApprovedToday] = useState(false);
  const [dayId, setDayId] = useState('');

  const refresh = useCallback(async () => {
    const enforced = isBetaDailyQuotaEnforcedForUser(uid, email);
    if (!enforced && !(isLocalDevQuotaRelaxed() && uid.trim())) {
      setLoading(false);
      setSpellingConsumed(false);
      setConsistencyConsumed(false);
      setSpellingCount(0);
      setConsistencyCount(0);
      setTabLimit(1);
      setHasFeedbackBonusToday(false);
      setHasBoostApprovedToday(false);
      setDayId('');
      return;
    }
    setLoading(true);
    const status = await getBetaDailyQuotaStatus(uid, email);
    setSpellingConsumed(status.spellingConsumed);
    setConsistencyConsumed(status.consistencyConsumed);
    setSpellingCount(status.spellingCount);
    setConsistencyCount(status.consistencyCount);
    setTabLimit(status.tabLimit);
    setHasFeedbackBonusToday(status.hasFeedbackBonusToday);
    setHasBoostApprovedToday(status.hasBoostApprovedToday);
    setDayId(status.dayId);
    setLoading(false);
    if (status.hasBoostApprovedToday) {
      syncBoostApprovedBadge(uid);
    }
  }, [uid, email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enforced = isBetaDailyQuotaEnforcedForUser(uid, email);
  const canRunSpellingCheck = !enforced || (!loading && !spellingConsumed);
  const canRunConsistencyCheck =
    !enforced || (!loading && !consistencyConsumed);

  const spellingRemaining = Math.max(0, tabLimit - spellingCount);
  const consistencyRemaining = Math.max(0, tabLimit - consistencyCount);

  return {
    loading,
    enforced,
    canRunSpellingCheck,
    canRunConsistencyCheck,
    spellingConsumed,
    consistencyConsumed,
    spellingCount,
    consistencyCount,
    spellingRemaining,
    consistencyRemaining,
    tabLimit,
    hasFeedbackBonusToday,
    hasBoostApprovedToday,
    dayId,
    refresh,
  };
}
