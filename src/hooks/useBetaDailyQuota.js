/**
 * MainScreen용 한도 UI 상태: 로딩·소비 여부·탭별 count·보너스 플래그.
 * getBetaDailyQuotaStatus 주기적/수동 refresh (onBetaQuotaConsumed).
 * 검수 버튼 비활성·안내 문구의 데이터 소스.
 */
import { useCallback, useEffect, useState } from 'react';
import { syncBoostApprovedBadge } from '../lib/badgeGrants.js';
import {
  BETA_UNIFY_LIMIT_DEFAULT,
  BETA_TAB_LIMIT_DEFAULT,
  getBetaDailyQuotaStatus,
  isBetaDailyQuotaEnforcedForUser,
  isLocalDevQuotaRelaxed,
} from '../lib/betaDailyQuota.js';

/** @param {string} uid @param {string} [email] @param {unknown} [plan] */
export function useBetaDailyQuota(uid, email = '', plan) {
  const [loading, setLoading] = useState(true);
  const [spellingConsumed, setSpellingConsumed] = useState(false);
  const [consistencyConsumed, setConsistencyConsumed] = useState(false);
  const [unifyConsumed, setUnifyConsumed] = useState(false);
  const [spellingCount, setSpellingCount] = useState(0);
  const [consistencyCount, setConsistencyCount] = useState(0);
  const [unifyCount, setUnifyCount] = useState(0);
  const [spellingTabLimit, setSpellingTabLimit] = useState(
    BETA_TAB_LIMIT_DEFAULT,
  );
  const [consistencyTabLimit, setConsistencyTabLimit] = useState(
    BETA_TAB_LIMIT_DEFAULT,
  );
  const [unifyTabLimit, setUnifyTabLimit] = useState(BETA_UNIFY_LIMIT_DEFAULT);
  const [hasFeedbackBonusToday, setHasFeedbackBonusToday] = useState(false);
  const [hasBoostApprovedToday, setHasBoostApprovedToday] = useState(false);
  const [dayId, setDayId] = useState('');

  const refresh = useCallback(async () => {
    const enforced = isBetaDailyQuotaEnforcedForUser(uid, email, plan);
    if (!enforced && !(isLocalDevQuotaRelaxed() && uid.trim())) {
      setLoading(false);
      setSpellingConsumed(false);
      setConsistencyConsumed(false);
      setUnifyConsumed(false);
      setSpellingCount(0);
      setConsistencyCount(0);
      setUnifyCount(0);
      setSpellingTabLimit(BETA_TAB_LIMIT_DEFAULT);
      setConsistencyTabLimit(BETA_TAB_LIMIT_DEFAULT);
      setUnifyTabLimit(BETA_UNIFY_LIMIT_DEFAULT);
      setHasFeedbackBonusToday(false);
      setHasBoostApprovedToday(false);
      setDayId('');
      return;
    }
    setLoading(true);
    const status = await getBetaDailyQuotaStatus(uid, email);
    setSpellingConsumed(status.spellingConsumed);
    setConsistencyConsumed(status.consistencyConsumed);
    setUnifyConsumed(status.unifyConsumed);
    setSpellingCount(status.spellingCount);
    setConsistencyCount(status.consistencyCount);
    setUnifyCount(status.unifyCount);
    setSpellingTabLimit(
      status.spellingTabLimit ?? status.tabLimit ?? BETA_TAB_LIMIT_DEFAULT,
    );
    setConsistencyTabLimit(
      status.consistencyTabLimit ?? BETA_TAB_LIMIT_DEFAULT,
    );
    setUnifyTabLimit(status.unifyTabLimit ?? BETA_UNIFY_LIMIT_DEFAULT);
    setHasFeedbackBonusToday(status.hasFeedbackBonusToday);
    setHasBoostApprovedToday(status.hasBoostApprovedToday);
    setDayId(status.dayId);
    setLoading(false);
    if (status.hasBoostApprovedToday) {
      syncBoostApprovedBadge(uid);
    }
  }, [uid, email, plan]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enforced = isBetaDailyQuotaEnforcedForUser(uid, email, plan);
  const canRunSpellingCheck = !enforced || (!loading && !spellingConsumed);
  const canRunConsistencyCheck =
    !enforced || (!loading && !consistencyConsumed);
  const canRunUnifyCheck = !enforced || (!loading && !unifyConsumed);

  const spellingRemaining = Math.max(0, spellingTabLimit - spellingCount);
  const consistencyRemaining = Math.max(
    0,
    consistencyTabLimit - consistencyCount,
  );
  const unifyRemaining = Math.max(0, unifyTabLimit - unifyCount);

  return {
    loading,
    enforced,
    canRunSpellingCheck,
    canRunConsistencyCheck,
    canRunUnifyCheck,
    spellingConsumed,
    consistencyConsumed,
    unifyConsumed,
    spellingCount,
    consistencyCount,
    unifyCount,
    spellingRemaining,
    consistencyRemaining,
    unifyRemaining,
    spellingTabLimit,
    consistencyTabLimit,
    unifyTabLimit,
    /** @deprecated 맞춤법 한도와 동일 */
    tabLimit: spellingTabLimit,
    hasFeedbackBonusToday,
    hasBoostApprovedToday,
    dayId,
    refresh,
  };
}
