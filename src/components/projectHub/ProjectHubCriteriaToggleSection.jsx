import { useEffect, useRef } from 'react';
import RegisteredList from '../consistency/RegisteredList.jsx';

/**
 * 표기 통일·본용언+보조용언 — 공통 토글 그리드 섹션.
 *
 * @param {{
 *   pillarKey: 'consistency' | 'auxiliary',
 *   ariaLabel: string,
 *   entries: { tailWord: string, displayLabel?: string, bonBojoItemId?: string }[],
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *     enabled: boolean,
 *   ) => void,
 *   onSetAll?: (enabled: boolean) => void,
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 *   criteriaSaving?: boolean,
 * }} props
 */
export default function ProjectHubCriteriaToggleSection({
  pillarKey,
  ariaLabel,
  entries,
  customRules,
  isEnabled,
  onToggle,
  onSetAll,
  isRequired,
  criteriaSaving = false,
}) {
  const selectAllRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const total = entries.length;
  const activeCount = entries.filter((row) =>
    isEnabled(customRules, row),
  ).length;
  const allChecked = total > 0 && activeCount === total;
  const someChecked = activeCount > 0 && activeCount < total;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className={`project-hub-settings__criteria-section project-hub-settings__criteria-section--${pillarKey}`}
        aria-label={ariaLabel}
      >
        {onSetAll ? (
          <label className="project-hub-settings__select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked}
              disabled={criteriaSaving || total === 0}
              onChange={() => onSetAll(!allChecked)}
              aria-label={`${ariaLabel} 전체 선택`}
            />
            <span>모두 선택 또는 취소</span>
          </label>
        ) : null}
        <RegisteredList
          entries={entries}
          customRules={customRules}
          isEnabled={isEnabled}
          onToggle={onToggle}
          variant="auxiliary-grid"
          isRequired={isRequired}
          disabled={criteriaSaving}
        />
      </section>
    </div>
  );
}
