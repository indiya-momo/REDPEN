import ResultPageSummary from './ResultPageSummary.jsx';
import PrintedPageSetup from './PrintedPageSetup.jsx';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { cautionResultChipLabel } from '../lib/cautionRules.js';

/**
 * @typedef {{ group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency' }} ResultEntry
 */

/**
 * @param {{
 *   visibleOnCurrentPage: number,
 * }} props
 */
function CurrentPageFindingText({ visibleOnCurrentPage }) {
  if (visibleOnCurrentPage <= 0) {
    return <>에는 발견한 기준이 없습니다</>;
  }
  return (
    <>
      에는 발견한 기준{' '}
      <span className="current-page-status__count-underline">
        {visibleOnCurrentPage}개
      </span>
      가 있습니다
    </>
  );
}

/**
 * @param {{
 *   viewSource: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   spellingFindings: number,
 *   ruleCount: number,
 *   totalFindings: number,
 *   builtinFindings: number,
 *   spacingFindings: number,
 * }} props
 */
function ResultHeaderSummary({
  viewSource,
  spellingCheckDone,
  spellingFindings,
  ruleCount,
  totalFindings,
  builtinFindings,
  spacingFindings,
}) {
  return (
    <div className="results-header">
      <span className="results-header__applied">
        기준 <span className="results-header__rule-chip">{ruleCount}</span> 적용
      </span>{' '}
      전체 발견{' '}
      <span className="results-category-summary__count-underline">
        {totalFindings}
      </span>
      {viewSource === 'spelling' && spellingCheckDone && spellingFindings > 0 ? (
        <span className="results-header__breakdown">
          <span className="results-category-summary__builtin">
            맞춤법 기준 <span>{builtinFindings}</span>
          </span>{' '}
          ·{' '}
          <span className="results-category-summary__caution">
            검토 필요 기준 <span>{spacingFindings}</span>
          </span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   entries: ResultEntry[],
 *   currentPage: number,
 *   pdf: object | null,
 *   activeGroup: import('../lib/ruleEngine.js').GroupedResult | null,
 *   activeSource: 'spelling' | 'consistency',
 *   visibleOnCurrentPage: number,
 *   totalFindings: number,
 *   ruleCount: number,
 *   viewSource: 'spelling' | 'consistency',
 *   spellingFindings: number,
 *   builtinFindings?: number,
 *   spacingFindings?: number,
 *   consistencyFindings: number,
 *   spellingCheckDone: boolean,
 *   consistencyCheckDone: boolean,
 *   isGroupVisible: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => boolean,
 *   onToggleVisibility: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => void,
 *   isSameGroupAsSelected: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => boolean,
 *   onSelectGroup: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[], source: 'spelling' | 'consistency') => void,
 *   ruleSetName?: string,
 *   onAdditionalCheck?: () => void,
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
export default function CheckResultsPanel({
  entries,
  currentPage,
  pdf,
  activeGroup,
  activeSource,
  visibleOnCurrentPage,
  totalFindings,
  ruleCount,
  viewSource,
  spellingFindings,
  builtinFindings = 0,
  spacingFindings = 0,
  consistencyFindings,
  spellingCheckDone,
  consistencyCheckDone,
  isGroupVisible,
  onToggleVisibility,
  isSameGroupAsSelected,
  onSelectGroup,
  onSelectPageInGroup,
  ruleSetName = '',
  onAdditionalCheck,
  printedPageOffset = null,
  printedPagesActive = false,
  onCalibrateFromInput,
  onClearPrintedPageOffset,
  currentPrintedLabel = '',
  previewPrintedLabel = '',
  spreadInput = false,
  onSpreadInputChange,
  firstPageSingle = true,
  onFirstPageSingleChange,
  formatPageLabel: formatPageLabelProp,
}) {
  const setLabel = ruleSetName.trim() || '규칙 세트';
  const pageLabel = formatPageLabelProp ?? formatSystemPageLabel;

  const spellingTone =
    viewSource === 'consistency'
      ? 'consistency'
      : activeGroup?.category === 'caution'
        ? 'caution'
        : 'builtin';

  return (
    <section
      className={`results-panel results-panel--combined results-panel--${viewSource} results-panel--tone-${spellingTone}`}
    >
      {pdf && onCalibrateFromInput && (
        <PrintedPageSetup
          currentSystemPage={currentPage}
          active={printedPagesActive}
          currentPrintedLabel={currentPrintedLabel || pageLabel(currentPage)}
          previewPrintedLabel={previewPrintedLabel}
          spreadInput={spreadInput}
          onSpreadInputChange={onSpreadInputChange ?? (() => {})}
          firstPageSingle={firstPageSingle}
          onFirstPageSingleChange={onFirstPageSingleChange ?? (() => {})}
          onCalibrateFromInput={onCalibrateFromInput}
          onClear={onClearPrintedPageOffset ?? (() => {})}
        />
      )}
      {pdf && (
        <p
          className={`current-page-status ${
            visibleOnCurrentPage > 0 ? 'current-page-status--has-findings' : ''
          } current-page-status--tone-${spellingTone}`}
        >
          현재 <strong>{pageLabel(currentPage)}</strong>
          {printedPagesActive && printedPageOffset != null ? (
            <span className="current-page-status__system">
              {' '}
              (파일 {formatSystemPageLabel(currentPage)})
            </span>
          ) : null}
          <CurrentPageFindingText visibleOnCurrentPage={visibleOnCurrentPage} />
        </p>
      )}
      {viewSource === 'consistency' &&
        consistencyCheckDone &&
        consistencyFindings > 0 && (
          <p className="results-category-summary">
            일관성 검사[{setLabel}] {consistencyFindings}개
          </p>
        )}
      {entries.length > 0 ? (
        <>
          <ResultHeaderSummary
            viewSource={viewSource}
            spellingCheckDone={spellingCheckDone}
            spellingFindings={spellingFindings}
            ruleCount={ruleCount}
            totalFindings={totalFindings}
            builtinFindings={builtinFindings}
            spacingFindings={spacingFindings}
          />
          <ul className="results-list">
            {entries.map(({ group, source }) => {
              const first = group.instances[0];
              const count = group.instances.length;
              const hasOnCurrentPage = group.instances.some(
                (i) => i.pageNum === currentPage,
              );
              const isCaution = group.category === 'caution';
              const isConsistency = source === 'consistency';
              const visible = isGroupVisible(source, group);
              const tipText =
                (group.tip || '').trim() ||
                (source === 'spelling' && !isCaution
                  ? getBuiltInTip(group.find, group.replace)
                  : '');
              const selected = isSameGroupAsSelected(group, source);

              return (
                <li key={`${source}-${group.label}-${group.find}`}>
                  <div
                    className={`result-card ${
                      selected ? 'result-card--active' : ''
                    } ${hasOnCurrentPage ? 'result-card--on-page' : ''} ${
                      !visible ? 'result-card--hidden' : ''
                    } ${
                      isConsistency
                        ? 'result-card--consistency'
                        : isCaution
                          ? 'result-card--caution'
                          : 'result-card--builtin'
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectGroup(group, source)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectGroup(group, source);
                      }
                    }}
                  >
                    <div className="result-card-head">
                      <div className="result-card-head-main">
                        <span className="result-rule">
                          {isConsistency ? (
                            <>
                              <span className="result-source-badge result-source-badge--consistency">
                                일관성
                              </span>{' '}
                              {group.label}
                            </>
                          ) : isCaution ? (
                            <>
                              <span className="caution-badge-inline">검토</span>{' '}
                              <span className="caution-result-chip">
                                {cautionResultChipLabel(group)}
                              </span>
                            </>
                          ) : first ? (
                            `${first.matchedText} → ${first.suggestedText}`
                          ) : (
                            group.label
                          )}
                        </span>
                        {tipText ? (
                          <span className="result-card-tip-inline">{tipText}</span>
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
                            onChange={() => onToggleVisibility(source, group)}
                          />
                          <span className="result-visibility-label">표시</span>
                        </label>
                        {count > 1 ? (
                          <span className="result-count">{count}개</span>
                        ) : null}
                      </div>
                    </div>

                    <ResultPageSummary
                      instances={group.instances}
                      currentPage={currentPage}
                      formatPageLabel={pageLabel}
                      onSelectPage={(pageNum) =>
                        onSelectPageInGroup(pageNum, group.instances, source)
                      }
                    />

                    {isConsistency && first && (
                      <span className="result-detail">
                        {count}개 · {first.matchedText} → {first.suggestedText}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="hint results-empty-hint">발견된 항목이 없습니다.</p>
      )}
      {onAdditionalCheck && (
        <div className="results-panel-footer">
          <button type="button" className="btn-additional-check" onClick={onAdditionalCheck}>
            추가 검사
          </button>
        </div>
      )}
    </section>
  );
}
