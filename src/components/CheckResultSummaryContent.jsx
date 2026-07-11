/**
 * 검수 완료 팝업·결과 헤더와 동일한 뱃지·건수·원형 총건 UI
 */

import { resultPillarToneClass } from '../lib/resultPillarTone.js';

/**
 * @param {{ count: number, className?: string }} props
 */
export function ResultFindingsCountCircle({ count, className = '' }) {
  return (
    <span
      className={`result-findings-count-circle ${className}`.trim()}
      aria-label={`${count}건`}
    >
      {count}
    </span>
  );
}

/**
 * @param {{
 *   badge: string,
 *   count: number,
 *   tone?: import('../lib/resultPillarTone.js').ResultBadgeTone,
 * }} props
 */
function ResultHeaderStat({ badge, count, tone }) {
  const toneClass = tone ? resultPillarToneClass(tone) : '';
  return (
    <span className="results-header__stat">
      <span className={`results-header-badge ${toneClass}`.trim()}>{badge}</span>
      <span className="results-header__stat-count">{count}건</span>
    </span>
  );
}

/**
 * @param {{
 *   stats: Array<{
 *     badge: string,
 *     count: number,
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
        {stats.map(({ badge, count, tone }) => (
          <ResultHeaderStat key={badge} badge={badge} count={count} tone={tone} />
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
