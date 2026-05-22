import {
  CAUTION_GROUPS,
  CAUTION_SEARCH_RULES,
  cautionDisplayLabel,
  isCautionSearchItem,
} from '../lib/cautionRules.js';
import DetailsChevron from './DetailsChevron.jsx';

/**
 * @param {{
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 * }} props
 */
export default function CautionChecklist({ cautionEnabled, onCautionToggle }) {
  const activeCount = CAUTION_SEARCH_RULES.filter(
    (r) => cautionEnabled[r.id] === true,
  ).length;
  return (
    <details className="caution-checklist-details" open>
      <summary className="caution-checklist-summary">
        <DetailsChevron />
        주의: 사용자 직접 판단 (검사 {activeCount}/{CAUTION_SEARCH_RULES.length})
      </summary>
      <p className="hint caution-checklist-hint">
        체크 후 「검사 실행」— 붙임/띄움 후보를 PDF에 표시합니다. 체언·용언은
        직접 판단해야 합니다.
      </p>
      <ul className="caution-checklist">
        {CAUTION_GROUPS.map((group) => {
          const tip = (group.tip || '').trim();
          return (
            <li key={group.id} className="caution-group">
              {tip ? <p className="caution-group-tip caution-group-tip--head">{tip}</p> : null}
              <div className="caution-group-head">
                <div className="caution-group-items">
                  {group.items.filter(isCautionSearchItem).map((item) => (
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
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
