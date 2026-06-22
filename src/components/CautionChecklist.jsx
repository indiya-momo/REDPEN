import { Fragment, useEffect, useRef, useState } from 'react';
import {
  CAUTION_GROUPS,
  CAUTION_SEARCH_RULES,
  cautionDisplayLabel,
  cautionItemTip,
  isCautionSearchItem,
} from '../lib/cautionRules.js';
import DetailsChevron from './DetailsChevron.jsx';

/** @param {{ title?: string, tip?: string }} group */
function groupHeading(group) {
  const title = String(group.title ?? '').trim();
  if (title) return title;
  const tip = String(group.tip ?? '').trim();
  if (tip && tip.length <= 20 && !tip.includes('\n')) return tip;
  return '';
}

/**
 * @param {import('../lib/cautionRules.js').CautionItem} item
 * @param {import('../lib/cautionRules.js').CautionGroup} group
 */
function itemExplanation(item, group) {
  return cautionItemTip(item, group);
}

/**
 * @param {{
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 *   onCautionSetAll: (enabled: boolean) => void,
 * }} props
 */
export default function CautionChecklist({
  cautionEnabled,
  onCautionToggle,
  onCautionSetAll,
}) {
  const selectAllRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [activeTipByGroup, setActiveTipByGroup] = useState(
    /** @type {Record<string, string | null>} */ ({}),
  );
  const total = CAUTION_SEARCH_RULES.length;
  const activeCount = CAUTION_SEARCH_RULES.filter(
    (r) => cautionEnabled[r.id] === true,
  ).length;
  const allChecked = total > 0 && activeCount === total;
  const someChecked = activeCount > 0 && activeCount < total;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  /**
   * @param {import('../lib/cautionRules.js').CautionItem} item
   * @param {import('../lib/cautionRules.js').CautionGroup} group
   * @param {string | null} activeId
   */
  function renderCautionChip(item, group, activeId) {
    const label = cautionDisplayLabel(item);
    const explanation = itemExplanation(item, group);
    const tipOpen = activeId === item.id;
    const canShowTip = Boolean(explanation);
    const toggleTip = () =>
      setActiveTipByGroup((prev) => ({
        ...prev,
        [group.id]: prev[group.id] === item.id ? null : item.id,
      }));

    return (
      <div key={item.id} className="caution-chip-entry-wrap">
        <div className="caution-chip-entry">
          <div className="caution-chip">
            <input
              type="checkbox"
              checked={cautionEnabled[item.id] === true}
              onChange={() => onCautionToggle(item.id)}
            />
            {canShowTip ? (
              <span
                className={`caution-chip-label caution-inline-tip-trigger${tipOpen ? ' caution-inline-tip-trigger--open' : ''}`}
                data-hover-tip="설명"
                role="button"
                tabIndex={0}
                onClick={toggleTip}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTip();
                  }
                }}
                aria-expanded={tipOpen}
              >
                {label}
              </span>
            ) : (
              <span className="caution-chip-label">{label}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * @param {import('../lib/cautionRules.js').CautionItem[]} items
   * @param {import('../lib/cautionRules.js').CautionGroup} group
   */
  function renderCautionItems(items, group) {
    const activeId = activeTipByGroup[group.id] ?? null;
    const cols = 3;
    const activeItem =
      activeId && items.some((item) => item.id === activeId)
        ? items.find((item) => item.id === activeId) ?? null
        : null;
    const activeTip = activeItem ? itemExplanation(activeItem, group) : '';

    /** @type {import('../lib/cautionRules.js').CautionItem[][]} */
    const rows = [];
    for (let i = 0; i < items.length; i += cols) {
      rows.push(items.slice(i, i + cols));
    }

    return (
      <div
        className={`caution-group-items caution-group-items--cols-${cols}`}
      >
        {rows.map((rowItems, rowIndex) => {
          const rowShowsTip =
            Boolean(activeTip) &&
            rowItems.some((item) => item.id === activeId);
          return (
            <Fragment key={`${group.id}-row-${rowIndex}`}>
              {rowItems.map((item) => renderCautionChip(item, group, activeId))}
              {rowShowsTip ? (
                <div className="caution-tip-inline">{activeTip}</div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <details className="caution-checklist-details">
      <summary className="caution-checklist-summary panel-criteria-heading">
        <DetailsChevron />
        <label
          className="caution-checklist-select-all"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => onCautionSetAll(!allChecked)}
            aria-label="편집자 검토 필요 전체 선택"
          />
        </label>
        <span className="caution-checklist-summary-title">
          편집자 검토 필요(선택 {activeCount}/{total})
          <span className="criteria-summary-note">※ 계속 추가 중</span>
        </span>
      </summary>
      <ul className="caution-checklist">
        {CAUTION_GROUPS.map((group) => {
          const heading = groupHeading(group);
          const items = group.items.filter(isCautionSearchItem);
          if (!items.length) return null;
          const showTitle = Boolean(heading) && group.hideGroupTitle !== true;
          return (
            <li key={group.id} className="caution-group">
              <div className="caution-group-top">
                {showTitle ? (
                  <span className="caution-group-title">{heading}</span>
                ) : null}
                {renderCautionItems(items, group)}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
