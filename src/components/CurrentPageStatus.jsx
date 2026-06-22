import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';

/**
 * @param {{ visibleOnCurrentPage: number }} props
 */
export function CurrentPageFindingText({ visibleOnCurrentPage }) {
  return (
    <>
      {' '}의 발견 기준{' '}
      <span className="results-category-summary__count-underline">
        [{visibleOnCurrentPage}]
      </span>
    </>
  );
}

/**
 * @param {{
 *   currentPage: number,
 *   visibleOnCurrentPage: number,
 *   formatPageLabel?: (systemPage: number) => string,
 *   tone?: 'builtin' | 'caution' | 'consistency',
 *   mode?: 'criteria' | 'toc',
 *   printedPagesActive?: boolean,
 *   className?: string,
 * }} props
 */
export default function CurrentPageStatus({
  currentPage,
  visibleOnCurrentPage,
  formatPageLabel = formatSystemPageLabel,
  tone = 'builtin',
  mode = 'criteria',
  printedPagesActive = false,
  className = '',
}) {
  const pageLabel = formatPageLabel(currentPage);
  const hasFindings = visibleOnCurrentPage > 0;

  return (
    <p
      className={[
        'current-page-status',
        hasFindings ? 'current-page-status--has-findings' : '',
        `current-page-status--tone-${tone}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      현재 <strong className="manuscript-page-label">{pageLabel}</strong>
      {printedPagesActive ? (
        <span className="current-page-status__system">
          {' '}
          (파일 {formatSystemPageLabel(currentPage)})
        </span>
      ) : null}
      {mode === 'toc' ? (
        visibleOnCurrentPage <= 0 ? (
          <>에는 목차 항목이 없습니다</>
        ) : (
          <>
            에 목차 항목{' '}
            <span className="current-page-status__criterion-hit-num">
              {visibleOnCurrentPage}
            </span>
            건
          </>
        )
      ) : (
        <CurrentPageFindingText visibleOnCurrentPage={visibleOnCurrentPage} />
      )}
    </p>
  );
}
