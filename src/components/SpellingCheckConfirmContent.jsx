/**
 * 맞춤법 검수 직전 confirm — 기준 라벨(음영 없음) + (n/n) meta
 */

import { Fragment } from 'react';
import { LOANWORD_FEATURE_LABEL } from '../lib/loanwordCheckRules.js';
import { formatSpellingCheckQuotaAvailabilityLine } from '../lib/betaDailyQuota.js';
import { AppDialogCriteriaLabel } from './AppDialogCriteriaLabel.jsx';

/**
 * @param {{
 *   remaining?: number,
 *   dailyRemaining?: number,
 *   bonusRemaining?: number,
 *   cautionActive: number,
 *   cautionTotal: number,
 *   builtinActive: number,
 *   builtinTotal: number,
 *   loanwordActive?: number,
 *   loanwordTotal?: number,
 *   showQuota?: boolean,
 * }} props
 */
export default function SpellingCheckConfirmContent({
  remaining = 0,
  dailyRemaining = 0,
  bonusRemaining = 0,
  cautionActive,
  cautionTotal,
  builtinActive,
  builtinTotal,
  loanwordActive = 0,
  loanwordTotal = 0,
  showQuota = true,
}) {
  /** @type {{ key: string, label: string, meta: string }[]} */
  const criteria = [
    {
      key: 'caution',
      label: '편집자 검토 필요',
      meta: `(${cautionActive}/${cautionTotal})`,
    },
    {
      key: 'builtin',
      label: '맞춤법 규칙',
      meta: `(${builtinTotal}/${builtinActive})`,
    },
  ];
  if (loanwordTotal > 0) {
    criteria.push({
      key: 'loanword',
      label: LOANWORD_FEATURE_LABEL,
      meta: `(${loanwordActive}/${loanwordTotal})`,
    });
  }

  return (
    <>
      {showQuota ? (
        <p className="app-dialog__confirm-line">
          {formatSpellingCheckQuotaAvailabilityLine(
            remaining,
            dailyRemaining,
            bonusRemaining,
          )}
        </p>
      ) : null}
      <p className="app-dialog__confirm-line app-dialog__confirm-line--criteria">
        {criteria.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? ', ' : null}
            <AppDialogCriteriaLabel label={item.label} meta={item.meta} />
          </Fragment>
        ))}
      </p>
      <p className="app-dialog__confirm-line app-dialog__confirm-line--question">
        검수를 진행할까요?
      </p>
    </>
  );
}
