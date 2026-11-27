import ResultPageSummary from './ResultPageSummary.jsx';
import {
  isAuxiliaryDictSolidInstance,
  isAuxiliaryGluedDictSolidInstance,
} from '../lib/auxiliaryDictSolid.js';
import {
  AUXILIARY_SPACING_BREAKDOWN_TIP,
  countAuxiliaryMatchedSpacingSurfaces,
  listAuxiliarySpacingLineParts,
  shouldShowAuxiliarySpacingBreakdown,
} from '../lib/auxiliaryVerbSpacingSummary.js';
import PhraseSlotResultSummary from './PhraseSlotResultSummary.jsx';
import GroupVisibilityCheckbox from './GroupVisibilityCheckbox.jsx';import DetailsChevron, { detailsOpenOnceRef } from './DetailsChevron.jsx';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { cautionResultChipLabel } from '../lib/cautionRules.js';
import { getConsistencyResultCardParts } from '../lib/consistencyHighlightTip.js';
import {
  AUXILIARY_VERB_BADGE_LABEL,
  isBonBojoRequiredItem,
} from '../lib/bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from '../lib/consistencyRuleLimit.js';
import {
  EDITOR_REVIEW_BADGE_LABEL,
  SPELLING_RULE_BADGE_LABEL,
  LOANWORD_BADGE_LABEL,
} from '../lib/checkResultSummaryFormat.js';
import {
  MANUAL_BADGE_LABEL,
  SEARCH_BADGE_LABEL,
} from '../lib/manuscriptWorkbench/types.js';
import { manualResultCardTip } from '../lib/manuscriptWorkbench/textPartDiff.js';
import StdictCorrectionLink from './StdictCorrectionLink.jsx';
import CautionDictTip from './CautionDictTip.jsx';
import { useStdictLinkIndex } from '../hooks/useStdictLinkIndex.js';
import {
  correctionPairsOfGroup,
  isDictBundleGroup,
} from '../lib/stdictLinkPairs.js';
import {
  defaultOpenConsistencyCategory,
  defaultOpenSpellingCategory,
  partitionConsistencyResultEntries,
  partitionSpellingResultEntries,
  sumVisibleFindings,
  countGroupsWithVisibleFindings,
} from '../lib/checkResultsAccordion.js';
import {
  formatPhraseSlotStemStyleSignalText,
  interleavePhraseSlotStemStyleSignals,
} from '../lib/phraseSlotStyleSignal.js';

/**
 * @param {{
 *   count: number,
 *   shownCount?: number,
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
function ResultFindingsCountCircle({
  count,
  shownCount = count,
  className = '',
  ariaLabel,
}) {
  const partial = shownCount < count;
  const partialTip = partial ? `표시 ${shownCount}/${count}` : undefined;
  return (
    <CriteriaHoverTip tip={partialTip} variant="wrap">
      <span
        className={`result-findings-count-circle ${className}`.trim()}
        aria-label={
          ariaLabel ??
          (partial ? `표시 ${shownCount}건 / 전체 ${count}건` : `${count}건`)
        }
      >
        {shownCount}
      </span>
    </CriteriaHoverTip>
  );
}

/** 라벨 속 '필수'를 기존 뱃지로 보여 준다. @param {string} text */
function renderLabelWithRequiredBadge(text) {
  const parts = String(text ?? '').split('필수');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? (
        <span className="bon-bojo-required-badge">필수</span>
      ) : null}
    </Fragment>
  ));
}

/**
 * 카테고리 헤더 — 맞춤법 검수 체크리스트와 같은 > · 체크박스.
 * @param {{
 *   label: string,
 *   entries: ResultEntry[],
 *   isGroupVisible: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => boolean,
 *   onToggleVisibility: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => void,
 * }} props
 */
