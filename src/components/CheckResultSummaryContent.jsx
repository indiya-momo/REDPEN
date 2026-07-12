/**
 * 검수 완료 팝업·결과 헤더와 동일한 뱃지·기준수·원형 발견수 UI
 */

import { resultPillarToneClass } from '../lib/resultPillarTone.js';
import { formatResultsStatCount } from '../lib/checkResultSummaryFormat.js';

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
 *   tone?: import('../lib/resultPillarTone.js').ResultBadgeTone,
 * }} props
 */
function ResultHeaderStat({ badge, count, findingsCount, tone }) {
  const toneClass = tone ? resultPillarToneClass(tone) : '';
  return (
    <span className="results-header__stat">
      <span className={`results-header-badge ${toneClass}`.trim()}>{badge}</span>
      <span className="results-header__stat-count" aria-label={formatResultsStatCount(count)}>
        <span className="results-header__stat-num">{count}</span>
        <span className="results-header__stat-unit">기준</span>
      </span>
      <ResultFindingsCountCircle
        count={findingsCount}
        className="results-header__stat-circle"
        ariaLabel={`${findingsCount}건`}
      />
    </span>
  );
}

/**
 * @param {Array<{
 *   badge: string,
 *   count: number,
 *   findingsCount: number,
 *   tone?: import('../lib/resultPillarTone.js').ResultBadgeTone,
 * }>} stats
 * @param {number} totalFindings
 */
function buildSummaryCells(stats, totalFindings) {
  /** @type {import('react').ReactNode[]} */
  const cells = stats.map(({ badge, count, findingsCount, tone }) => (
    <ResultHeaderStat
      key={badge}
      badge={badge}
      count={count}
      findingsCount={findingsCount}
      tone={tone}
    />
  ));
  cells.push(
    <span
      key="__total__"
      className="results-header__stat results-header__stat--total"
    >
      <span className="results-header-badge results-header-badge--total">
        전체 발견
      </span>
      <ResultFindingsCountCircle
        count={totalFindings}
        className="results-header__total-count"
        ariaLabel={`전체 ${totalFindings}건`}
      />
    </span>,
  );
  return cells;
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
  const rows = chunkRows(buildSummaryCells(stats, totalFindings), 2);

  return (
    <div className="results-header app-dialog__results-summary">
      {rows.map((row, rowIndex) => (
        <div
          key={`summary-row-${rowIndex}`}
          className="app-dialog__results-summary-row"
        >
          {row}
        </div>
      ))}
    </div>
  );
}
