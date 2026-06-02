import ResultPageSummary from '../../components/ResultPageSummary.jsx';
import PrintedPageSetup from '../../components/PrintedPageSetup.jsx';
import { TOC_STATUS_LABELS } from '../lib/tocBodyCheck.js';
import { countTocBodyTabFindings } from '../utils/toc-body-result-entries.js';

/**
 * @param {{
 *   entries: import('../utils/toc-body-result-entries.js').TocBodyTabEntry[],
 *   currentPage: number,
 *   pdf: object | null,
 *   activeGroup: import('../lib/tocBodyCheck.js').TocBodyGroup | null,
 *   visibleOnCurrentPage: number,
 *   isGroupVisible: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => boolean,
 *   onToggleVisibility: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => void,
 *   isSameGroupAsSelected: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => boolean,
 *   onSelectGroup: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[]) => void,
 *   onBackToSetup?: () => void,
 *   printedPageOffset?: number | null,
 *   printedPagesActive?: boolean,
 *   onCalibrateFromInput?: (raw: string, isSpread: boolean) => void,
 *   onClearPrintedPageOffset?: () => void,
 *   currentPrintedLabel?: string,
 *   previewPrintedLabel?: string,
 *   spreadInput?: boolean,
 *   onSpreadInputChange?: (v: boolean) => void,
 *   firstPageSingle?: boolean,
 *   onFirstPageSingleChange?: (v: boolean) => void,
 *   formatPageLabel?: (systemPage: number) => string,
 * }} props
 */
export default function TocBodyResultsPanel({
  entries,
  currentPage,
  pdf,
  activeGroup,
  visibleOnCurrentPage,
  isGroupVisible,
  onToggleVisibility,
  isSameGroupAsSelected,
  onSelectGroup,
  onSelectPageInGroup,
  onBackToSetup,
  printedPageOffset,
  printedPagesActive,
  onCalibrateFromInput,
  onClearPrintedPageOffset,
  currentPrintedLabel,
  previewPrintedLabel,
  spreadInput,
  onSpreadInputChange,
  firstPageSingle,
  onFirstPageSingleChange,
  formatPageLabel,
}) {
  const pageLabel = formatPageLabel ?? ((p) => `${p}`);
  const itemCount = entries.filter((e) => e.kind === 'entry').length;
  const totalFindings = countTocBodyTabFindings(entries);

  return (
    <section className="results-panel results-panel--toc-body" aria-label="목차 · 본문 일치 확인 결과">
      {pdf && printedPagesActive && onCalibrateFromInput ? (
        <PrintedPageSetup
          printedPageOffset={printedPageOffset ?? null}
          currentPrintedLabel={currentPrintedLabel ?? ''}
          previewPrintedLabel={previewPrintedLabel ?? ''}
          spreadInput={spreadInput ?? false}
          onSpreadInputChange={onSpreadInputChange ?? (() => {})}
          firstPageSingle={firstPageSingle ?? false}
          onFirstPageSingleChange={onFirstPageSingleChange ?? (() => {})}
          onCalibrate={onCalibrateFromInput}
          onClear={onClearPrintedPageOffset ?? (() => {})}
        />
      ) : null}
      {pdf ? (
        <p
          className={`current-page-status ${
            visibleOnCurrentPage > 0 ? 'current-page-status--has-findings' : ''
          }`}
        >
          현재 <strong>{pageLabel(currentPage)}</strong>
          {visibleOnCurrentPage <= 0 ? (
            <>에는 목차 항목이 없습니다</>
          ) : (
            <>
              에 목차 항목{' '}
              <span className="current-page-status__criterion-hit-num">
                {visibleOnCurrentPage}
              </span>
              건
            </>
          )}
        </p>
      ) : null}
      {entries.length > 0 ? (
        <>
          <div className="results-header">
            <span className="results-header__applied">목차 항목 {itemCount}</span> 전체 발견{' '}
            <span className="results-category-summary__count-underline">
              {totalFindings}
            </span>
          </div>
          <ul className="results-list results-list--toc-body">
            {entries.map((entry) => {
              if (entry.kind === 'section') {
                return (
                  <li
                    key={`toc-section-${entry.label}`}
                    className="results-toc-section-heading"
                  >
                    <span className="results-toc-section-heading__label">
                      {entry.label}
                    </span>
                  </li>
                );
              }
              const { group } = entry;
              const first = group.instances[0];
              const count = group.instances.length;
              const tocStatus = group.tocStatus;
              const hasOnCurrentPage = group.instances.some(
                (i) => i.pageNum === currentPage,
              );
              const visible = isGroupVisible(group);
              const selected = isSameGroupAsSelected(group);

              return (
                <li key={`toc-body-${group.find}`}>
                  <div
                    className={`result-card result-card--toc result-card--toc-${tocStatus ?? 'missing'} ${
                      selected ? 'result-card--active' : ''
                    } ${hasOnCurrentPage ? 'result-card--on-page' : ''} ${
                      !visible ? 'result-card--hidden' : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectGroup(group)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectGroup(group);
                      }
                    }}
                  >
                    <div className="result-card-head">
                      <div className="result-card-head-main">
                        <span className="result-rule">
                          <span
                            className={`toc-status-badge toc-status-badge--${tocStatus ?? 'missing'}`}
                          >
                            {TOC_STATUS_LABELS[tocStatus] ?? tocStatus}
                          </span>{' '}
                          <span className="toc-result-title">{group.label}</span>
                        </span>
                        {tocStatus === 'mismatch' && first ? (
                          <span className="result-card-tip-inline">
                            본문: 「{first.matchedText}」
                          </span>
                        ) : null}
                      </div>
                      <div className="result-card-head-actions">
                        <label
                          className="result-visibility-toggle"
                          title="PDF에 표시"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={visible}
                            aria-label={`${group.label} PDF 표시`}
                            onChange={() => onToggleVisibility(group)}
                          />
                          <span className="result-visibility-label">표시</span>
                        </label>
                        <span className="result-count result-count--toc">
                          {tocStatus === 'missing' ? '본문 없음' : `${count}곳`}
                        </span>
                      </div>
                    </div>
                    {tocStatus === 'missing' ? (
                      <p className="toc-result-missing-hint">본문에서 찾지 못했습니다.</p>
                    ) : (
                      <ResultPageSummary
                        instances={group.instances}
                        currentPage={currentPage}
                        formatPageLabel={pageLabel}
                        onSelectPage={(pageNum) =>
                          onSelectPageInGroup(pageNum, group.instances)
                        }
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="hint results-empty-hint">목차 항목이 없습니다.</p>
      )}
      {onBackToSetup ? (
        <div className="results-panel-footer">
          <button type="button" className="btn-additional-check" onClick={onBackToSetup}>
            목차 다시 입력
          </button>
        </div>
      ) : null}
    </section>
  );
}
