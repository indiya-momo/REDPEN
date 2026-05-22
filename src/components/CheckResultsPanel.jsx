import { useState } from 'react';
import ResultPageSummary from './ResultPageSummary.jsx';
import { getBuiltInTip } from '../lib/builtInRules.js';
/**
 * @param {{
 *   mode: 'spelling' | 'consistency',
 *   groupedResults: import('../lib/ruleEngine.js').GroupedResult[],
 *   currentPage: number,
 *   pdf: object | null,
 *   activeGroup: import('../lib/ruleEngine.js').GroupedResult | null,
 *   activeRuleOnPageCount: number,
 *   findingsOnCurrentPage: number,
 *   totalFindings: number,
 *   categoryFindings: number,
 *   hasCategoryRulesActive: boolean,
 *   isSameGroupAsSelected: (group: import('../lib/ruleEngine.js').GroupedResult) => boolean,
 *   onSelectGroup: (group: import('../lib/ruleEngine.js').GroupedResult) => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[]) => void,
 *   ruleSetName?: string,
 *   onAdditionalCheck?: () => void,
 * }} props
 */
export default function CheckResultsPanel({
  mode,
  groupedResults,
  currentPage,
  pdf,
  activeGroup,
  activeRuleOnPageCount,
  findingsOnCurrentPage,
  totalFindings,
  categoryFindings,
  hasCategoryRulesActive,
  isSameGroupAsSelected,
  onSelectGroup,
  onSelectPageInGroup,
  ruleSetName = '',
  onAdditionalCheck,
}) {
  const isSpelling = mode === 'spelling';
  const setLabel = ruleSetName.trim() || '규칙 세트';
  const [openTipKey, setOpenTipKey] = useState(null);

  function categorySummary(count) {
    if (isSpelling) {
      return `맞춤법 검사로 ${count}건이 등장하였습니다`;
    }
    return `일관성 검사[${setLabel}] ${count}건이 등장하였습니다`;
  }

  function groupKey(group) {
    return `${group.find}\0${group.replace}`;
  }

  function toggleTip(key, e) {
    e.stopPropagation();
    setOpenTipKey((prev) => (prev === key ? null : key));
  }

  return (
    <section
      className={`results-panel results-panel--${isSpelling ? 'spelling' : 'consistency'}`}
    >
      {pdf && (
        <p
          className={`current-page-status ${
            findingsOnCurrentPage > 0 ? 'current-page-status--has-findings' : ''
          }`}
        >
          지금 보는 <strong>p.{currentPage}</strong>
          {activeGroup && activeRuleOnPageCount > 0
            ? ` · 선택 규칙 ${activeRuleOnPageCount}곳 표시`
            : findingsOnCurrentPage > 0
              ? ` · 이 페이지 ${findingsOnCurrentPage}건`
              : ' · 이 페이지 발견 없음'}
        </p>
      )}
      {hasCategoryRulesActive && categoryFindings > 0 && (
        <p className="results-category-summary">
          {categorySummary(categoryFindings)}
        </p>
      )}
      {groupedResults.length > 0 ? (
        <>
          <div className="results-header">
            전체 발견 {totalFindings}건 · {groupedResults.length}규칙
          </div>
          <ul className="results-list">
            {groupedResults.map((group) => {
              const first = group.instances[0];
              const count = group.instances.length;
              const hasOnCurrentPage = group.instances.some(
                (i) => i.pageNum === currentPage,
              );
              const isCaution = group.category === 'caution';
              const showSpellingStyle = isSpelling;
              const tipText =
                (group.tip || '').trim() ||
                (showSpellingStyle && !isCaution
                  ? getBuiltInTip(group.find, group.replace)
                  : '');
              const key = groupKey(group);
              const selected = isSameGroupAsSelected(group);
              const tipOpen = openTipKey === key;

              return (
                <li key={`${group.label}-${group.find}`}>
                  <div
                    className={`result-card ${
                      selected ? 'result-card--active' : ''
                    } ${hasOnCurrentPage ? 'result-card--on-page' : ''} ${
                      isCaution ? 'result-card--caution' : ''
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
                      <span className="result-rule">
                        {isCaution && first ? (
                          <>
                            <span className="caution-badge-inline">주의</span>{' '}
                            {first.matchedText}
                            <span className="result-review-tag"> 검토</span>
                          </>
                        ) : showSpellingStyle && first ? (
                          `${first.matchedText} → ${first.suggestedText}`
                        ) : (
                          group.label
                        )}
                      </span>
                      <div className="result-card-head-actions">
                        {showSpellingStyle && count > 1 && (
                          <span className="result-count">{count}건</span>
                        )}
                        {showSpellingStyle && tipText ? (
                          <button
                            type="button"
                            className={`tip-toggle-btn ${tipOpen ? 'tip-toggle-btn--open' : ''}`}
                            aria-expanded={tipOpen}
                            aria-label="규칙 설명 보기"
                            onClick={(e) => toggleTip(key, e)}
                          >
                            설명
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {showSpellingStyle && tipText && tipOpen && (
                      <p className="tip-toggle-body result-card-tip">{tipText}</p>
                    )}

                    <ResultPageSummary
                      instances={group.instances}
                      currentPage={currentPage}
                      onSelectPage={(pageNum) =>
                        onSelectPageInGroup(pageNum, group.instances)
                      }
                    />

                    {!showSpellingStyle && first && (
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
        hasCategoryRulesActive && (
          <p className="hint results-empty-hint">발견된 항목이 없습니다.</p>
        )
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
