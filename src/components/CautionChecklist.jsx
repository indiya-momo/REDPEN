import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { buildCautionRuleBundles } from '../lib/cautionRuleBundles.js';
import {
  CAUTION_GROUPS,
  CAUTION_SEARCH_RULES,
  cautionDisplayLabel,
  cautionItemTip,
} from '../lib/cautionRules.js';
import { STANDARD_KOREAN_DICT_URL } from '../lib/koreanNormsLinks.js';
import DetailsChevron from './DetailsChevron.jsx';

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
 *   guideSpotlight?: boolean,
 * }} props
 */
export default function CautionChecklist({
  cautionEnabled,
  onCautionToggle,
  onCautionSetAll,
  guideSpotlight = false,
}) {
  const selectAllRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [activeTipByBundle, setActiveTipByBundle] = useState(
    /** @type {Record<string, string | null>} */ ({}),
  );
  const total = CAUTION_SEARCH_RULES.length;
  const activeCount = CAUTION_SEARCH_RULES.filter(
    (r) => cautionEnabled[r.id] === true,
  ).length;
  const allChecked = total > 0 && activeCount === total;
  const someChecked = activeCount > 0 && activeCount < total;

  const bundles = useMemo(
    () => buildCautionRuleBundles(CAUTION_GROUPS),
    [],
  );

  let guideTipMarked = false;
  let guideCheckMarked = false;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  /**
   * @param {import('../lib/cautionRules.js').CautionItem} item
   * @param {import('../lib/cautionRules.js').CautionGroup} group
   * @param {boolean} tipOpen
   * @param {() => void} onToggleTip
   */
  function renderCautionChip(item, group, tipOpen, onToggleTip) {
    const label = cautionDisplayLabel(item);
    const explanation = itemExplanation(item, group);
    const canShowTip = Boolean(explanation);
    const markGuideTip = guideSpotlight && canShowTip && !guideTipMarked;
    if (markGuideTip) guideTipMarked = true;
    const markGuideCheck = guideSpotlight && !guideCheckMarked;
    if (markGuideCheck) guideCheckMarked = true;

    return (
      <div className="caution-chip-entry-wrap">
        <div className="caution-chip-entry">
          <div className="caution-chip">
            <input
              type="checkbox"
              checked={cautionEnabled[item.id] === true}
              onChange={() => onCautionToggle(item.id)}
              data-work-guide={markGuideCheck ? 'criteria-checkbox' : undefined}
            />
            {canShowTip ? (
              <span
                className={`caution-chip-label caution-inline-tip-trigger${tipOpen ? ' caution-inline-tip-trigger--open' : ''}`}
                data-hover-tip="설명"
                data-work-guide={markGuideTip ? 'criteria-tip' : undefined}
                role="button"
                tabIndex={0}
                onClick={onToggleTip}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleTip();
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
   * @param {{ item: import('../lib/cautionRules.js').CautionItem, group: import('../lib/cautionRules.js').CautionGroup }[]} entries
   * @param {string} bundleStateKey
   */
  function renderBundleItems(entries, bundleStateKey) {
    const cols = 3;
    const activeId = activeTipByBundle[bundleStateKey] ?? null;
    const activeEntry =
      activeId && entries.some(({ item }) => item.id === activeId)
        ? entries.find(({ item }) => item.id === activeId) ?? null
        : null;
    const activeTip = activeEntry
      ? itemExplanation(activeEntry.item, activeEntry.group)
      : '';
    const activeIndex = activeId
      ? entries.findIndex(({ item }) => item.id === activeId)
      : -1;
    const rowEndIndex =
      activeIndex >= 0
        ? Math.min(
            entries.length - 1,
            Math.floor(activeIndex / cols) * cols + (cols - 1),
          )
        : -1;
    const afterId =
      rowEndIndex >= 0 ? entries[rowEndIndex]?.item.id : null;

    return (
      <div className={`caution-group-items caution-group-items--cols-${cols}`}>
        {entries.map(({ item, group }) => {
          const tipOpen = activeId === item.id;
          return (
            <Fragment key={item.id}>
              {renderCautionChip(item, group, tipOpen, () =>
                setActiveTipByBundle((prev) => ({
                  ...prev,
                  [bundleStateKey]:
                    prev[bundleStateKey] === item.id ? null : item.id,
                })),
              )}
              {activeTip && afterId === item.id ? (
                <div className="caution-tip-inline">{activeTip}</div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <details className="caution-checklist-details" open>
      <summary
        className="caution-checklist-summary panel-criteria-heading"
        data-work-guide="criteria-caution-heading"
      >
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
          편집자 검토 필요
          <span className="panel-criteria-heading-meta">
            {`(${activeCount}/${total})`}
          </span>
          <a
            className="panel-criteria-source-link"
            href={STANDARD_KOREAN_DICT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            표준국어대사전
          </a>
        </span>
      </summary>
      <ul className="caution-checklist caution-checklist--bundles">
        {bundles.map((bundle) => {
          const bundleStateKey = `caution:${bundle.id}`;
          const bundleActive = bundle.entries.filter(
            ({ item }) => cautionEnabled[item.id] === true,
          ).length;

          return (
            <li key={bundle.id} className="caution-rule-bundle-item">
              <details className="caution-rule-bundle">
                <summary className="caution-rule-bundle-summary">
                  <DetailsChevron />
                  <span className="caution-rule-bundle-icon" aria-hidden="true">
                    📁
                  </span>
                  <span className="caution-rule-bundle-title">{bundle.label}</span>
                  <span className="caution-rule-bundle-meta">
                    {`${bundleActive}/${bundle.ruleCount}`}
                  </span>
                </summary>
                <div className="caution-rule-bundle-body">
                  {renderBundleItems(bundle.entries, bundleStateKey)}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
