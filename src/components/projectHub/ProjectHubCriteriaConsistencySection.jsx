import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../../lib/compoundPairRegister.js';
import { listConsistencyUnifyEntries } from '../../lib/consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from '../../lib/phraseSlotRegister.js';

/**
 * 마이페이지 표기 통일 — 등록 항목을 카테고리별 칩으로 요약해 보여주고,
 * 편집은 맞춤법·본용언과 동일하게 검수 화면에서 한다.
 *
 * @param {{
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   onStartWork?: () => void,
 * }} props
 */
export default function ProjectHubCriteriaConsistencySection({
  customRules = [],
  globalExcludePhrases = [],
  onStartWork,
}) {
  const groups = [
    {
      label: '여러 개 찾기',
      chips: listConsistencyLiteralEntries(customRules).map((entry) => ({
        label: entry.tailWord,
        active: isConsistencyEntryEnabled(customRules, entry.tailWord),
      })),
    },
    {
      label: '통일형 찾기',
      chips: listConsistencyUnifyEntries(customRules).map((entry) => ({
        label: entry.tailWord,
        active: isConsistencyEntryEnabled(customRules, entry.tailWord),
      })),
    },
    {
      label: '공통 문자열 찾기',
      chips: listPhraseSlotEntries(customRules).map((entry) => ({
        label: entry.tailWord,
        active: isPhraseSlotEntryEnabled(customRules, entry.tailWord),
      })),
    },
    {
      label: '제외 항목',
      chips: (globalExcludePhrases ?? [])
        .map((phrase) => String(phrase).trim())
        .filter(Boolean)
        .map((phrase) => ({ label: phrase, active: true })),
    },
  ];

  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--consistency"
        aria-label="표기 통일"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">표기 통일</h3>
        </div>
        <p className="project-hub-settings__criteria-lead">
          표기 통일 검수 항목은 검수 화면에서 편집합니다.
        </p>
        <ul className="project-hub-settings__criteria-groups">
          {groups.map((group) => (
            <li
              key={group.label}
              className="project-hub-settings__criteria-group"
            >
              <span className="project-hub-settings__criteria-group-label">
                {group.label}
              </span>
              {group.chips.length ? (
                <span className="project-hub-settings__criteria-chips">
                  {group.chips.map((chip, index) => (
                    <span
                      key={`${chip.label}-${index}`}
                      className={
                        chip.active
                          ? 'project-hub-settings__criteria-chip'
                          : 'project-hub-settings__criteria-chip project-hub-settings__criteria-chip--off'
                      }
                    >
                      {chip.label}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="project-hub-settings__criteria-empty">—</span>
              )}
            </li>
          ))}
        </ul>
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
