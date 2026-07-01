import RegisteredList from '../consistency/RegisteredList.jsx';

/**
 * 표기 통일·본용언+보조용언 — 공통 토글 그리드 섹션.
 *
 * @param {{
 *   pillarKey: 'consistency' | 'auxiliary',
 *   title: string,
 *   count?: number,
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
 *   onStartWork?: () => void,
 *   showEmptyState?: boolean,
 * }} props
 */
export default function ProjectHubCriteriaToggleSection({
  pillarKey,
  title,
  count = 0,
  ariaLabel,
  entries,
  customRules,
  isEnabled,
  onToggle,
  isRequired,
  criteriaSaving = false,
  onStartWork,
  showEmptyState = false,
}) {
  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className={`project-hub-settings__criteria-section project-hub-settings__criteria-section--${pillarKey}`}
        aria-label={ariaLabel}
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">{title}</h3>
          <span className="project-hub-settings__criteria-count">{count}</span>
        </div>
        {entries.length === 0 && showEmptyState ? (
          <>
            <p className="project-hub-settings__criteria-empty">
              등록된 항목이 없습니다. 검수 화면에서 추가할 수 있습니다.
            </p>
            <button
              type="button"
              className="sheet-card__btn sheet-card__btn--secondary project-hub-settings__criteria-link"
              onClick={onStartWork}
            >
              검수 화면에서 추가
            </button>
          </>
        ) : (
          <RegisteredList
            entries={entries}
            customRules={customRules}
            isEnabled={isEnabled}
            onToggle={onToggle}
            variant="auxiliary-grid"
            isRequired={isRequired}
            disabled={criteriaSaving}
          />
        )}
      </section>
    </div>
  );
}
