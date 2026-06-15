import { useCallback, useEffect, useRef, useState } from 'react';
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
 * @typedef {{
 *   inst: import('../lib/ruleEngine.js').MatchInstance,
 *   x: number,
 *   y: number,
 * }} InstanceContextMenu
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
  const [contextMenu, setContextMenu] = useState(
    /** @type {InstanceContextMenu | null} */ (null),
  );
  const contextMenuRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chips = buildInstanceChips(instances);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (contextMenu == null) return undefined;

    const onDocPointerDown = (event) => {
      const target = /** @type {Node} */ (event.target);
      if (contextMenuRef.current?.contains(target)) return;
      closeContextMenu();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  if (!chips.length) return null;

  return (
    <>
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
            onOpenContextMenu={(event, instance) => {
              if (!onToggleInstanceVisibility) return;
              event.preventDefault();
              event.stopPropagation();
              setContextMenu({
                inst: instance,
                x: event.clientX,
                y: event.clientY,
              });
            }}
          />
        ))}
      </div>
      {contextMenu && onToggleInstanceVisibility ? (
        <div
          ref={contextMenuRef}
          className="result-instance-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label="발견 건 표시"
        >
          <button
            type="button"
            role="menuitem"
            className="result-instance-context-menu__item"
            onClick={(event) => {
              event.stopPropagation();
              onToggleInstanceVisibility(contextMenu.inst);
              closeContextMenu();
            }}
          >
            {isInstanceVisible(contextMenu.inst) ? '표시 제외' : '표시 복원'}
          </button>
        </div>
      ) : null}
    </>
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
 *   onOpenContextMenu: (event: React.MouseEvent, inst: import('../lib/ruleEngine.js').MatchInstance) => void,
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
  onOpenContextMenu,
}) {
  const visible = isInstanceVisible(inst);
  const selected =
    selectedInstance != null && instancesMatch(inst, selectedInstance);
  const onPage = inst.pageNum === currentPage;
  const countLabel =
    totalOnPage > 1 ? ` (${indexOnPage}/${totalOnPage})` : '';

  return (
    <div className="result-page-chip-wrap" role="listitem">
      <button
        type="button"
        className={`page-chip${onPage ? ' page-chip--on-page' : ''}${
          selected ? ' page-chip--current' : ''
        }${!visible ? ' page-chip--hidden-instance' : ''}`}
        title={
          onToggleInstanceVisibility
            ? '클릭: 해당 위치로 이동 · 우클릭: 표시 제외'
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          if (onSelectInstance) onSelectInstance(inst);
          else onSelectPage(inst.pageNum);
        }}
        onContextMenu={(event) => onOpenContextMenu(event, inst)}
      >
        {formatPageLabel(inst.pageNum)}
        {countLabel}
      </button>
    </div>
  );
}
