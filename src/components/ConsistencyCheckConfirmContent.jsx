/**
 * 표기 통일 검수 직전 confirm — 기준 라벨(음영 없음) + 괄호 meta
 */

import { Fragment } from 'react';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from '../lib/consistencyRuleLimit.js';
import { AUXILIARY_VERB_FEATURE_LABEL } from '../lib/bonBojoRules.js';
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';
import { formatCategoryFindingCount } from '../lib/checkResultSummaryFormat.js';
import {
  formatConsistencyCheckQuotaAvailabilityLine,
} from '../lib/betaDailyQuota.js';
import { AppDialogCriteriaLabel } from './AppDialogCriteriaLabel.jsx';

/**
 * @param {number} active
 */
function itemMeta(active) {
  return active > 0 ? `(${active}항목)` : '(없음)';
}

/**
 * @param {number} active
 */
function findingMeta(active) {
  return active > 0 ? formatCategoryFindingCount(active) : '(없음)';
}

/**
 * @param {number} unifyActive
 * @param {string | null | undefined} pinnedTailWord
 */
function unifyMeta(unifyActive, pinnedTailWord) {
  if (unifyActive <= 0) return '(없음)';
  const pinned =
    typeof pinnedTailWord === 'string' ? pinnedTailWord.trim() : '';
  if (!pinned) return itemMeta(unifyActive);
  return `(${unifyActive}항목, 통일형: ${formatConsistencyListLabel(pinned)}📌)`;
}

/**
 * @param {{
 *   remaining?: number,
 *   dailyRemaining?: number,
 *   bonusRemaining?: number,
 *   literalActive: number,
 *   unifyActive?: number,
 *   pinnedTailWord?: string | null,
 *   commonStringActive: number,
 *   excludeActive: number,
 *   auxiliaryActive: number,
 *   auxiliaryTotal: number,
 *   showQuota?: boolean,
 * }} props
 */
export default function ConsistencyCheckConfirmContent({
  remaining = 0,
  dailyRemaining = 0,
  bonusRemaining = 0,
  literalActive,
  unifyActive = 0,
  pinnedTailWord = null,
  commonStringActive,
  excludeActive,
  auxiliaryActive,
  auxiliaryTotal,
  showQuota = true,
}) {
  const rowUnifyLiteral = [
    {
      key: 'unify',
      label: UNIFY_FEATURE_LABEL,
      meta: unifyMeta(unifyActive, pinnedTailWord),
    },
    {
      key: 'literal',
      label: LITERAL_FIND_FEATURE_LABEL,
      meta: itemMeta(literalActive),
    },
  ];
  const rowCommonExclude = [
    {
      key: 'common',
      label: '공통 항목 찾기',
      meta: findingMeta(commonStringActive),
    },
    {
      key: 'exclude',
      label: '검수 제외 항목',
      meta: findingMeta(excludeActive),
    },
  ];
  const rowAuxiliary = {
    key: 'auxiliary',
    label: AUXILIARY_VERB_FEATURE_LABEL,
    meta:
      auxiliaryTotal > 0
        ? `(${auxiliaryActive}/${auxiliaryTotal})`
        : '(없음)',
  };

  /**
   * @param {{ key: string, label: string, meta: string }[]} items
   */
  function renderCriteriaRow(items) {
    return (
      <p className="app-dialog__confirm-line app-dialog__confirm-line--criteria">
        {items.map((item, index) => (
          <Fragment key={item.key}>
            {index > 0 ? ', ' : null}
            <AppDialogCriteriaLabel label={item.label} meta={item.meta} />
          </Fragment>
        ))}
      </p>
    );
  }

  return (
    <>
      {showQuota ? (
        <p className="app-dialog__confirm-line">
          {formatConsistencyCheckQuotaAvailabilityLine(
            remaining,
            dailyRemaining,
            bonusRemaining,
          )}
        </p>
      ) : null}
      {renderCriteriaRow(rowUnifyLiteral)}
      {renderCriteriaRow(rowCommonExclude)}
      <p className="app-dialog__confirm-line app-dialog__confirm-line--criteria">
        <AppDialogCriteriaLabel
          label={rowAuxiliary.label}
          meta={rowAuxiliary.meta}
        />
      </p>
      <p className="app-dialog__confirm-line app-dialog__confirm-line--question">
        검수를 진행할까요?
      </p>
    </>
  );
}
