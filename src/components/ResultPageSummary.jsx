import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { instanceVisibilityKey, instancesMatch } from '../lib/checkResultUtils.js';

/**
 * @typedef {{
 *   inst: import('../lib/ruleEngine.js').MatchInstance,
 *   indexOnPage: number,
 *   totalOnPage: number,
 * }} InstanceChipEntry
 */

/**
 * @param {import('../lib/ruleEngine.js').MatchInstance[]} instances
 * @returns {InstanceChipEntry[]}
 */
function buildInstanceChips(instances) {
  const byPage = new Map();
  for (const inst of instances) {
    const list = byPage.get(inst.pageNum) ?? [];
    list.push(inst);
    byPage.set(inst.pageNum, list);
  }

  /** @type {InstanceChipEntry[]} */
  const chips = [];
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageInstances = byPage.get(pageNum) ?? [];
    pageInstances.sort((a, b) => a.index - b.index);
    const totalOnPage = pageInstances.length;
    pageInstances.forEach((inst, i) => {
      chips.push({ inst, indexOnPage: i + 1, totalOnPage });
    });
  }
  return chips;
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
  const chips = buildInstanceChips(instances);

  if (!chips.length) return null;

  return (
    <div className="result-pages" role="list">
      {chips.map(({ inst, indexOnPage, totalOnPage }) => (
        <InstanceChip
          key={instanceVisibilityKey(inst)}
          inst={inst}
          indexOnPage={indexOnPage}
          totalOnPage={totalOnPage}
          currentPage={currentPage}
          selectedInstance={selectedInstance}
          formatPageLabel={formatPageLabel}
          isInstanceVisible={isInstanceVisible}
          onSelectPage={onSelectPage}
          onSelectInstance={onSelectInstance}
          onToggleInstanceVisibility={onToggleInstanceVisibility}
        />
      ))}
    </div>
  );
}

/**
 * @param {{
 *   inst: import('../lib/ruleEngine.js').MatchInstance,
 *   indexOnPage: number,
 *   totalOnPage: number,
 *   currentPage: number,
 *   selectedInstance: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
function InstanceChip({
  inst,
  indexOnPage,
  totalOnPage,
  currentPage,
  selectedInstance,
  formatPageLabel,
  isInstanceVisible,
  onSelectPage,
  onSelectInstance,
  onToggleInstanceVisibility,
}) {
  const visible = isInstanceVisible(inst);
  const selected =
    selectedInstance != null && instancesMatch(inst, selectedInstance);
  const countLabel =
    totalOnPage > 1 ? `(${indexOnPage}/${totalOnPage})` : '';

  function navigateToInstance() {
    if (onSelectInstance) onSelectInstance(inst);
    else onSelectPage(inst.pageNum);
  }

  return (
    <div className="result-page-chip-wrap" role="listitem">
      <button
        type="button"
        className={`page-chip${selected ? ' page-chip--current' : ''}${
          !visible ? ' page-chip--hidden-instance' : ''
        }`}
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
        {formatPageLabel(inst.pageNum)}
        {countLabel}
      </button>
    </div>
  );
}
