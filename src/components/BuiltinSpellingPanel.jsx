import { useState } from 'react';
import { BUILT_IN_RULES } from '../lib/builtInRules.js';

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   onBuiltInToggle: (find: string) => void,
 * }} props
 */
export default function BuiltinSpellingPanel({ builtInEnabled, onBuiltInToggle }) {
  const enabled = BUILT_IN_RULES.filter((r) => builtInEnabled[r.find] !== false).length;
  const [openTipFind, setOpenTipFind] = useState(null);

  return (
    <details className="builtin-spelling-details">
      <summary className="builtin-spelling-summary">
        내장 맞춤법 규칙 ({enabled}/{BUILT_IN_RULES.length})
      </summary>
      <p className="hint" style={{ margin: '8px 0 10px' }}>
        Google 시트에서 관리 · <code>npm run sync-spelling</code> 후 반영
      </p>
      <ul className="rule-list builtin-rule-list">
        {BUILT_IN_RULES.map((rule) => {
          const tip = (rule.tip || '').trim();
          const tipOpen = openTipFind === rule.find;
          return (
            <li key={rule.find} className="builtin-rule-row-wrap">
              <div className="rule-row builtin-rule-row">
                <input
                  type="checkbox"
                  checked={builtInEnabled[rule.find] !== false}
                  onChange={() => onBuiltInToggle(rule.find)}
                />
                <div className="rule-text builtin-rule-text">
                  <span className="find">{rule.find}</span>
                  <span className="arrow">→</span>
                  <span className="replace">{rule.replace}</span>
                </div>
                {tip ? (
                  <button
                    type="button"
                    className={`tip-toggle-btn ${tipOpen ? 'tip-toggle-btn--open' : ''}`}
                    aria-expanded={tipOpen}
                    aria-label="규칙 설명 보기"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setOpenTipFind((prev) =>
                        prev === rule.find ? null : rule.find,
                      );
                    }}
                  >
                    설명
                  </button>
                ) : null}
              </div>
              {tip && tipOpen && (
                <p className="tip-toggle-body builtin-rule-tip-body">{tip}</p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
