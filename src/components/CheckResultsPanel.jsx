import ResultPageSummary from './ResultPageSummary.jsx';
import GroupVisibilityCheckbox from './GroupVisibilityCheckbox.jsx';
import PrintedPageSetup from './PrintedPageSetup.jsx';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { cautionResultChipLabel } from '../lib/cautionRules.js';
import { getConsistencyHighlightTip } from '../lib/consistencyHighlightTip.js';
import { auxiliaryVerbResultParts } from '../lib/patternDisplayLabels.js';

/**

 * @typedef {import('../utils/main-screen-helpers.js').TabEntry} ResultEntry
 */

/**
 * @param {{
 *   viewSource: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   ruleCount: number,
 *   totalFindings: number,
 *   cautionWithFindingsCount?: number,
 *   builtinWithFindingsCount?: number,
 *   literalWithFindingsCount?: number,
 *   auxiliaryWithFindingsCount?: number,
 * }} props
 */
function ResultHeaderSummary({
  viewSource,
  spellingCheckDone,
  ruleCount,
  totalFindings,
  cautionWithFindingsCount = 0,
  builtinWithFindingsCount = 0,
  literalWithFindingsCount = 0,
  auxiliaryWithFindingsCount = 0,
}) {
  if (viewSource === 'spelling' && spellingCheckDone) {
    return (
      <div className="results-header">
        <span className="results-header__applied">
          편집자 검토 필요 기준{' '}
          <span className="results-header__rule-chip results-category-summary__caution">
            {`{${cautionWithFindingsCount}}`}
          </span>{' '}
          맞춤법 기준{' '}
          <span className="results-header__rule-chip results-category-summary__builtin">
            {`{${builtinWithFindingsCount}}`}
          </span>
        </span>
        {' '}전체 발견 기준{' '}
        <span className="results-category-summary__count-underline">
          {`[${totalFindings}]`}
        </span>
      </div>
    );
  }

  if (viewSource === 'consistency' && spellingCheckDone) {
    return (
      <div className="results-header">
        <span className="results-header__applied">
          일관성 찾기{' '}
          <span className="results-header__rule-chip results-category-summary__builtin">
            {`{${literalWithFindingsCount}}`}
          </span>{' '}
          본용언 + 보조용언 표기{' '}
          <span className="results-header__rule-chip results-category-summary__caution">
            {`{${auxiliaryWithFindingsCount}}`}
          </span>
        </span>
        , 전체 발견 기준{' '}
        <span className="results-category-summary__count-underline">
          {`[${totalFindings}]`}
        </span>
      </div>
    );
  }

  return (
    <div className="results-header">
      <span className="results-header__applied">
        기준 <span className="results-header__rule-chip">{ruleCount}</span> 적용
      </span>{' '}
      전체 발견 기준{' '}
      <span className="results-category-summary__count-underline">
        {totalFindings}
      </span>
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
 *   spellingFindings?: number,
 *   cautionWithFindingsCount?: number,
 *   builtinWithFindingsCount?: number,
 *   literalWithFindingsCount?: number,
 *   auxiliaryWithFindingsCount?: number,
 *   spellingCheckDone: boolean,
 *   isGroupVisible: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => boolean,
 *   groupVisibilityMode?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => number,
 *   isInstanceVisible?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult, inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleVisibility: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => void,
 *   onToggleInstanceVisibility?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult, inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance, source: 'spelling' | 'consistency') => void,
 *   isSameGroupAsSelected: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => boolean,
 *   onSelectGroup: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[], source: 'spelling' | 'consistency') => void,
 *   selectedInstance?: import('../lib/ruleEngine.js').MatchInstance | null,
 *   onAdditionalCheck?: () => void,
 *   onExport?: () => void,
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
  cautionWithFindingsCount = 0,
  builtinWithFindingsCount = 0,
  literalWithFindingsCount = 0,
  auxiliaryWithFindingsCount = 0,
  spellingCheckDone,
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
  selectedInstance = null,
  onAdditionalCheck,
  onExport,
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
      {pdf && onCalibrateFromInput && viewSource !== 'spelling' && (
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
      {entries.length > 0 ? (
        <>
          <ResultHeaderSummary
            viewSource={viewSource}
            spellingCheckDone={spellingCheckDone}
            ruleCount={ruleCount}
            totalFindings={totalFindings}
            cautionWithFindingsCount={cautionWithFindingsCount}
            builtinWithFindingsCount={builtinWithFindingsCount}
            literalWithFindingsCount={literalWithFindingsCount}
            auxiliaryWithFindingsCount={auxiliaryWithFindingsCount}
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
              const visMode = groupVisibilityMode
                ? groupVisibilityMode(source, group)
                : visible
                  ? 'visible'
                  : 'hidden';
              const shownCount = visibleInstanceCount
                ? visibleInstanceCount(source, group)
                : count;
              const tipText =
                (group.tip || '').trim() ||
                (source === 'spelling' && !isCaution
                  ? getBuiltInTip(group.find, group.replace)
                  : isConsistency
                    ? getConsistencyHighlightTip(group)
                    : '');
              const selected = isSameGroupAsSelected(group, source);
              const auxParts =
                isConsistency && group.patternKind === 'auxiliary-verb'
                  ? group.tailWord
                    ? auxiliaryVerbResultParts(
                        group.tailWord,
                        group.groupDisplayLabel,
                        group.label,
                      )
                    : {
                        stem: '',
                        groupTag:
                          group.groupDisplayLabel?.trim() ||
                          group.label?.trim() ||
                          null,
                      }
                  : null;

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
                            auxParts ? (
                              <span className="result-aux-title">
                                {auxParts.stem ? (
                                  <span className="result-aux-stem">
                                    {auxParts.stem}
                                  </span>
                                ) : null}
                                {auxParts.groupTag ? (
                                  <span className="result-aux-group-tag">
                                    {auxParts.groupTag}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              group.label
                            )
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
                          <GroupVisibilityCheckbox
                            mode={visMode}
                            label={group.label}
                            onToggle={() => onToggleVisibility(source, group)}
                          />
                          <span className="result-visibility-label">표시</span>
                        </label>
                        {isConsistency || count > 1 ? (
                          <span
                            className={`result-count${count === 0 ? ' result-count--zero' : ''}${
                              shownCount < count ? ' result-count--partial' : ''
                            }`}
                          >
                            {count === 0
                              ? '0개'
                              : shownCount < count
                                ? `표시 ${shownCount} / ${count}`
                                : `${count}개`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <ResultPageSummary
                      instances={group.instances}
                      currentPage={currentPage}
                      selectedInstance={selectedInstance}
                      formatPageLabel={pageLabel}
                      onSelectPage={(pageNum) =>
                        onSelectPageInGroup(pageNum, group.instances, source)
                      }
                      onSelectInstance={
                        onSelectInstance
                          ? (inst) => onSelectInstance(inst, source)
                          : undefined
                      }
                      isInstanceVisible={
                        isInstanceVisible
                          ? (inst) => isInstanceVisible(source, group, inst)
                          : undefined
                      }
                      onToggleInstanceVisibility={
                        onToggleInstanceVisibility
                          ? (inst) =>
                              onToggleInstanceVisibility(source, group, inst)
                          : undefined
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="hint results-empty-hint">발견된 항목이 없습니다.</p>
      )}
      {(onAdditionalCheck || onExport) && (
        <div className="results-panel-footer">
          {onAdditionalCheck && (
            <button type="button" className="btn-additional-check" onClick={onAdditionalCheck}>
              다시 검사
            </button>
          )}
          {onExport && (
            <button type="button" className="btn-export-results" onClick={onExport}>
              엑셀 내보내기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
