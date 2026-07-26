import ResultPageSummary from './ResultPageSummary.jsx';
import GroupVisibilityCheckbox from './GroupVisibilityCheckbox.jsx';
import DetailsChevron from './DetailsChevron.jsx';
import { useEffect, useMemo, useRef } from 'react';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { cautionResultChipLabel } from '../lib/cautionRules.js';
import { getConsistencyHighlightTip, getConsistencyResultCardParts } from '../lib/consistencyHighlightTip.js';
import { isConsistencyUnifyResultGroup } from '../lib/consistencyUnifyRegister.js';
import { AUXILIARY_VERB_BADGE_LABEL } from '../lib/bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from '../lib/consistencyRuleLimit.js';
import {
  resultBadgeTone,
  resultPillarToneClass,
} from '../lib/resultPillarTone.js';
import {
  formatResultsStatCount,
  EDITOR_REVIEW_BADGE_LABEL,
  SPELLING_RULE_BADGE_LABEL,
  LOANWORD_BADGE_LABEL,
} from '../lib/checkResultSummaryFormat.js';
import {
  defaultOpenSpellingCategory,
  partitionSpellingResultEntries,
  sumVisibleFindings,
  countGroupsWithVisibleFindings,
} from '../lib/checkResultsAccordion.js';

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
  return (
    <span
      className={`result-findings-count-circle ${className}`.trim()}
      aria-label={
        ariaLabel ??
        (partial ? `표시 ${shownCount}건 / 전체 ${count}건` : `${count}건`)
      }
      title={partial ? `표시 ${shownCount}/${count}` : undefined}
    >
      {shownCount}
    </span>
  );
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
 * @param {{
 *   badge: string,
 *   count: number,
 *   findingsCount: number,
 *   tone?: import('../lib/resultPillarTone.js').ResultBadgeTone,
 * }} props
 */
function ResultHeaderStat({ badge, count, findingsCount, tone }) {
  const toneClass = tone ? resultPillarToneClass(tone) : '';
  return (
    <span className="results-header__stat">
      <span className={`results-header-badge ${toneClass}`.trim()}>{badge}</span>
      <span className="results-header__stat-count" aria-label={formatResultsStatCount(count)}>
        <span className="results-header__stat-num">{count}</span>
        <span className="results-header__stat-unit">기준</span>
      </span>
      <ResultFindingsCountCircle
        count={findingsCount}
        className="results-header__stat-circle"
        ariaLabel={`${findingsCount}건`}
      />
    </span>
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
 *   cautionWithFindingsCount?: number,
 *   builtinWithFindingsCount?: number,
 *   cautionFindingsCount?: number,
 *   builtinFindingsCount?: number,
 *   cautionCriteriaSelected?: boolean,
 *   builtinCriteriaSelected?: boolean,
 *   literalWithFindingsCount?: number,
 *   unifyWithFindingsCount?: number,
 *   commonStringWithFindingsCount?: number,
 *   auxiliaryWithFindingsCount?: number,
 *   literalFindingsCount?: number,
 *   unifyFindingsCount?: number,
 *   commonStringFindingsCount?: number,
 *   auxiliaryFindingsCount?: number,
 *   literalCriteriaSelected?: boolean,
 *   unifyCriteriaSelected?: boolean,
 *   commonStringCriteriaSelected?: boolean,
 *   auxiliaryCriteriaSelected?: boolean,
 * }} props
 */
