import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';

/**
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   formatPageLabel?: (systemPage: number) => string,
 *   onSelectPage: (pageNum: number) => void,
 * }} props
 */
export default function ResultPageSummary({
  instances,
  currentPage,
  formatPageLabel = formatSystemPageLabel,
  onSelectPage,
}) {
  const byPage = new Map();
  for (const inst of instances) {
    byPage.set(inst.pageNum, (byPage.get(inst.pageNum) ?? 0) + 1);
  }
  const pages = [...byPage.entries()].sort((a, b) => a[0] - b[0]);

  if (!pages.length) return null;

  return (
    <div className="result-pages" role="list">
      {pages.map(([pageNum, count]) => (
        <button
          key={pageNum}
          type="button"
          role="listitem"
          className={`page-chip ${pageNum === currentPage ? 'page-chip--current' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPage(pageNum);
          }}
        >
          {formatPageLabel(pageNum)}
          {count > 1 ? ` (${count})` : ''}
        </button>
      ))}
    </div>
  );
}
