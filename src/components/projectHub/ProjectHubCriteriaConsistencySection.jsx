import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../../lib/compoundPairRegister.js';
import { listConsistencyUnifyEntries } from '../../lib/consistencyRuleLimit.js';
import { getConsistencyUnifyPinnedTailWord } from '../../lib/consistencyUnifyRegister.js';
import { resultPillarToneClass } from '../../lib/resultPillarTone.js';

/**
 * 마이페이지 표기 통일 — 여러 개 찾기·통일형 찾기만 칩으로 요약.
 * 편집은 검수 화면에서 한다.
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
  const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules);

  const groups = [
    {
      label: '여러 개 찾기',
      tone: /** @type {const} */ ('consistency-literal'),
      chips: listConsistencyLiteralEntries(customRules).map((entry) => ({
        label: entry.tailWord,
        active: isConsistencyEntryEnabled(customRules, entry.tailWord),
        pinned: false,
      })),
    },
    {
      label: '통일형 찾기',
      tone: /** @type {const} */ ('consistency-unify'),
      chips: listConsistencyUnifyEntries(customRules).map((entry) => ({
        label: entry.tailWord,
        active: isConsistencyEntryEnabled(customRules, entry.tailWord),
        pinned: pinnedTailWord === entry.tailWord,
      })),
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
        <ul className="project-hub-settings__criteria-groups">
          {groups.map((group) => (
            <li
              key={group.label}
              className="project-hub-settings__criteria-group"
            >
              <span
                className={`results-header-badge project-hub-settings__criteria-group-badge ${resultPillarToneClass(group.tone)}`}
              >
                {group.label}
              </span>
              {group.chips.length ? (
                <span className="project-hub-settings__criteria-chips">
                  {group.chips.map((chip, index) => (
                    <span
                      key={`${chip.label}-${index}`}
                      className={[
                        'project-hub-settings__criteria-chip',
                        chip.active ? '' : 'project-hub-settings__criteria-chip--off',
                        chip.pinned
                          ? 'project-hub-settings__criteria-chip--pinned'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {chip.label}
                      {chip.pinned ? (
                        <span
                          className="project-hub-settings__criteria-chip-pin"
                          aria-label="통일형"
                        >
                          📌
                        </span>
                      ) : null}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="project-hub-settings__criteria-empty">—</span>
              )}
            </li>
          ))}
        </ul>
        <p className="project-hub-settings__criteria-lead">
          표기 통일 검수 항목은 검수 화면에서 편집합니다.
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
