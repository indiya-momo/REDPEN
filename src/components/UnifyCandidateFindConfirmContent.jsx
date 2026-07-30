/**
 * 표기 통일 추천하기 찾기 직전 confirm 본문
 */

import { formatConsistencyCheckQuotaAvailabilityLine } from '../lib/betaDailyQuota.js';

/**
 * @param {{
 *   remaining: number,
 *   dailyRemaining: number,
 *   bonusRemaining: number,
 * }} props
 */
export default function UnifyCandidateFindConfirmContent({
  remaining,
  dailyRemaining,
  bonusRemaining,
}) {
  return (
    <div className="app-dialog__unify-find-confirm">
      <p className="app-dialog__confirm-line">
        {formatConsistencyCheckQuotaAvailabilityLine(
          remaining,
          dailyRemaining,
          bonusRemaining,
        )}
      </p>
      <p className="app-dialog__confirm-line">
        <span className="app-dialog__quota-ticket-kind">표기 통일 검수권</span>
        {' '}
        1장을 사용합니다
      </p>
      <p className="app-dialog__confirm-line app-dialog__confirm-line--question">
        찾기를 진행할까요?
      </p>
    </div>
  );
}