function ResultsCategorySelectAll({
  label,
  entries,
  isGroupVisible,
  onToggleVisibility,
}) {
  const ref = useRef(/** @type {HTMLInputElement | null} */ (null));
  const visibles = entries.map((e) => isGroupVisible(e.source, e.group));
  const allChecked = visibles.length > 0 && visibles.every(Boolean);
  const noneChecked = visibles.every((v) => !v);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !allChecked && !noneChecked;
    }
  }, [allChecked, noneChecked]);

  return (
    <label
      className="results-category__select-all"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        onChange={() => {
          const next = !allChecked;
          for (const { group, source } of entries) {
            if (isGroupVisible(source, group) !== next) {
              onToggleVisibility(source, group);
            }
          }
        }}
        aria-label={`${label} PDF 표시`}
      />
    </label>
  );
}

/**
 * @typedef {import('../utils/main-screen-helpers.js').TabEntry} ResultEntry
 */

/**
 * @param {{
 *   viewSource: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   ruleCount: number,
 *   totalFindings: number,
 *   visibleTotalFindings?: number,
 * }} props
 */
function ResultHeaderSummary({
  viewSource,
  spellingCheckDone,
  ruleCount,
  totalFindings,
  visibleTotalFindings,
}) {
  const totalShown =
    visibleTotalFindings === undefined ? totalFindings : visibleTotalFindings;
  const totalFindingsNode = (
    <span className="results-header__total-findings results-findings-meta">
      <span className="results-findings-meta__label">전체 발견</span>
      <ResultFindingsCountCircle
        count={totalFindings}
        shownCount={totalShown}
        className="results-header__total-count"
      />
    </span>
  );

  if (
    (viewSource === 'spelling' || viewSource === 'consistency') &&
    spellingCheckDone
  ) {
    return (
      <div className="results-header results-header--total-only">
        {totalFindingsNode}
      </div>
    );
  }

  return (
    <div className="results-header">
      <div className="results-header__stats">
        기준 <span className="results-header__rule-chip">{ruleCount}</span> 적용
      </div>
      <span className="results-header__total-findings results-findings-meta">
        <span className="results-findings-meta__label">전체 발견 기준</span>
        <ResultFindingsCountCircle
          count={totalFindings}
          className="results-header__total-count"
        />
      </span>
    </div>
  );
}

/**
 * 본조 페이지 뱃지 — 띄어 쓴 표면, 붙여 쓴 표면 순. 각 묶음은 페이지 순.
 * @param {import('../lib/ruleEngine.js').MatchInstance[]} instances
 */
function auxiliarySpacingBadgeRows(instances) {
  /** @type {import('../lib/ruleEngine.js').MatchInstance[]} */
  const spaced = [];
  /** @type {import('../lib/ruleEngine.js').MatchInstance[]} */
  const glued = [];
  for (const inst of instances ?? []) {
    const text = String(inst?.matchedText ?? '').trim();
    if (/\s/.test(text)) spaced.push(inst);
    else glued.push(inst);
  }
  return [
    ['띄', spaced],
    ['붙', glued],
  ].filter(([, list]) => list.length > 0);
}

/**
 * @param {Record<string, unknown> & {
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   isInstanceVisible?: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onSetInstancesVisibility?: (
 *     instances: import('../lib/ruleEngine.js').MatchInstance[],
 *     visible: boolean,
 *   ) => void,
 * }} props
 */
