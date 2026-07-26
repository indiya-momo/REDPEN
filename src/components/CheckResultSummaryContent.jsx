/**
 * 검수 완료 팝업 — 검수 전 confirm과 동일한 라벨·meta CSS + 발견 수
 * 레이아웃: 전체 발견 한 줄 → 아래 줄에 카테고리 항목
 */

import { AppDialogCriteriaLabel } from './AppDialogCriteriaLabel.jsx';
import { formatCategoryFindingCount } from '../lib/checkResultSummaryFormat.js';

/**
 * @param {{ count: number, className?: string, ariaLabel?: string }} props
 */
export function ResultFindingsCountCircle({
  count,
  className = '',
  ariaLabel,
}) {
  return (
    <span
      className={`result-findings-count-circle ${className}`.trim()}
      aria-label={ariaLabel ?? `${count}건`}
    >
      {count}
    </span>
  );
}

/**
 * @param {{
 *   badge: string,
 *   count: number,
 *   findingsCount: number,
 * }} props
 */
function ResultHeaderStat({ badge, count, findingsCount }) {
  return (
    <span className="results-header__stat app-dialog__results-stat">
      <AppDialogCriteriaLabel
        label={badge}
        meta={formatCategoryFindingCount(count)}
      />
      <ResultFindingsCountCircle
        count={findingsCount}
        className="results-header__stat-circle"
        ariaLabel={`${findingsCount}건`}
      />
    </span>
  );
}

/**
 * @param {import('react').ReactNode[]} cells
 * @param {number} [perRow]
 */
function chunkRows(cells, perRow = 2) {
  /** @type {import('react').ReactNode[][]} */
  const rows = [];
  for (let i = 0; i < cells.length; i += perRow) {
    rows.push(cells.slice(i, i + perRow));
  }
  return rows;
}

/**
 * @param {{
 *   stats: Array<{
 *     badge: string,
 *     count: number,
 *     findingsCount: number,
 *     tone?: import('../lib/resultPillarTone.js').ResultBadgeTone,
 *   }>,
 *   totalFindings: number,
 * }} props
 */
export default function CheckResultSummaryContent({ stats, totalFindings }) {
  const totalRow = (
    <span
      key="__total__"
      className="results-header__stat results-header__stat--total app-dialog__results-stat"
    >
      <AppDialogCriteriaLabel label="전체 발견" />
      <ResultFindingsCountCircle
        count={totalFindings}
        className="results-header__total-count"
        ariaLabel={`전체 ${totalFindings}건`}
      />
    </span>
  );

  const categoryCells = stats.map(({ badge, count, findingsCount }) => (
    <ResultHeaderStat
      key={badge}
      badge={badge}
      count={count}
      findingsCount={findingsCount}
    />
  ));
  const categoryRows = chunkRows(categoryCells, 3);

  return (
    <div className="results-header app-dialog__results-summary">
      <div className="app-dialog__results-summary-row app-dialog__results-summary-row--total">
        {totalRow}
      </div>
      {categoryRows.map((row, rowIndex) => (
        <div
          key={`summary-row-${rowIndex}`}
          className="app-dialog__results-summary-row app-dialog__results-summary-row--categories"
        >
          {row}
        </div>
      ))}
    </div>
  );
}
