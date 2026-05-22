import ResultPageSummary from './ResultPageSummary.jsx';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { cautionResultChipLabel } from '../lib/cautionRules.js';

/**
 * @typedef {{ group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency' }} ResultEntry
 */

/**
 * @param {{
 *   entries: ResultEntry[],
 *   currentPage: number,
 *   pdf: object | null,
 *   activeGroup: import('../lib/ruleEngine.js').GroupedResult | null,
 *   activeSource: 'spelling' | 'consistency',
 *   activeRuleOnPageCount: number,
 *   visibleOnCurrentPage: number,
 *   totalFindings: number,
 *   ruleCount: number,
 *   viewSource: 'spelling' | 'consistency',
 *   spellingFindings: number,
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
 * }} props
 */
export default function CheckResultsPanel({
  entries,
  currentPage,
  pdf,
  activeGroup,
  activeSource,
  activeRuleOnPageCount,
  visibleOnCurrentPage,
  totalFindings,
  ruleCount,
  viewSource,
  spellingFindings,
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
}) {
  const setLabel = ruleSetName.trim() || '규칙 세트';

  const spellingTone =
    viewSource === 'consistency'
      ? 'consistency'
      : activeGroup?.category === 'caution'
        ? 'caution'
        : 'builtin';

  return (
    <section
      className={`results-panel results-panel--combined results-panel--tone-${spellingTone}`}
    >
      {pdf && (
        <p
          className={`current-page-status ${
            visibleOnCurrentPage > 0 ? 'current-page-status--has-findings' : ''
          } current-page-status--tone-${spellingTone}`}
        >
          지금 보는 <strong>p.{currentPage}</strong>
          {visibleOnCurrentPage > 0
            ? ` · PDF 표시 ${visibleOnCurrentPage}곳${
                activeGroup && activeRuleOnPageCount > 0
                  ? ` (선택 규칙 ${activeRuleOnPageCount}곳)`
                  : ''
              }`
            : ' · 이 페이지 표시 없음'}
        </p>
      )}
      {viewSource === 'spelling' && spellingCheckDone && spellingFindings > 0 && (
        <p className="results-category-summary">
          맞춤법 검사 {spellingFindings}건
        </p>
      )}
      {viewSource === 'consistency' &&
        consistencyCheckDone &&
        consistencyFindings > 0 && (
          <p className="results-category-summary">
            일관성 검사[{setLabel}] {consistencyFindings}건
          </p>
        )}
      {entries.length > 0 ? (
        <>
          <div className="results-header">
            전체 발견 {totalFindings}건 · {ruleCount}규칙
          </div>
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
                              <span className="caution-badge-inline">주의</span>{' '}
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
                          <span className="result-count">{count}건</span>
                        ) : null}
                      </div>
                    </div>

                    <ResultPageSummary
                      instances={group.instances}
                      currentPage={currentPage}
                      onSelectPage={(pageNum) =>
                        onSelectPageInGroup(pageNum, group.instances, source)
                      }
                    />

                    {isConsistency && first && (
                      <span className="result-detail">
                        {count}건 · {first.matchedText} → {first.suggestedText}
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
