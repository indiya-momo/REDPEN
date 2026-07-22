import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../../lib/compoundPairRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
  listConsistencyUnifyEntries,
} from '../../lib/consistencyRuleLimit.js';
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
    <span className="results-header__stat project-hub-settings__criteria-stat">
      <span className={`results-header-badge ${resultPillarToneClass(tone)}`}>
        {badge}
      </span>
      <span className="results-header__stat-count">{count}건</span>
    </span>
  );
}

/**
 * 마이페이지 표기 통일 — 항목 수만 요약. 편집은 검수 화면에서 한다.
 *
 * @param {{
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   onStartWork?: () => void,
 * }} props
 */
export default function ProjectHubCriteriaConsistencySection({
  customRules = [],
  onStartWork,
}) {
  const findCount = listConsistencyLiteralEntries(customRules).filter((entry) =>
    isConsistencyEntryEnabled(customRules, entry.tailWord),
  ).length;
  const unifyCount = listConsistencyUnifyEntries(customRules).filter((entry) =>
    isConsistencyEntryEnabled(customRules, entry.tailWord),
  ).length;

  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--consistency"
        aria-label="표기 통일"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title visually-hidden">
            표기 통일
          </h3>
          <div
            className="project-hub-settings__criteria-stats results-header__stats project-hub-settings__criteria-stats--stack"
            aria-label="표기 통일 항목 수"
          >
            <CriteriaStatBadge
              badge={LITERAL_FIND_FEATURE_LABEL}
              count={findCount}
              tone="consistency-literal"
            />
            <CriteriaStatBadge
              badge={UNIFY_FEATURE_LABEL}
              count={unifyCount}
              tone="consistency-unify"
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
              표기 통일 항목은 검수 화면에서 편집합니다
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
