import { useEffect, useRef } from 'react';
import { BUILT_IN_RULES, isBuiltInRuleEnabled } from '../lib/builtInRules.js';
import DetailsChevron from './DetailsChevron.jsx';

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   onBuiltInToggle: (find: string) => void,
 *   onBuiltInSetAll: (enabled: boolean) => void,
 * }} props
 */
export default function BuiltinSpellingPanel({
  builtInEnabled,
  onBuiltInToggle,
  onBuiltInSetAll,
}) {
  const selectAllRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const total = BUILT_IN_RULES.length;
  const enabled = BUILT_IN_RULES.filter((r) =>
    isBuiltInRuleEnabled(builtInEnabled, r.find),
  ).length;
  const allChecked = total > 0 && enabled === total;
  const someChecked = enabled > 0 && enabled < total;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  return (
    <details className="builtin-spelling-details" open>
      <summary className="builtin-spelling-summary">
        <DetailsChevron />
        <label
          className="builtin-spelling-select-all"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => onBuiltInSetAll(!allChecked)}
            aria-label="내장 맞춤법 규칙 전체 선택"
          />
        </label>
        <span className="builtin-spelling-summary-title">
          내장 맞춤법 규칙 ({enabled}/{total})
        </span>
      </summary>
      <p className="hint" style={{ margin: '8px 0 10px' }}>
        체크한 규칙만 PDF 검사에 사용합니다. Google 시트에서 관리 ·{' '}
        <code>npm run sync-spelling</code> 후 반영
      </p>
      <ul className="rule-list builtin-rule-list">
        {BUILT_IN_RULES.map((rule) => {
          const tip = (rule.tip || '').trim();
          return (
            <li key={rule.find} className="builtin-rule-row-wrap">
              <div className="rule-row builtin-rule-row">
                <input
                  type="checkbox"
                  checked={isBuiltInRuleEnabled(builtInEnabled, rule.find)}
                  onChange={() => onBuiltInToggle(rule.find)}
                />
                <div className="rule-text builtin-rule-text">
                  <span className="find">{rule.find}</span>
                  <span className="arrow">→</span>
                  <span className="replace">{rule.replace}</span>
                  {tip ? (
                    <span className="builtin-rule-tip-inline">{tip}</span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
