/**
 * 표기 통일 추천하기 찾기 완료 팝업 본문
 */

import { AppDialogCriteriaLabel } from './AppDialogCriteriaLabel.jsx';
import { ResultFindingsCountCircle } from './CheckResultSummaryContent.jsx';
import AppDialogQuotaConsumedLine from './AppDialogQuotaConsumedLine.jsx';

/**
 * @param {{
 *   clusterCount: number,
 *   totalOccurrences: number,
 *   quotaConsumedLine?: string | null,
 *   phaseLabel?: string,
 * }} props
 */
export default function UnifyCandidateFindCompleteContent({
  clusterCount,
  totalOccurrences,
  quotaConsumedLine = null,
  phaseLabel = '1차 표기 통일(띄어쓰기) :',
}) {
  return (
    <div className="results-header app-dialog__results-summary app-dialog__unify-find-complete">
      <div className="app-dialog__results-summary-row app-dialog__results-summary-row--total">
        <span className="results-header__stat app-dialog__results-stat app-dialog__unify-find-complete-stat">
          <AppDialogCriteriaLabel
            label={phaseLabel}
            meta={`추천 단어 세트 ${clusterCount} 전체 발견`}
          />
          <ResultFindingsCountCircle
            count={totalOccurrences}
            className="results-header__total-count"
            ariaLabel={`전체 발견 ${totalOccurrences}`}
          />
        </span>
      </div>
      <AppDialogQuotaConsumedLine line={quotaConsumedLine} />
    </div>
  );
}
