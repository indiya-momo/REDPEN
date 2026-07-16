import { resultPillarToneClass } from '../../lib/resultPillarTone.js';

/**
 * @param {{
 *   badge: string,
 *   count: number,
 *   tone: import('../../lib/resultPillarTone.js').ResultBadgeTone,
 * }} props
 */
function CriteriaStatBadge({ badge, count, tone }) {
  return (
    <span className="results-header__stat">
      <span className={`results-header-badge ${resultPillarToneClass(tone)}`}>
        {badge}
      </span>
      <span className="results-header__stat-count">{count}건</span>
    </span>
  );
}

/**
 * @param {{
 *   onStartWork?: () => void,
 *   editorReviewCount?: number,
 *   spellingRuleCount?: number,
 * }} props
 */
export default function ProjectHubCriteriaSpellingSection({
  onStartWork,
  editorReviewCount = 0,
  spellingRuleCount = 0,
}) {
  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--spelling"
        aria-label="맞춤법"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title visually-hidden">
            맞춤법
          </h3>
          <div
            className="project-hub-settings__criteria-stats results-header__stats"
            aria-label="맞춤법 항목 수"
          >
            <CriteriaStatBadge
              badge="편집자 검토 필요"
              count={editorReviewCount}
              tone="spelling-caution"
            />
            <CriteriaStatBadge
              badge="맞춤법 규칙"
              count={spellingRuleCount}
              tone="spelling-builtin"
            />
          </div>
          <div className="project-hub-settings__criteria-actions">
            <button
              type="button"
              className="sheet-card__btn sheet-card__btn--secondary project-hub-settings__criteria-link"
              onClick={onStartWork}
            >
              검수 화면에서 편집
            </button>
            <p className="project-hub-settings__criteria-lead">
              맞춤법·띄어쓰기 항목은 검수 화면에서 편집합니다
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
