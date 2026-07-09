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
          <h3 className="project-hub-settings__criteria-title">
            편집자 검토 필요 {editorReviewCount}, 맞춤법 규칙 {spellingRuleCount}
          </h3>
        </div>
        <p className="project-hub-settings__criteria-lead">
          맞춤법·띄어쓰기 검수 항목은 검수 화면에서 편집합니다.
        </p>
        <button
          type="button"
          className="sheet-card__btn sheet-card__btn--secondary project-hub-settings__criteria-link"
          onClick={onStartWork}
        >
          검수 화면에서 편집
        </button>
      </section>
    </div>
  );
}
