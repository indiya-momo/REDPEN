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
 * }} props
 */
export default function UnifyCandidateFindCompleteContent({
  clusterCount,
  totalOccurrences,
  quotaConsumedLine = null,
}) {
  return (
    <div className="results-header app-dialog__results-summary app-dialog__unify-find-complete">
      <div className="app-dialog__results-summary-row app-dialog__results-summary-row--total">
        <span className="results-header__stat app-dialog__results-stat">
          <AppDialogCriteriaLabel
            label="표기 통일 추천하기"
            meta={`${clusterCount}항목 전체`}
          />
          <ResultFindingsCountCircle
            count={totalOccurrences}
            className="results-header__total-count"
            ariaLabel={`전체 ${totalOccurrences}회`}
          />
          <span className="app-dialog__findings-unit">회</span>
        </span>
      </div>
      <AppDialogQuotaConsumedLine line={quotaConsumedLine} />
    </div>
  );
}
