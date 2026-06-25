import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILT_IN_GUIDE_RULES_UI,
  BUILT_IN_QUOTA_RULES_UI,
  countsTowardSpellingQuota,
  isBuiltInRuleEnabled,
} from '../lib/builtInRules.js';
import {
  buildSpellingRuleBundles,
  groupRulesByDivider,
} from '../lib/spellingRuleBundles.js';
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

  const groupedGuideRules = useMemo(
    () => groupRulesByDivider(guideRules),
    [guideRules],
  );
  const quotaBundles = useMemo(
    () => buildSpellingRuleBundles(quotaRules),
    [quotaRules],
  );

  /**
   * @param {import('../lib/ruleTypes.js').Rule} rule
   * @param {boolean} tipOpen
   * @param {() => void} onToggleTip
   */
  function renderRuleRow(rule, tipOpen, onToggleTip) {
    const tip = (rule.tip || '').trim();
    const noQuota = !countsTowardSpellingQuota(rule);
    const useInlineTipToggle = Boolean(tip);
    const ruleLine = (
      <>
        <span className="find">{rule.find}</span>
        <span className="arrow">→</span>
        <span className="replace">{rule.replace}</span>
      </>
    );
    return (
      <div
        className={`builtin-rule-row-wrap builtin-rule-item${noQuota ? ' builtin-rule-row-wrap--no-quota' : ''}`}
      >
        <div className="rule-row builtin-rule-row">
          <input
            type="checkbox"
            checked={isBuiltInRuleEnabled(builtInEnabled, rule.find)}
            onChange={() => onBuiltInToggle(rule.find)}
          />
          <div className="rule-text builtin-rule-text">
            {useInlineTipToggle ? (
              <span
                className={`builtin-rule-label caution-inline-tip-trigger${tipOpen ? ' caution-inline-tip-trigger--open' : ''}`}
                data-hover-tip="설명"
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
                {ruleLine}
              </span>
            ) : (
              ruleLine
            )}
          </div>
        </div>
      </div>
    );
  }

  /**
   * @param {import('../lib/ruleTypes.js').Rule[]} rules
   * @param {string} groupStateKey
   */
  function renderRuleGrid(rules, groupStateKey) {
    const cols = 3;
    const activeFind = activeTipByGroup[groupStateKey] ?? null;
    const activeRule =
      activeFind && rules.some((r) => r.find === activeFind)
        ? rules.find((r) => r.find === activeFind) ?? null
        : null;
    const activeTip = String(activeRule?.tip ?? '').trim();
    const activeIndex = activeFind
      ? rules.findIndex((r) => r.find === activeFind)
      : -1;
    const rowEndIndex =
      activeIndex >= 0
        ? Math.min(
            rules.length - 1,
            Math.floor(activeIndex / cols) * cols + (cols - 1),
          )
        : -1;
    const afterFind = rowEndIndex >= 0 ? rules[rowEndIndex]?.find : null;

    return (
      <div className={`builtin-rule-group builtin-rule-group--cols-${cols}`}>
        {rules.map((rule) => {
          const tipOpen = activeFind === rule.find;
          return (
            <Fragment key={rule.find}>
              <div className="builtin-rule-entry-wrap">
                <div className="builtin-rule-entry">
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
              </div>
              {activeTip && afterFind === rule.find ? (
                <div className="builtin-rule-tip-inline">{activeTip}</div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    );
  }

  /**
   * guideRules — 예전 flat 3열 그리드
   * @param {{ key: string, rules: import('../lib/ruleTypes.js').Rule[] }[]} groups
   * @param {'guide' | 'quota'} scope
   */
  function renderFlatRuleGroups(groups, scope) {
    return groups.map((group, index) => {
      const groupStateKey = `${scope}:${group.key}`;
      const next = groups[index + 1];
      const currentKey = String(group.rules[0]?.dividerGroup ?? '').trim();
      const nextKey = String(next?.rules?.[0]?.dividerGroup ?? '').trim();
      const showDividerAfter =
        currentKey !== '' && nextKey !== '' && currentKey !== nextKey;
      return (
        <li
          key={group.key}
          className={showDividerAfter ? 'builtin-rule-group--divider-after' : undefined}
        >
          {renderRuleGrid(group.rules, groupStateKey)}
        </li>
      );
    });
  }

  /**
   * quotaRules — 묶음 아코디언 (기본 접힘, 3열)
   */
  function renderQuotaBundles() {
    return quotaBundles.map((bundle) => {
      const groupStateKey = `quota:${bundle.id}`;

      return (
        <li key={bundle.id} className="builtin-rule-bundle-item">
          <details className="builtin-rule-bundle">
            <summary className="builtin-rule-bundle-summary">
              <DetailsChevron />
              <span className="builtin-rule-bundle-icon" aria-hidden="true">
                📁
              </span>
              <span className="builtin-rule-bundle-title">{bundle.label}</span>
              <span className="builtin-rule-bundle-meta">{bundle.ruleCount}</span>
            </summary>
            <div className="builtin-rule-bundle-body">
              {renderRuleGrid(bundle.rules, groupStateKey)}
            </div>
          </details>
        </li>
      );
    });
  }

  return (
    <details className="builtin-spelling-details">
      <summary className="builtin-spelling-summary panel-criteria-heading">
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
          맞춤법 규칙
          <span className="panel-criteria-heading-meta">
            {`(선택 ${enabled}/${total})`}
          </span>
        </span>
      </summary>
      {guideRules.length > 0 ? (
        <ul className="rule-list builtin-rule-list builtin-rule-list--guide">
          {renderFlatRuleGroups(groupedGuideRules, 'guide')}
        </ul>
      ) : null}
      <ul className="rule-list builtin-rule-list builtin-rule-list--bundles">
        {renderQuotaBundles()}
      </ul>
    </details>
  );
}
