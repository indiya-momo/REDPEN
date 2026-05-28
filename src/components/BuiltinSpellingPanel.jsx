import { useEffect, useRef, useState } from 'react';
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
  const [activeTipByGroup, setActiveTipByGroup] = useState(
    /** @type {Record<string, string | null>} */ ({}),
  );
  const quotaRules = BUILT_IN_QUOTA_RULES_UI;
  const guideRules = BUILT_IN_GUIDE_RULES_UI;
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

  /**
   * dividerGroup이 있으면 같은 키끼리 묶고, 없으면 단독 묶음으로 처리
   * @param {import('../lib/ruleTypes.js').Rule[]} rules
   */
  function groupRulesByDivider(rules) {
    /** @type {{ key: string, rules: import('../lib/ruleTypes.js').Rule[] }[]} */
    const groups = [];
    for (let i = 0; i < rules.length; i += 1) {
      const rule = rules[i];
      const key = String(rule.dividerGroup ?? '').trim();
      if (!key) {
        groups.push({ key: `__single_${rule.find}_${i}`, rules: [rule] });
        continue;
      }
      const prev = groups[groups.length - 1];
      if (prev && prev.key === key) {
        prev.rules.push(rule);
      } else {
        groups.push({ key, rules: [rule] });
      }
    }
    return groups;
  }

  /**
   * @param {import('../lib/ruleTypes.js').Rule} rule
   * @param {boolean} tipOpen
   * @param {() => void} onToggleTip
   */
  function renderRuleRow(rule, tipOpen, onToggleTip) {
    const tip = (rule.tip || '').trim();
    const noQuota = !countsTowardSpellingQuota(rule);
    const useInlineTipToggle = Boolean(tip);
    return (
      <div
        key={rule.find}
        className={`builtin-rule-row-wrap builtin-rule-item${noQuota ? ' builtin-rule-row-wrap--no-quota' : ''}${useInlineTipToggle ? ' builtin-rule-row-wrap--inline-trigger' : ''}`}
      >
        <div className="rule-row builtin-rule-row">
          <input
            type="checkbox"
            checked={isBuiltInRuleEnabled(builtInEnabled, rule.find)}
            onChange={() => onBuiltInToggle(rule.find)}
          />
          <div
            className={`rule-text builtin-rule-text${useInlineTipToggle ? ' builtin-inline-tip-hoverable' : ''}${useInlineTipToggle && tipOpen ? ' builtin-inline-tip-hoverable--open' : ''}`}
          >
            <span className="find">{rule.find}</span>
            <span className="arrow">→</span>
            {useInlineTipToggle ? (
              <span
                className="replace builtin-inline-tip-trigger"
                data-hover-tip="설명"
                onClick={onToggleTip}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggleTip();
                  }
                }}
              >
                {rule.replace}
              </span>
            ) : (
              <span className="replace">{rule.replace}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * @param {{ key: string, rules: import('../lib/ruleTypes.js').Rule[] }[]} groups
   * @param {'guide' | 'quota'} scope
   */
  function renderRuleGroups(groups, scope) {
    return groups.map((group, index) => {
      const groupStateKey = `${scope}:${group.key}`;
      const activeFind = activeTipByGroup[groupStateKey] ?? null;
      const next = groups[index + 1];
      const currentKey = String(group.rules[0]?.dividerGroup ?? '').trim();
      const nextKey = String(next?.rules?.[0]?.dividerGroup ?? '').trim();
      const showDividerAfter =
        currentKey !== '' && nextKey !== '' && currentKey !== nextKey;
      const activeRule =
        activeFind && group.rules.some((r) => r.find === activeFind)
          ? group.rules.find((r) => r.find === activeFind) ?? null
          : null;
      const activeTip = String(activeRule?.tip ?? '').trim();
      return (
        <li
          key={group.key}
          className={`builtin-rule-group${showDividerAfter ? ' builtin-rule-group--divider-after' : ''}${activeTip ? ' builtin-rule-group--tip-open' : ''}`}
        >
          {group.rules.map((rule) => {
            const tipOpen = activeFind === rule.find;
            return (
              <div key={rule.find} className="builtin-rule-entry">
                {renderRuleRow(
                  rule,
                  tipOpen,
                  () =>
                    setActiveTipByGroup((prev) => ({
                      ...prev,
                      [groupStateKey]:
                        prev[groupStateKey] === rule.find ? null : rule.find,
                    })),
                )}
              </div>
            );
          })}
          {activeTip ? <div className="builtin-rule-tip-inline">{activeTip}</div> : null}
        </li>
      );
    });
  }

  return (
    <details className="builtin-spelling-details">
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
          맞춤법 기준 (선택 {enabled}/{total})
        </span>
      </summary>
      {guideRules.length > 0 ? (
        <>
          <ul className="rule-list builtin-rule-list builtin-rule-list--guide">
            {renderRuleGroups(groupRulesByDivider(guideRules), 'guide')}
          </ul>
        </>
      ) : null}
      <ul className="rule-list builtin-rule-list">
        {renderRuleGroups(groupRulesByDivider(quotaRules), 'quota')}
      </ul>
    </details>
  );
}