function ResultHeaderSummary({
  viewSource,
  spellingCheckDone,
  ruleCount,
  totalFindings,
  visibleTotalFindings,
  cautionWithFindingsCount = 0,
  builtinWithFindingsCount = 0,
  loanwordWithFindingsCount = 0,
  cautionFindingsCount = 0,
  builtinFindingsCount = 0,
  loanwordFindingsCount = 0,
  cautionCriteriaSelected = false,
  builtinCriteriaSelected = false,
  loanwordCriteriaSelected = false,
  literalWithFindingsCount = 0,
  unifyWithFindingsCount = 0,
  commonStringWithFindingsCount = 0,
  auxiliaryWithFindingsCount = 0,
  literalFindingsCount = 0,
  unifyFindingsCount = 0,
  commonStringFindingsCount = 0,
  auxiliaryFindingsCount = 0,
  literalCriteriaSelected = false,
  unifyCriteriaSelected = false,
  commonStringCriteriaSelected = false,
  auxiliaryCriteriaSelected = false,
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

  const renderCategoryHeader = (categoryStats) => (
    <div className="results-header">
      <div className="results-header__stats">
        {categoryStats}
      </div>
      {totalFindingsNode}
    </div>
  );

  if (viewSource === 'spelling' && spellingCheckDone) {
    return (
      <div className="results-header results-header--total-only">
        {totalFindingsNode}
      </div>
    );
  }

  if (viewSource === 'consistency' && spellingCheckDone) {
    const categoryStats = [
        literalCriteriaSelected ? (
          <ResultHeaderStat
            key="literal"
            badge={LITERAL_FIND_FEATURE_LABEL}
            count={literalWithFindingsCount}
            findingsCount={literalFindingsCount}
            tone="consistency-literal"
          />
        ) : null,
        unifyCriteriaSelected ? (
          <ResultHeaderStat
            key="unify"
            badge={UNIFY_FEATURE_LABEL}
            count={unifyWithFindingsCount}
            findingsCount={unifyFindingsCount}
            tone="consistency-unify"
          />
        ) : null,
        commonStringCriteriaSelected ? (
          <ResultHeaderStat
            key="common"
            badge="공통 항목 찾기"
            count={commonStringWithFindingsCount}
            findingsCount={commonStringFindingsCount}
            tone="consistency-common"
          />
        ) : null,
        auxiliaryCriteriaSelected ? (
          <ResultHeaderStat
            key="auxiliary"
            badge={AUXILIARY_VERB_BADGE_LABEL}
            count={auxiliaryWithFindingsCount}
            findingsCount={auxiliaryFindingsCount}
            tone="auxiliary"
          />
        ) : null,
    ].filter(Boolean);

    return renderCategoryHeader(categoryStats);
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
 * @param {{
 *   entries: ResultEntry[],
 *   currentPage: number,
 *   activeGroup: import('../lib/ruleEngine.js').GroupedResult | null,
 *   totalFindings: number,
 *   ruleCount: number,
 *   viewSource: 'spelling' | 'consistency',
 *   cautionWithFindingsCount?: number,
 *   builtinWithFindingsCount?: number,
 *   cautionFindingsCount?: number,
 *   builtinFindingsCount?: number,
 *   cautionCriteriaSelected?: boolean,
 *   builtinCriteriaSelected?: boolean,
 *   literalWithFindingsCount?: number,
 *   unifyWithFindingsCount?: number,
 *   commonStringWithFindingsCount?: number,
 *   auxiliaryWithFindingsCount?: number,
 *   literalFindingsCount?: number,
 *   unifyFindingsCount?: number,
 *   commonStringFindingsCount?: number,
 *   auxiliaryFindingsCount?: number,
 *   literalCriteriaSelected?: boolean,
 *   unifyCriteriaSelected?: boolean,
 *   commonStringCriteriaSelected?: boolean,
 *   auxiliaryCriteriaSelected?: boolean,
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
 *   formatPageLabel?: (systemPage: number) => string,
 *   customRules?: import('../lib/ruleTypes.js').Rule[],
 * }} props
 */
export default function CheckResultsPanel({
  entries,
  currentPage,
  activeGroup,
  totalFindings,
  ruleCount,
  viewSource,
  cautionWithFindingsCount = 0,
  builtinWithFindingsCount = 0,
  loanwordWithFindingsCount = 0,
  cautionFindingsCount = 0,
  builtinFindingsCount = 0,
  loanwordFindingsCount = 0,
  cautionCriteriaSelected = false,
  builtinCriteriaSelected = false,
  loanwordCriteriaSelected = false,
  literalWithFindingsCount = 0,
  unifyWithFindingsCount = 0,
  commonStringWithFindingsCount = 0,
  auxiliaryWithFindingsCount = 0,
  literalFindingsCount = 0,
  unifyFindingsCount = 0,
  commonStringFindingsCount = 0,
  auxiliaryFindingsCount = 0,
  literalCriteriaSelected = false,
  unifyCriteriaSelected = false,
  commonStringCriteriaSelected = false,
  auxiliaryCriteriaSelected = false,
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
  formatPageLabel: formatPageLabelProp,
  customRules = [],
}) {
  const pageLabel = formatPageLabelProp ?? formatSystemPageLabel;

  const spellingTone =
    viewSource === 'consistency'
      ? 'consistency'
      : activeGroup?.category === 'caution'
        ? 'caution'
        : 'builtin';

  const spellingParts = useMemo(
    () => partitionSpellingResultEntries(entries),
    [entries],
  );
  const openSpellingCategory = defaultOpenSpellingCategory(spellingParts);

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
    const tipText =
      (group.tip || '').trim() ||
      (source === 'spelling' && !isCaution
        ? getBuiltInTip(group.find, group.replace, group.spellingRuleId)
        : isConsistency
          ? getConsistencyHighlightTip(group, customRules)
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
            </label>
            <div className="result-card-head-main">
              <span className="result-rule">
                {isConsistency ? (() => {
                  const { badge, label } =
                    getConsistencyResultCardParts(group, customRules);
                  const toneClass = resultPillarToneClass(
                    resultBadgeTone('consistency', {
                      patternKind: group.patternKind,
                      isUnify: isConsistencyUnifyResultGroup(
                        customRules,
                        group,
                      ),
                    }),
                  );
                  return (
                    <>
                      <span
                        className={`consistency-badge-inline ${toneClass}`.trim()}
                      >
                        {badge}
                      </span>
                      {label ? (
                        <>
                          {' '}
                          <span className="consistency-result-chip">
                            {label}
                          </span>
                        </>
                      ) : null}
                    </>
                  );
                })() : isCaution ? (
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
          </div>
          {(tipText && !isConsistency) || group.instances.length > 0 ? (
            <div className="result-card-detail">
              {tipText && !isConsistency ? (
                <span className="result-card-tip-inline">{tipText}</span>
              ) : null}
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
          ) : null}
        </div>
      </li>
    );
  };

  /** @type {{ id: 'caution' | 'builtin' | 'loanword', label: string, criteriaCount: number, findingsCount: number, findingsTotal: number, entries: ResultEntry[] }[]} */
  const spellingSections = [
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

  const spellingEntriesAll = [
    ...spellingParts.caution,
    ...spellingParts.builtin,
    ...spellingParts.loanword,
  ];
  const visibleSpellingTotalFindings = sumVisibleFindings(
    spellingEntriesAll,
    visibleInstanceCount,
  );
  const spellingTotalFindingsFromEntries = sumVisibleFindings(spellingEntriesAll);

  return (
    <section
      className={`results-panel results-panel--combined results-panel--${viewSource} results-panel--tone-${spellingTone}`}
    >
      {entries.length > 0 ? (
        <>
          <ResultHeaderSummary
            viewSource={viewSource}
            spellingCheckDone={spellingCheckDone}
            ruleCount={ruleCount}
            totalFindings={
              viewSource === 'spelling'
                ? spellingTotalFindingsFromEntries
                : totalFindings
            }
            visibleTotalFindings={
              viewSource === 'spelling'
                ? visibleSpellingTotalFindings
                : undefined
            }
            cautionWithFindingsCount={cautionWithFindingsCount}
            builtinWithFindingsCount={builtinWithFindingsCount}
            loanwordWithFindingsCount={loanwordWithFindingsCount}
            cautionFindingsCount={cautionFindingsCount}
            builtinFindingsCount={builtinFindingsCount}
            loanwordFindingsCount={loanwordFindingsCount}
            cautionCriteriaSelected={cautionCriteriaSelected}
            builtinCriteriaSelected={builtinCriteriaSelected}
            loanwordCriteriaSelected={loanwordCriteriaSelected}
            literalWithFindingsCount={literalWithFindingsCount}
            unifyWithFindingsCount={unifyWithFindingsCount}
            commonStringWithFindingsCount={commonStringWithFindingsCount}
            auxiliaryWithFindingsCount={auxiliaryWithFindingsCount}
            literalFindingsCount={literalFindingsCount}
            unifyFindingsCount={unifyFindingsCount}
            commonStringFindingsCount={commonStringFindingsCount}
            auxiliaryFindingsCount={auxiliaryFindingsCount}
            literalCriteriaSelected={literalCriteriaSelected}
            unifyCriteriaSelected={unifyCriteriaSelected}
            commonStringCriteriaSelected={commonStringCriteriaSelected}
            auxiliaryCriteriaSelected={auxiliaryCriteriaSelected}
          />
          {viewSource === 'spelling' ? (
            <div className="results-accordion" key={`spelling-acc-${totalFindings}`}>
              {spellingSections.map((section) => (
                <details
                  key={section.id}
                  className="results-category"
                  defaultOpen={openSpellingCategory === section.id}
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
                    {section.entries.map(renderResultEntry)}
                  </ul>
                </details>
              ))}
            </div>
          ) : (
            <ul className="results-list">
              {entries.map(renderResultEntry)}
            </ul>
          )}
        </>
      ) : (
        <p className="hint results-empty-hint">발견된 항목이 없습니다.</p>
      )}
    </section>
  );
}
