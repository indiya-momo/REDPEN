/**
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   onSelectPage: (pageNum: number) => void,
 * }} props
 */
export default function ResultPageSummary({
  instances,
  currentPage,
  onSelectPage,
}) {
  const byPage = new Map();
  for (const inst of instances) {
    byPage.set(inst.pageNum, (byPage.get(inst.pageNum) ?? 0) + 1);
  }
  const pages = [...byPage.entries()].sort((a, b) => a[0] - b[0]);

  if (!pages.length) return null;

  return (
    <span className="result-pages">
      {pages.map(([pageNum, count]) => (
        <button
          key={pageNum}
          type="button"
          className={`page-chip ${pageNum === currentPage ? 'page-chip--current' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPage(pageNum);
          }}
        >
          p.{pageNum}
          {count > 1 ? ` (${count})` : ''}
        </button>
      ))}
    </span>
  );
}
