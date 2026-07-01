import { useMemo } from 'react';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
  toggleConsistencyEntry,
} from '../../lib/compoundPairRegister.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
  togglePhraseSlotEntry,
} from '../../lib/phraseSlotRegister.js';
import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
  toggleAuxiliaryVerbEntry,
} from '../../lib/auxiliaryVerbRegister.js';
import { isBonBojoRequiredItem } from '../../lib/bonBojoRules.js';
import { planProjectCustomRulesUpdate } from '../../lib/projectCustomRulesUpdate.js';
import { consistencyEntryKey, consistencyEntryLabel } from '../consistency/entryLabel.js';
import RegisteredList from '../consistency/RegisteredList.jsx';

/**
 * @param {{
 *   pillarRows: ReturnType<import('../../presentation/projectCardViewModel.js').buildProjectCardPillarPreviews>,
 *   ruleSet: import('../../lib/ruleSetsStorage.js').RuleSet,
 *   criteriaSaving?: boolean,
 *   onCustomRulesChange: (rules: import('../../lib/ruleTypes.js').Rule[]) => void | Promise<void>,
 *   onStartWork?: () => void,
 * }} props
 */
export default function ProjectHubCriteriaPanel({
  pillarRows,
  ruleSet,
  criteriaSaving = false,
  onCustomRulesChange,
  onStartWork,
}) {
  const customRules = ruleSet.customRules ?? [];

  const spellingRow = pillarRows.find((row) => row.key === 'spelling');
  const consistencyRow = pillarRows.find((row) => row.key === 'consistency');
  const auxiliaryRow = pillarRows.find((row) => row.key === 'auxiliary');

  const literalEntries = useMemo(
    () => listConsistencyLiteralEntries(customRules),
    [customRules],
  );
  const phraseSlotEntries = useMemo(
    () => listPhraseSlotEntries(customRules),
    [customRules],
  );
  const auxiliaryEntries = useMemo(
    () => listAuxiliaryVerbEntries(customRules),
    [customRules],
  );

  const consistencyEntries = useMemo(
    () => [...literalEntries, ...phraseSlotEntries],
    [literalEntries, phraseSlotEntries],
  );

  function applyCustomRules(nextRules) {
    const plan = planProjectCustomRulesUpdate(ruleSet, nextRules);
    if (!plan.ok) {
      alert(plan.message);
      return;
    }
    void onCustomRulesChange(plan.nextCustomRules);
  }

  function toggleConsistency(row, enabled) {
    const isPhraseSlot = phraseSlotEntries.some(
      (entry) => entry.tailWord === row.tailWord,
    );
    const nextRules = isPhraseSlot
      ? togglePhraseSlotEntry(customRules, row.tailWord, enabled)
      : toggleConsistencyEntry(customRules, row.tailWord, enabled);
    applyCustomRules(nextRules);
  }

  function isConsistencyEnabled(rules, row) {
    const isPhraseSlot = phraseSlotEntries.some(
      (entry) => entry.tailWord === row.tailWord,
    );
    return isPhraseSlot
      ? isPhraseSlotEntryEnabled(rules, row.tailWord)
      : isConsistencyEntryEnabled(rules, row.tailWord);
  }

  return (
    <div className="project-hub-settings__criteria">
      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--spelling"
        aria-label="맞춤법"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">맞춤법</h3>
          <span className="project-hub-settings__criteria-count">
            {spellingRow?.count ?? 0}
          </span>
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

      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--consistency"
        aria-label="표기 통일"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">표기 통일</h3>
          <span className="project-hub-settings__criteria-count">
            {consistencyRow?.count ?? 0}
          </span>
        </div>
        {consistencyEntries.length === 0 ? (
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
          <ul className="project-hub-settings__criteria-list">
            {consistencyEntries.map((row) => {
              const label = consistencyEntryLabel(row);
              const enabled = isConsistencyEnabled(customRules, row);
              return (
                <li key={consistencyEntryKey(row)}>
                  <label
                    className={`project-hub-settings__criteria-chip${enabled ? ' project-hub-settings__criteria-chip--on' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={criteriaSaving}
                      onChange={(event) =>
                        toggleConsistency(row, event.target.checked)
                      }
                    />
                    <span>{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--auxiliary"
        aria-label="본용언과 보조용언"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">
            본용언 + 보조용언
          </h3>
          <span className="project-hub-settings__criteria-count">
            {auxiliaryRow?.count ?? 0}
          </span>
        </div>
        {auxiliaryEntries.length === 0 ? (
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
            entries={auxiliaryEntries}
            customRules={customRules}
            isEnabled={isAuxiliaryVerbEntryEnabled}
            onToggle={(row, on) =>
              applyCustomRules(
                toggleAuxiliaryVerbEntry(customRules, row, on),
              )
            }
            variant="auxiliary-grid"
            isRequired={(row) => isBonBojoRequiredItem(row.bonBojoItemId)}
          />
        )}
      </section>
    </div>
  );
}
