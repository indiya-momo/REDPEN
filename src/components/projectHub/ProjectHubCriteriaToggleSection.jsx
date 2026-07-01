import RegisteredList from '../consistency/RegisteredList.jsx';

/**
 * 표기 통일·본용언+보조용언 — 공통 토글 그리드 섹션.
 *
 * @param {{
 *   pillarKey: 'consistency' | 'auxiliary',
 *   title: string,
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
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 *   criteriaSaving?: boolean,
 * }} props
 */
export default function ProjectHubCriteriaToggleSection({
  pillarKey,
  title,
  ariaLabel,
  entries,
  customRules,
  isEnabled,
  onToggle,
  isRequired,
  criteriaSaving = false,
}) {
  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className={`project-hub-settings__criteria-section project-hub-settings__criteria-section--${pillarKey}`}
        aria-label={ariaLabel}
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">{title}</h3>
        </div>
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
