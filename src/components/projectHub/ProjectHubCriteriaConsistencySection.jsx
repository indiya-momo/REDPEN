import { useMemo } from 'react';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../../lib/compoundPairRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  listConsistencyUnifyEntries,
  MAX_CONSISTENCY_CRITERIA_SLOTS,
  MAX_CONSISTENCY_UNIFY_SLOTS,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
} from '../../lib/consistencyRuleLimit.js';
import {
  isPhraseSlotEntryEnabled,
  listPhraseSlotEntries,
} from '../../lib/phraseSlotRegister.js';
import RegisteredList from '../consistency/RegisteredList.jsx';

/**
 * @param {{
 *   title: string,
 *   meta?: string,
 *   entries: { tailWord: string, displayLabel?: string }[],
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string },
 *     enabled: boolean,
 *   ) => void,
 *   criteriaSaving?: boolean,
 * }} props
 */
function ConsistencyCriteriaGroup({
  title,
  meta,
  entries,
  customRules,
  isEnabled,
  onToggle,
  criteriaSaving = false,
}) {
  return (
    <div className="project-hub-settings__consistency-group">
      <h4 className="project-hub-settings__consistency-group-title">
        {title}
        {meta ? (
          <span className="project-hub-settings__consistency-group-meta">
            {meta}
          </span>
        ) : null}
      </h4>
      {entries.length > 0 ? (
        <RegisteredList
          entries={entries}
          customRules={customRules}
          isEnabled={isEnabled}
          onToggle={onToggle}
          variant="auxiliary-grid"
          disabled={criteriaSaving}
        />
      ) : (
        <p className="project-hub-settings__criteria-empty project-hub-settings__criteria-empty--inline">
          등록된 항목 없음
        </p>
      )}
    </div>
  );
}

/**
 * 표기 통일 — 검수 화면과 동일한 3구역(여러 개 찾기·통일형·공통 문자열) 토글.
 *
 * @param {{
 *   count?: number,
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   criteriaSaving?: boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string },
 *     enabled: boolean,
 *   ) => void,
 *   onStartWork?: () => void,
 * }} props
 */
export default function ProjectHubCriteriaConsistencySection({
  count = 0,
  customRules,
  criteriaSaving = false,
  onToggle,
  onStartWork,
}) {
  const literalEntries = useMemo(
    () => listConsistencyLiteralEntries(customRules),
    [customRules],
  );
  const unifyEntries = useMemo(
    () => listConsistencyUnifyEntries(customRules),
    [customRules],
  );
  const phraseSlotEntries = useMemo(
    () => listPhraseSlotEntries(customRules),
    [customRules],
  );

  const hasAnyEntry =
    literalEntries.length > 0 ||
    unifyEntries.length > 0 ||
    phraseSlotEntries.length > 0;

  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <section
        className="project-hub-settings__criteria-section project-hub-settings__criteria-section--consistency"
        aria-label="표기 통일"
      >
        <div className="project-hub-settings__criteria-head">
          <h3 className="project-hub-settings__criteria-title">표기 통일</h3>
          <span className="project-hub-settings__criteria-count">{count}</span>
        </div>

        <div className="project-hub-settings__consistency-groups">
          <ConsistencyCriteriaGroup
            title={LITERAL_FIND_FEATURE_LABEL}
            meta={`(최대 ${MAX_CONSISTENCY_CRITERIA_SLOTS}항목)`}
            entries={literalEntries}
            customRules={customRules}
            isEnabled={(rules, row) =>
              isConsistencyEntryEnabled(rules, row.tailWord)
            }
            onToggle={onToggle}
            criteriaSaving={criteriaSaving}
          />
          <ConsistencyCriteriaGroup
            title="통일형 만들기"
            meta={`(최대 ${MAX_CONSISTENCY_UNIFY_SLOTS}항목)`}
            entries={unifyEntries}
            customRules={customRules}
            isEnabled={(rules, row) =>
              isConsistencyEntryEnabled(rules, row.tailWord)
            }
            onToggle={onToggle}
            criteriaSaving={criteriaSaving}
          />
          <ConsistencyCriteriaGroup
            title="공통 문자열 찾기"
            meta={`(최대 ${MAX_PHRASE_SLOT_REGISTERED_ENTRIES}항목)`}
            entries={phraseSlotEntries}
            customRules={customRules}
            isEnabled={(rules, row) =>
              isPhraseSlotEntryEnabled(rules, row.tailWord)
            }
            onToggle={onToggle}
            criteriaSaving={criteriaSaving}
          />
        </div>

        {!hasAnyEntry ? (
          <button
            type="button"
            className="sheet-card__btn sheet-card__btn--secondary project-hub-settings__criteria-link"
            onClick={onStartWork}
          >
            검수 화면에서 추가
          </button>
        ) : null}
      </section>
    </div>
  );
}
