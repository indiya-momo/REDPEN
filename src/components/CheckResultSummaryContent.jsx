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
  if (stats.length === 0) {
    return (
      <div className="results-header app-dialog__results-summary">
        <span className="results-header__total-findings">
          전체 발견{' '}
          <ResultFindingsCountCircle
            count={totalFindings}
            className="results-header__total-count"
          />
        </span>
      </div>
    );
  }

  return (
    <div className="results-header app-dialog__results-summary">
      <div className="results-header__stats">
        {stats.map(({ badge, count, findingsCount, tone }) => (
          <ResultHeaderStat
            key={badge}
            badge={badge}
            count={count}
            findingsCount={findingsCount}
            tone={tone}
          />
        ))}
      </div>
      <span className="results-header__total-findings">
        전체 발견{' '}
        <ResultFindingsCountCircle
          count={totalFindings}
          className="results-header__total-count"
        />
      </span>
    </div>
  );
}