function AuxiliarySpacingPageRows(props) {
  const { isInstanceVisible, onSetInstancesVisibility, ...summaryProps } =
    props;
  /** @type {import('../lib/ruleEngine.js').MatchInstance[]} */
  const primary = [];
  /** @type {import('../lib/ruleEngine.js').MatchInstance[]} */
  const gluedSolid = [];
  for (const inst of props.instances ?? []) {
    if (isAuxiliaryGluedDictSolidInstance(inst)) gluedSolid.push(inst);
    else primary.push(inst);
  }
  /** @type {[string, import('../lib/ruleEngine.js').MatchInstance[]][]} */
  const rows = [
    ...auxiliarySpacingBadgeRows(primary),
    ...(gluedSolid.length > 0 ? [['합', gluedSolid]] : []),
  ];
  if (!rows.length) return null;
  return (
    <div className="aux-spacing-pages">
      {rows.map(([mark, list]) => {
        const visibleCount = list.filter((inst) =>
          isInstanceVisible ? isInstanceVisible(inst) : true,
        ).length;
        const mode =
          visibleCount === 0
            ? 'hidden'
            : visibleCount < list.length
              ? 'partial'
              : 'visible';
        const toggleLabel = mark === '합' ? '합성어' : `${mark}어 쓴`;
        return (
          <div className="aux-spacing-pages__row" key={mark}>
            {onSetInstancesVisibility ? (
              <label
                className="result-visibility-toggle aux-spacing-pages__toggle"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <GroupVisibilityCheckbox
                  mode={mode}
                  label={toggleLabel}
                  onToggle={() =>
                    onSetInstancesVisibility(list, mode !== 'visible')
                  }
                />
              </label>
            ) : null}
            <span className="aux-spacing-pages__mark">{mark}</span>
            <ResultPageSummary
              {...summaryProps}
              instances={list}
              isInstanceVisible={isInstanceVisible}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   entries: ResultEntry[],
 *   currentPage: number,
 *   activeGroup: import('../lib/ruleEngine.js').GroupedResult | null,
 *   totalFindings: number,
 *   ruleCount: number,
 *   viewSource: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   isGroupVisible: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => boolean,
 *   groupVisibilityMode?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => 'visible' | 'partial' | 'hidden',
 *   visibleInstanceCount?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => number,
 *   isInstanceVisible?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult, inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleVisibility: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult) => void,
 *   onToggleInstanceVisibility?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult, inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onSetInstancesVisibility?: (source: 'spelling' | 'consistency', group: import('../lib/ruleEngine.js').GroupedResult, instances: import('../lib/ruleEngine.js').MatchInstance[], visible: boolean) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance, source: 'spelling' | 'consistency') => void,
 *   isSameGroupAsSelected: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => boolean,
 *   onSelectGroup: (group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency') => void,
 *   onSelectPageInGroup: (pageNum: number, instances: import('../lib/ruleEngine.js').MatchInstance[], source: 'spelling' | 'consistency') => void,
 *   selectedInstance?: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel?: (systemPage: number) => string,
 *   customRules?: import('../lib/ruleTypes.js').Rule[],
 *   pageTexts?: { text?: string }[],
 *   onRemoveManualInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
export default function CheckResultsPanel({
  entries,
  currentPage,
  activeGroup,
  totalFindings,
  ruleCount,
  viewSource,
  spellingCheckDone,
  isGroupVisible,
  groupVisibilityMode,
  visibleInstanceCount,
  isInstanceVisible,
  onToggleVisibility,
  onToggleInstanceVisibility,
  onSetInstancesVisibility,
  onSelectInstance,
  isSameGroupAsSelected,
  onSelectGroup,
  onSelectPageInGroup,
  selectedInstance = null,
  formatPageLabel: formatPageLabelProp,
  customRules = [],
  pageTexts: _pageTexts = [],
  onRemoveManualInstance,
}) {
  const pageLabel = formatPageLabelProp ?? formatSystemPageLabel;
  /** 표준국어대사전 색인(없거나 읽기 실패면 null → 링크 없이 글자만) */
  const stdictLinkIndex = useStdictLinkIndex();

  /** 검사에 잡힌 항목만 — 직접 추가는 하단 수정 리스트에서만 */
  const displayEntries = (entries ?? []).filter(
    (entry) => entry?.group?.category !== 'manual',
  );

  const spellingTone =
    viewSource === 'consistency'
      ? 'consistency'
      : activeGroup?.category === 'caution'
        ? 'caution'
        : 'builtin';

  const spellingParts = useMemo(
    () => partitionSpellingResultEntries(displayEntries),
    [displayEntries],
  );
  const openSpellingCategory = defaultOpenSpellingCategory(spellingParts);

  const consistencyParts = useMemo(
    () => partitionConsistencyResultEntries(displayEntries, customRules),
    [displayEntries, customRules],
  );
  const openConsistencyCategory =
    defaultOpenConsistencyCategory(consistencyParts);

  /** @param {ResultEntry} entry */
  const renderResultEntry = ({ group, source }) => {
    const first = group.instances[0];
    const count = group.instances.length;
    const hasOnCurrentPage = group.instances.some(
      (i) => i.pageNum === currentPage,
    );
    const isCaution = group.category === 'caution';
    const isLoanword = group.category === 'loanword';
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
    const consistencyPartsForCard = isConsistency
      ? getConsistencyResultCardParts(group, customRules)
      : null;
    const isSearch = group.category === 'manuscript-search';
    /** 표준국어대사전 등재 묶음 카드의 찾은 말 → 고칠 말 쌍 (인스턴스 값 기준) */
    const dictPairs =
      source === 'spelling' && isDictBundleGroup(group)
        ? correctionPairsOfGroup(group)
        : [];
    const tipText =
      group.category === 'manual'
        ? manualResultCardTip(group)
        : (group.tip || '').trim() ||
          (source === 'spelling' && !isCaution && !isSearch
            ? getBuiltInTip(group.find, group.replace, group.spellingRuleId)
            : '');
    const selected = isSameGroupAsSelected(group, source);
    const auxiliarySpacing =
      group.patternKind === 'auxiliary-verb'
        ? countAuxiliaryMatchedSpacingSurfaces(
            group.instances,
            isAuxiliaryDictSolidInstance,
          )
        : null;
    const auxiliarySpacingParts =
      group.patternKind === 'auxiliary-verb'
        ? listAuxiliarySpacingLineParts(
            auxiliarySpacing &&
              shouldShowAuxiliarySpacingBreakdown(auxiliarySpacing)
              ? auxiliarySpacing
              : null,
          )
        : [];

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
                : isLoanword
                  ? 'result-card--loanword'
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
            <CriteriaHoverTip tip="PDF에 표시">
              <label
                className="result-visibility-toggle"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <GroupVisibilityCheckbox
                  mode={visMode}
                  label={group.label}
                  onToggle={() => onToggleVisibility(source, group)}
                />
              </label>
            </CriteriaHoverTip>
            <div className="result-card-head-main">
              <span className="result-rule">
                {isConsistency ? (
                  <>
                    <span className="consistency-result-chip">
                      {renderLabelWithRequiredBadge(
                        consistencyPartsForCard?.label ||
                          group.label ||
                          '',
                      )}
                    </span>
                    {group.patternKind === 'auxiliary-verb' &&
                    isBonBojoRequiredItem(group.bonBojoItemId) ? (
                      <span className="bon-bojo-required-badge">필수</span>
                    ) : null}
                    {auxiliarySpacingParts.length > 0 ? (
                      <CriteriaHoverTip tip={AUXILIARY_SPACING_BREAKDOWN_TIP}>
                        <span className="aux-spacing-breakdown">
                          {auxiliarySpacingParts.map((part, index) => (
                            <span key={part.text}>
                              {index > 0 ? ' I ' : null}
                              {part.text}
                              {part.solid ? (
                                <>
                                  {' - '}
                                  <span className="aux-spacing-solid">
                                    {part.solid}
                                  </span>
                                </>
                              ) : null}
                            </span>
                          ))}
                        </span>
                      </CriteriaHoverTip>
                    ) : null}
                  </>
                ) : isCaution ? (
                  <span className="caution-result-chip">
                    {cautionResultChipLabel(group)}
                  </span>
                ) : isLoanword ? (
                  <span className="spelling-result-chip">
                    {group.label ||
                      (first
                        ? `${first.matchedText} → ${first.suggestedText}`
                        : '')}
                  </span>
                ) : dictPairs.length > 0 ? (
                  <span className="spelling-result-chip">
                    {dictPairs.map((pair, i) => (
                      <span key={`${pair.find}\u0000${pair.replace}`}>
                        {i > 0 ? ', ' : null}
                        {pair.find} →{' '}
                        <StdictCorrectionLink
                          word={pair.replace}
                          index={stdictLinkIndex}
                        />
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="spelling-result-chip">
                    {group.label ||
                      (first
                        ? `${first.matchedText} → ${first.suggestedText}`
                        : '')}
                  </span>
                )}
              </span>
            </div>
            <ResultFindingsCountCircle
              count={count}
              shownCount={shownCount}
              className="result-card-head__findings-count"
            />
            {group.category === 'manual' && onRemoveManualInstance ? (
              <button
                type="button"
                className="result-card-remove-manual"
                onClick={(event) => {
                  event.stopPropagation();
                  for (const inst of group.instances ?? []) {
                    onRemoveManualInstance(inst);
                  }
                }}
              >
                지우기
              </button>
            ) : null}
          </div>
          {(tipText && (!isConsistency || count === 0)) ||
          group.instances.length > 0 ? (
            <div className="result-card-detail">
              {tipText && (!isConsistency || count === 0) ? (
                <span className="result-card-tip-inline">
                  {isCaution ? (
                    <CautionDictTip
                      text={tipText}
                      chipLabel={cautionResultChipLabel(group)}
                      itemId={group.cautionId}
                      index={stdictLinkIndex}
                    />
                  ) : (
                    tipText
                  )}
                </span>
              ) : null}
              {group.patternKind === 'phrase-slot-find' ? (
                <PhraseSlotResultSummary
                  instances={group.instances}
                  currentPage={currentPage}
                  selectedInstance={selectedInstance}
                  formatPageLabel={pageLabel}
                  onSelectPage={(pageNum, fillInstances) =>
                    onSelectPageInGroup(pageNum, fillInstances, source)
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
              ) : group.patternKind === 'auxiliary-verb' ? (
                <AuxiliarySpacingPageRows
                  pillClass={(inst) =>
                    isAuxiliaryDictSolidInstance(inst)
                      ? 'page-chip--aux-solid'
                      : ''
                  }
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
                  onSetInstancesVisibility={
                    onSetInstancesVisibility
                      ? (instances, visible) =>
                          onSetInstancesVisibility(
                            source,
                            group,
                            instances,
                            visible,
                          )
                      : undefined
                  }
                />
              ) : (
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
              )}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  /** @type {{ id: string, label: string, criteriaCount: number, findingsCount: number, findingsTotal: number, entries: ResultEntry[] }[]} */
  const spellingSections = [
    {
      id: 'search',
      label: SEARCH_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        spellingParts.search,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        spellingParts.search,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(spellingParts.search),
      entries: spellingParts.search,
    },
    {
      id: 'manual',
      label: MANUAL_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        spellingParts.manual,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        spellingParts.manual,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(spellingParts.manual),
      entries: spellingParts.manual,
    },
    {
      id: 'caution',
      label: EDITOR_REVIEW_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        spellingParts.caution,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        spellingParts.caution,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(spellingParts.caution),
      entries: spellingParts.caution,
    },
    {
      id: 'builtin',
      label: SPELLING_RULE_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        spellingParts.builtin,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        spellingParts.builtin,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(spellingParts.builtin),
      entries: spellingParts.builtin,
    },
    {
      id: 'loanword',
      label: LOANWORD_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        spellingParts.loanword,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        spellingParts.loanword,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(spellingParts.loanword),
      entries: spellingParts.loanword,
    },
  ].filter((section) => section.entries.length > 0);

  /** @type {{ id: string, label: string, criteriaCount: number, findingsCount: number, findingsTotal: number, entries: ResultEntry[] }[]} */
  const consistencySections = [
    {
      id: 'unify',
      label: UNIFY_FEATURE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        consistencyParts.unify,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        consistencyParts.unify,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(consistencyParts.unify),
      entries: consistencyParts.unify,
    },
    {
      id: 'literal',
      label: LITERAL_FIND_FEATURE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        consistencyParts.literal,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        consistencyParts.literal,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(consistencyParts.literal),
      entries: consistencyParts.literal,
    },
    {
      id: 'common',
      label: '공통 항목 찾기',
      criteriaCount: countGroupsWithVisibleFindings(
        consistencyParts.common,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        consistencyParts.common,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(consistencyParts.common),
      entries: consistencyParts.common,
    },
    {
      id: 'auxiliary',
      label: AUXILIARY_VERB_BADGE_LABEL,
      criteriaCount: countGroupsWithVisibleFindings(
        consistencyParts.auxiliary,
        visibleInstanceCount,
      ),
      findingsCount: sumVisibleFindings(
        consistencyParts.auxiliary,
        visibleInstanceCount,
      ),
      findingsTotal: sumVisibleFindings(consistencyParts.auxiliary),
      entries: consistencyParts.auxiliary,
    },
  ].filter((section) => section.entries.length > 0);

  const spellingEntriesAll = [
    ...spellingParts.search,
    ...spellingParts.manual,
    ...spellingParts.caution,
    ...spellingParts.builtin,
    ...spellingParts.loanword,
  ];
  const consistencyEntriesAll = [
    ...consistencyParts.unify,
    ...consistencyParts.literal,
    ...consistencyParts.common,
    ...consistencyParts.auxiliary,
  ];
  const accordionSections =
    viewSource === 'spelling' ? spellingSections : consistencySections;
  const openAccordionCategory =
    viewSource === 'spelling'
      ? openSpellingCategory
      : openConsistencyCategory;
  const findingsEntriesAll =
    viewSource === 'spelling' ? spellingEntriesAll : consistencyEntriesAll;
  const visibleTotalFindings = sumVisibleFindings(
    findingsEntriesAll,
    visibleInstanceCount,
  );
  const totalFindingsFromEntries = sumVisibleFindings(findingsEntriesAll);

  return (
    <section
      className={`results-panel results-panel--combined results-panel--${viewSource} results-panel--tone-${spellingTone}`}
    >
      {displayEntries.length > 0 ? (
        <>
          <ResultHeaderSummary
            viewSource={viewSource}
            spellingCheckDone={spellingCheckDone}
            ruleCount={ruleCount}
            totalFindings={totalFindingsFromEntries}
            visibleTotalFindings={visibleTotalFindings}
          />
          <div
            className="results-accordion"
            key={`${viewSource}-acc-${totalFindings}`}
          >
            {accordionSections.map((section) => (
              <details
                key={section.id}
                className={`results-category results-category--${section.id}`}
                ref={detailsOpenOnceRef(openAccordionCategory === section.id)}
              >
                <summary className="results-category__summary panel-criteria-heading">
                  <DetailsChevron />
                  <ResultsCategorySelectAll
                    label={section.label}
                    entries={section.entries}
                    isGroupVisible={isGroupVisible}
                    onToggleVisibility={onToggleVisibility}
                  />
                  <span className="results-category__label">
                    {section.label}
                    {section.id === 'auxiliary'
                      ? (() => {
                          const solidTotal = section.entries.reduce(
                            (n, entry) =>
                              n +
                              (entry.group.instances ?? []).filter(
                                isAuxiliaryDictSolidInstance,
                              ).length,
                            0,
                          );
                          if (solidTotal <= 0) return null;
                          return (
                            <span className="aux-solid-count">
                              합성어
                              <ResultFindingsCountCircle
                                count={solidTotal}
                                ariaLabel={`합성어 ${solidTotal}`}
                              />
                            </span>
                          );
                        })()
                      : null}
                  </span>
                  <span className="results-category__meta results-findings-meta">
                    <span className="results-findings-meta__label">
                      <span className="results-category__criteria-num">
                        {section.criteriaCount}
                      </span>
                      <span className="results-category__criteria-unit">
                        기준
                      </span>
                    </span>
                    <ResultFindingsCountCircle
                      count={section.findingsTotal}
                      shownCount={section.findingsCount}
                      className="results-category__findings"
                    />
                  </span>
                </summary>
                <ul className="results-list results-list--nested">
                  {section.id === 'common'
                    ? interleavePhraseSlotStemStyleSignals(section.entries).map(
                        (row) => {
                          if (row.kind === 'stem-signal') {
                            const { signal } = row;
                            return (
                              <li
                                key={`stem-signal-${signal.stem}`}
                                className="phrase-slot-stem-signal"
                                data-stem={signal.stem}
                                data-mixed={signal.mixed ? '1' : '0'}
                              >
                                <span className="phrase-slot-stem-signal__stem">
                                  {signal.stem}
                                </span>
                                <span className="phrase-slot-stem-signal__counts">
                                  {formatPhraseSlotStemStyleSignalText(signal)}
                                </span>
                              </li>
                            );
                          }
                          return renderResultEntry(row.entry);
                        },
                      )
                    : section.entries.map(renderResultEntry)}
                </ul>
              </details>
            ))}
          </div>
        </>
      ) : (
        <p className="hint results-empty-hint">발견된 항목이 없습니다.</p>
      )}
    </section>
  );
}
