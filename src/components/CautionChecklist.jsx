import { useEffect, useRef } from 'react';
import {
  CAUTION_GROUPS,
  CAUTION_SEARCH_RULES,
  cautionDisplayLabel,
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

/** @param {{ title?: string, tip?: string }} group */
function groupExplanation(group) {
  const title = groupHeading(group);
  const tip = String(group.tip ?? '').trim();
  if (!tip) return '';
  if (title && tip === title) return '';
  if (title) return tip;
  if (tip.includes('\n') || tip.length > 20) return tip;
  return '';
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

  return (
    <details className="caution-checklist-details" open>
      <summary className="caution-checklist-summary">
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
            aria-label="띄어쓰기 검토 규칙 전체 선택"
          />
        </label>
        <span className="caution-checklist-summary-title">
          띄어쓰기 검토 (검사 {activeCount}/{total})
        </span>
      </summary>
      <p className="hint caution-checklist-hint">
        체크한 항목만 PDF에 (검토)로 표시합니다. ap-attach·ap-space는 틀린 쪽만
        잡습니다.
      </p>
      <ul className="caution-checklist">
        {CAUTION_GROUPS.map((group) => {
          const heading = groupHeading(group);
          const explanation = groupExplanation(group);
          const items = group.items.filter(isCautionSearchItem);
          if (!items.length) return null;
          const showTitle = Boolean(heading) && group.hideGroupTitle !== true;
          const tipInline = group.tipInline === true && Boolean(explanation);
          return (
            <li key={group.id} className="caution-group">
              <div className="caution-group-top">
                {showTitle ? (
                  <span className="caution-group-title">{heading}</span>
                ) : null}
                <div className="caution-group-items">
                  {items.map((item) => (
                    <label key={item.id} className="caution-chip">
                      <input
                        type="checkbox"
                        checked={cautionEnabled[item.id] === true}
                        onChange={() => onCautionToggle(item.id)}
                      />
                      <span className="caution-chip-label">
                        {cautionDisplayLabel(item)}
                      </span>
                    </label>
                  ))}
                </div>
                {tipInline ? (
                  <span className="caution-tip-inline">{explanation}</span>
                ) : null}
              </div>
              {explanation && !tipInline ? (
                <p className="caution-group-tip">{explanation}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
