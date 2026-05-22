import { CAUTION_GROUPS, CAUTION_RULES } from '../lib/cautionRules.js';

/**
 * @param {{
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 * }} props
 */
export default function CautionChecklist({ cautionEnabled, onCautionToggle }) {
  const activeCount = CAUTION_RULES.filter(
    (r) => cautionEnabled[r.id] === true,
  ).length;

  return (
    <details className="caution-checklist-details" open>
      <summary className="caution-checklist-summary">
        주의: 사용자 직접 판단 ({activeCount}/{CAUTION_RULES.length})
      </summary>
      <p className="hint caution-checklist-hint">
        체크 후 「검사 실행」— 붙임/띄움 후보를 PDF에 표시합니다. 체언·용언은
        직접 판단해야 합니다.
      </p>
      <ul className="caution-checklist">
        {CAUTION_GROUPS.map((group) => {
          const anyOn = group.items.some(
            (item) => cautionEnabled[item.id] === true,
          );
          return (
            <li key={group.id} className="caution-group">
              <div className="caution-group-head">
                <span className="caution-badge">주의</span>
                <div className="caution-group-items">
                  {group.items.map((item) => (
                    <label key={item.id} className="caution-chip">
                      <input
                        type="checkbox"
                        checked={cautionEnabled[item.id] === true}
                        onChange={() => onCautionToggle(item.id)}
                      />
                      <span className="caution-chip-label">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p
                className={`caution-group-tip ${anyOn ? 'caution-group-tip--active' : ''}`}
              >
                {group.tip}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
