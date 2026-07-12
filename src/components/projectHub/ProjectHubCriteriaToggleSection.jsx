import RegisteredList from '../consistency/RegisteredList.jsx';
import { AUXILIARY_VERB_BADGE_LABEL } from '../../lib/bonBojoRules.js';
import { resultPillarToneClass } from '../../lib/resultPillarTone.js';

/**
 * 본용언+보조용언 — 뱃지 + 토글 그리드 섹션.
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
          <h3 className="project-hub-settings__criteria-title visually-hidden">
            {ariaLabel}
          </h3>
          <div
            className="project-hub-settings__criteria-stats results-header__stats"
            aria-label={ariaLabel}
          >
            <span className="results-header__stat">
              <span
                className={`results-header-badge ${resultPillarToneClass('auxiliary')}`}
              >
                {pillarKey === 'auxiliary'
                  ? AUXILIARY_VERB_BADGE_LABEL
                  : ariaLabel}
              </span>
            </span>
          </div>
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
