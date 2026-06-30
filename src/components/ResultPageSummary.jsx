import { useEffect, useMemo, useState } from 'react';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { instanceVisibilityKey, instancesMatch } from '../lib/checkResultUtils.js';

const RESULT_PILL_COLLAPSE_THRESHOLD = 15;

/**
 * @typedef {{
 *   inst: import('../lib/ruleEngine.js').MatchInstance,
 *   indexOnPage: number,
 *   totalOnPage: number,
 * }} InstancePillEntry
 */

/**
 * @param {import('../lib/ruleEngine.js').MatchInstance[]} instances
 * @returns {InstancePillEntry[]}
 */
export function buildInstancePills(instances) {
  const byPage = new Map();
  for (const inst of instances) {
    const list = byPage.get(inst.pageNum) ?? [];
    list.push(inst);
    byPage.set(inst.pageNum, list);
  }

  /** @type {InstancePillEntry[]} */
  const pills = [];
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageInstances = byPage.get(pageNum) ?? [];
    const totalOnPage = pageInstances.length;
    pageInstances.forEach((inst, index) => {
      pills.push({
        inst,
        indexOnPage: index + 1,
        totalOnPage,
      });
    });
  }
  return pills;
}

/**
 * @param {number} indexOnPage
 * @param {number} totalOnPage
 * @returns {string | null}
 */
export function getInstanceFragmentLabel(indexOnPage, totalOnPage) {
  if (totalOnPage <= 1) return null;
  return `${indexOnPage}/${totalOnPage}`;
}

/**
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   selectedInstance?: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel?: (systemPage: number) => string,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   isInstanceVisible?: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
export default function ResultPageSummary({
  instances,
  currentPage,
  selectedInstance = null,
  formatPageLabel = formatSystemPageLabel,
  onSelectPage,
  onSelectInstance,
  isInstanceVisible = () => true,
  onToggleInstanceVisibility,
}) {
  const pills = useMemo(() => buildInstancePills(instances), [instances]);
  const pillsSignature = useMemo(
    () => pills.map((entry) => instanceVisibilityKey(entry.inst)).join('\0'),
    [pills],
  );
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [pillsSignature]);

  useEffect(() => {
    if (expanded) return;
    if (!selectedInstance || pills.length <= RESULT_PILL_COLLAPSE_THRESHOLD) {
      return;
    }
    const selectedIndex = pills.findIndex((entry) =>
      instancesMatch(entry.inst, selectedInstance),
    );
    if (selectedIndex >= RESULT_PILL_COLLAPSE_THRESHOLD) {
      setExpanded(true);
    }
  }, [pills, selectedInstance, expanded]);

  if (!pills.length) return null;

  const needsCollapse = pills.length > RESULT_PILL_COLLAPSE_THRESHOLD;
  const visiblePills =
    needsCollapse && !expanded
      ? pills.slice(0, RESULT_PILL_COLLAPSE_THRESHOLD)
      : pills;
  const hiddenPills =
    needsCollapse && !expanded
      ? pills.slice(RESULT_PILL_COLLAPSE_THRESHOLD)
      : [];
  const hiddenCount = hiddenPills.length;

  return (
    <div className="result-pages" role="list">
      {visiblePills.map((entry) => (
        <InstancePill
          key={instanceVisibilityKey(entry.inst)}
          entry={entry}
          currentPage={currentPage}
          selectedInstance={selectedInstance}
          formatPageLabel={formatPageLabel}
          isInstanceVisible={isInstanceVisible}
          onSelectPage={onSelectPage}
          onSelectInstance={onSelectInstance}
          onToggleInstanceVisibility={onToggleInstanceVisibility}
        />
      ))}
      {needsCollapse ? (
        <div
          className="result-page-chip-wrap"
          role="listitem"
        >
          <button
            type="button"
            className="result-pages-expand-btn"
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((open) => !open);
            }}
          >
            {expanded ? '접기' : `＋ ${hiddenCount}개 더 보기`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   entry: InstancePillEntry,
 *   currentPage: number,
 *   selectedInstance: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
function InstancePill({
  entry,
  currentPage,
  selectedInstance,
  formatPageLabel,
  isInstanceVisible,
  onSelectPage,
  onSelectInstance,
  onToggleInstanceVisibility,
}) {
  const { inst, indexOnPage, totalOnPage } = entry;
  const fragmentLabel = getInstanceFragmentLabel(indexOnPage, totalOnPage);
  const visible = isInstanceVisible(inst);
  const selected =
    selectedInstance != null && instancesMatch(inst, selectedInstance);
  const onCurrentPage = inst.pageNum === currentPage;

  function navigateToInstance() {
    if (onSelectInstance) onSelectInstance(inst);
    else onSelectPage(inst.pageNum);
  }

  return (
    <div className="result-page-chip-wrap" role="listitem">
      <button
        type="button"
        className={`page-chip${selected ? ' page-chip--current' : ''}${
          onCurrentPage && !selected ? ' page-chip--on-page' : ''
        }${!visible ? ' page-chip--hidden-instance' : ''}`}
        title={
          onToggleInstanceVisibility
            ? visible
              ? '좌클릭: 해당 위치로 이동 · 우클릭: 표시 제외'
              : '좌클릭: 해당 위치로 이동 · 우클릭: 표시 복원'
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          navigateToInstance();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (onToggleInstanceVisibility) {
            onToggleInstanceVisibility(inst);
          }
        }}
      >
        <span className="page-chip__page">{formatPageLabel(inst.pageNum)}</span>
        {fragmentLabel ? (
          <span className="page-chip__bundle page-chip__bundle--fragment">
            {fragmentLabel}
          </span>
        ) : null}
      </button>
    </div>
  );
}
