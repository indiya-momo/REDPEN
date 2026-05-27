import { useEffect, useRef } from 'react';
import {
  BUILT_IN_GUIDE_RULES_UI,
  BUILT_IN_QUOTA_RULES_UI,
  countsTowardSpellingQuota,
  isBuiltInRuleEnabled,
} from '../lib/builtInRules.js';
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
  const quotaRules = BUILT_IN_QUOTA_RULES_UI;
  const guideRules = BUILT_IN_GUIDE_RULES_UI;
  const guideEnabled = guideRules.filter((r) =>
    isBuiltInRuleEnabled(builtInEnabled, r.find),
  ).length;
  const total = quotaRules.length;
  const enabled = quotaRules.filter((r) =>
    isBuiltInRuleEnabled(builtInEnabled, r.find),
  ).length;
  const allChecked = total > 0 && enabled === total;
  const someChecked = enabled > 0 && enabled < total;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  /** @param {import('../lib/ruleTypes.js').Rule} rule */
  function renderRuleRow(rule) {
    const tip = (rule.tip || '').trim();
    const noQuota = !countsTowardSpellingQuota(rule);
    return (
      <li
        key={rule.find}
        className={`builtin-rule-row-wrap${noQuota ? ' builtin-rule-row-wrap--no-quota' : ''}`}
      >
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
  }

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
            aria-label="맞춤법 확인 규칙 전체 선택"
          />
        </label>
        <span className="builtin-spelling-summary-title">
          맞춤법 확인 ({enabled}/{total})
        </span>
      </summary>
      {guideRules.length > 0 ? (
        <>
          <p className="builtin-spelling-guide-heading">
            규칙 제외 · 서비스 ({guideEnabled}/{guideRules.length})
          </p>
          <ul className="rule-list builtin-rule-list builtin-rule-list--guide">
            {guideRules.map(renderRuleRow)}
          </ul>
        </>
      ) : null}
      <ul className="rule-list builtin-rule-list">
        {quotaRules.map(renderRuleRow)}
      </ul>
    </details>
  );
}
