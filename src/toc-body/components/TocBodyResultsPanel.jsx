import ResultPageSummary from '../../components/ResultPageSummary.jsx';
import GroupVisibilityCheckbox from '../../components/GroupVisibilityCheckbox.jsx';
import PrintedPageSetup from '../../components/PrintedPageSetup.jsx';
import { TOC_STATUS_LABELS } from '../lib/tocBodyCheck.js';
import { countTocBodyTabFindings } from '../utils/toc-body-result-entries.js';

/**
 * @param {{
 *   entries: import('../utils/toc-body-result-entries.js').TocBodyTabEntry[],
 *   currentPage: number,
 *   pdf: object | null,
 *   visibleOnCurrentPage: number,
 *   isGroupVisible: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => boolean,
 *   groupVisibilityMode?: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount?: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => number,
 *   isInstanceVisible?: (group: import('../lib/tocBodyCheck.js').TocBodyGroup, inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleVisibility: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => void,
 *   onToggleInstanceVisibility?: (group: import('../lib/tocBodyCheck.js').TocBodyGroup, inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   isSameGroupAsSelected: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => boolean,
 *   onSelectGroup: (group: import('../lib/tocBodyCheck.js').TocBodyGroup) => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[]) => void,
 *   onBackToSetup?: () => void,
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
  visibleOnCurrentPage,
  isGroupVisible,
  groupVisibilityMode,
  visibleInstanceCount,
  isInstanceVisible,
  onToggleVisibility,
  onToggleInstanceVisibility,
  onSelectInstance,
  isSameGroupAsSelected,
  onSelectGroup,
  onSelectPageInGroup,
  onBackToSetup,
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
  const itemCount = entries.filter(
    (e) => e.kind === 'entry' && e.group.tocStatus !== 'outline-extra',
  ).length;
  const totalFindings = countTocBodyTabFindings(entries);

  return (
    <section className="results-panel results-panel--toc-body" aria-label="목차 · 본문 일치 확인 결과">
      {pdf && onCalibrateFromInput ? (
        <PrintedPageSetup
          currentSystemPage={currentPage}
          active={Boolean(printedPagesActive)}
          currentPrintedLabel={currentPrintedLabel ?? ''}
          previewPrintedLabel={previewPrintedLabel ?? ''}
          spreadInput={spreadInput ?? false}
          onSpreadInputChange={onSpreadInputChange ?? (() => {})}
          firstPageSingle={firstPageSingle ?? false}
          onFirstPageSingleChange={onFirstPageSingleChange ?? (() => {})}
          onCalibrateFromInput={onCalibrateFromInput}
          onClear={onClearPrintedPageOffset ?? (() => {})}
        />
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
              const tocStatus = group.tocStatus;
              const hasOnCurrentPage = group.instances.some(
                (i) => i.pageNum === currentPage,
              );
              const visible = isGroupVisible(group);
              const count = group.instances.length;
              const visMode = groupVisibilityMode
                ? groupVisibilityMode(group)
                : visible
                  ? 'visible'
                  : 'hidden';
              const shownCount = visibleInstanceCount
                ? visibleInstanceCount(group)
                : count;
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
                          <GroupVisibilityCheckbox
                            mode={visMode}
                            label={group.label}
                            onToggle={() => onToggleVisibility(group)}
                          />
                          <span className="result-visibility-label">표시</span>
                        </label>
                        <span className="result-count result-count--toc">
                          {tocStatus === 'missing'
                            ? '본문 없음'
                            : shownCount < count
                              ? `표시 ${shownCount} / ${count}`
                              : count > 1
                                ? `${count}곳`
                                : '1곳'}
                        </span>
                      </div>
                    </div>
                    {tocStatus === 'missing' ? (
                      <p className="toc-result-missing-hint">
                        본문에서 찾지 못했습니다.
                        {group.outlineHint ? (
                          <>
                            {' '}
                            PDF 제목 후보: 「{group.outlineHint.text}」 (
                            {pageLabel(group.outlineHint.pageNum)}쪽)
                          </>
                        ) : null}
                      </p>
                    ) : tocStatus === 'outline-extra' ? (
                      <p className="toc-result-outline-extra-hint">
                        목차 TXT에는 없고, PDF 큰 글씨 제목으로만 보입니다.
                      </p>
                    ) : (
                      <>
                        {group.tocMismatchReason === 'body-mention-only' ? (
                          <p className="toc-result-missing-hint">
                            PDF에 소제목 줄 텍스트가 없거나, 본문·그림 라벨
                            인용만 잡혔습니다. 빨간 동그라미 소제목이 벡터·
                            이미지면 검수로는 확인할 수 없습니다.
                          </p>
                        ) : null}
                        <ResultPageSummary
                          instances={group.instances}
                          currentPage={currentPage}
                          formatPageLabel={pageLabel}
                          onSelectPage={(pageNum) =>
                            onSelectPageInGroup(pageNum, group.instances)
                          }
                          onSelectInstance={onSelectInstance}
                          isInstanceVisible={
                            isInstanceVisible
                              ? (inst) => isInstanceVisible(group, inst)
                              : undefined
                          }
                          onToggleInstanceVisibility={
                            onToggleInstanceVisibility
                              ? (inst) => onToggleInstanceVisibility(group, inst)
                              : undefined
                          }
                        />
                      </>
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
