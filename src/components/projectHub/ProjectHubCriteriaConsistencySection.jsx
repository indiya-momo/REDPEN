import { useMemo, useState } from 'react';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
  planConsistencyEntries,
  removeConsistencyEntry,
  toggleConsistencyEntry,
} from '../../lib/compoundPairRegister.js';
import { registerConsistencyLiteralBatch } from '../../lib/consistencyLiteralRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
  countPhraseSlotRegisteredEntries,
  phraseSlotRegistrationBlockedMessage,
} from '../../lib/consistencyRuleLimit.js';
import {
  buildRulesForPhraseSlot,
  isPhraseSlotEntryEnabled,
  isPhraseSlotPattern,
  listPhraseSlotEntries,
  parsePhraseSlotInput,
  removePhraseSlotEntry,
  togglePhraseSlotEntry,
} from '../../lib/phraseSlotRegister.js';
import ConsistencyRegisterField from '../consistency/ConsistencyRegisterField.jsx';
import ConsistencyHintExample from '../consistency/ConsistencyHintExample.jsx';
import ConsistencyUnifySection from '../consistency/ConsistencyUnifySection.jsx';
import RegisteredList from '../consistency/RegisteredList.jsx';
import {
  CONSISTENCY_LITERAL_INPUT_PLACEHOLDER,
  CONSISTENCY_PHRASE_SLOT_INPUT_PLACEHOLDER,
} from '../consistency/constants.js';

/**
 * 마이페이지 표기 통일 — 검수 화면과 동일한 등록·토글 UI (여러 개 찾기·통일형·공통 문자열).
 *
 * @param {{
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   criteriaSaving?: boolean,
 *   applyCustomRules: (rules: import('../../lib/ruleTypes.js').Rule[]) => boolean,
 * }} props
 */
export default function ProjectHubCriteriaConsistencySection({
  customRules,
  criteriaSaving = false,
  applyCustomRules,
}) {
  const [literalInput, setLiteralInput] = useState('');
  const [slotInput, setSlotInput] = useState('');

  const literalEntries = useMemo(
    () => listConsistencyLiteralEntries(customRules),
    [customRules],
  );
  const slotEntries = useMemo(
    () => listPhraseSlotEntries(customRules),
    [customRules],
  );
  const phraseSlotRegisteredCount = useMemo(
    () => countPhraseSlotRegisteredEntries(customRules),
    [customRules],
  );
  const phraseSlotRegisterFull =
    phraseSlotRegisteredCount >= MAX_PHRASE_SLOT_REGISTERED_ENTRIES;

  function assertSlots(toAdd) {
    return applyCustomRules([...customRules, ...toAdd]);
  }

  function registerLiteral() {
    const input = literalInput.trim() || CONSISTENCY_LITERAL_INPUT_PLACEHOLDER;
    if (registerConsistencyLiteralBatch(input, customRules, applyCustomRules)) {
      setLiteralInput('');
    }
  }

  function registerSlot() {
    const input = slotInput.trim() || CONSISTENCY_PHRASE_SLOT_INPUT_PLACEHOLDER;
    const variants = parsePhraseSlotInput(input);
    if (!variants.length) {
      alert('패턴을 입력하세요. (예: @시대)');
      return;
    }
    if (variants.length > 1) {
      alert('공통 문자열 찾기는 1항목만 등록할 수 있습니다.');
      return;
    }
    if (phraseSlotRegisterFull) {
      alert(
        phraseSlotRegistrationBlockedMessage(phraseSlotRegisteredCount, 1),
      );
      return;
    }
    const raw = planConsistencyEntries(variants)[0];
    if (!raw || !isPhraseSlotPattern(raw)) {
      alert(`「${variants[0]}」에는 @가 필요합니다. (예: @시대)`);
      return;
    }
    const batch = buildRulesForPhraseSlot(customRules, raw);
    if (!batch.length) {
      alert('입력한 패턴은 이미 등록되어 있습니다.');
      return;
    }
    if (!assertSlots(batch)) return;
    setSlotInput('');
  }

  return (
    <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
      <div className="consistency-embed project-hub-settings__consistency-editor">
        <section className="consistency-unified-box" aria-label="표기 통일">
          <div className="consistency-subsection consistency-subsection--first">
            <p className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading">
              {LITERAL_FIND_FEATURE_LABEL}
              <span className="panel-criteria-heading-meta">
                (1회 5항목까지 가능, 영문 대소문자 지원)
              </span>
            </p>
            <p className="hint consistency-hint-block">
              여러 항목은 사이에 &apos;,&apos;를 넣어 한 번에 입력하고 찾아 볼 수
              있습니다
              <br />
              <ConsistencyHintExample>
                &apos;마한, 진한, 변한&apos; 입력 → 3항목 한 번에 찾기
              </ConsistencyHintExample>
            </p>
            <ConsistencyRegisterField
              value={literalInput}
              onChange={setLiteralInput}
              onRegister={registerLiteral}
              placeholder={CONSISTENCY_LITERAL_INPUT_PLACEHOLDER}
              ariaLabel={LITERAL_FIND_FEATURE_LABEL}
              registerDisabled={criteriaSaving}
            />
            <RegisteredList
              entries={literalEntries}
              customRules={customRules}
              isEnabled={(rules, row) =>
                isConsistencyEntryEnabled(rules, row.tailWord)
              }
              onToggle={(row, on) =>
                applyCustomRules(
                  toggleConsistencyEntry(customRules, row.tailWord, on),
                )
              }
              onRemove={(tw) =>
                applyCustomRules(removeConsistencyEntry(customRules, tw))
              }
              disabled={criteriaSaving}
            />
          </div>

          <ConsistencyUnifySection
            customRules={customRules}
            onApplyRules={applyCustomRules}
          />

          <div className="consistency-subsection">
            <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
              공통 문자열 찾기
              <span className="panel-criteria-heading-meta">(1항목)</span>
            </p>
            <p className="hint consistency-hint-block">
              @을 포함한 항목을 모두 찾습니다
              <br />
              <ConsistencyHintExample>
                &apos;@시대&apos; 입력 → &apos;조선시대, 고려시대, 신라시대⋯&apos;
              </ConsistencyHintExample>
            </p>
            <ConsistencyRegisterField
              value={slotInput}
              onChange={setSlotInput}
              onRegister={registerSlot}
              placeholder={CONSISTENCY_PHRASE_SLOT_INPUT_PLACEHOLDER}
              ariaLabel="공통 문자열 찾기(1항목)"
              inputClassName="mono"
              registerDisabled={phraseSlotRegisterFull || criteriaSaving}
            />
            <RegisteredList
              entries={slotEntries}
              customRules={customRules}
              isEnabled={(rules, row) =>
                isPhraseSlotEntryEnabled(rules, row.tailWord)
              }
              onToggle={(row, on) =>
                applyCustomRules(
                  togglePhraseSlotEntry(customRules, row.tailWord, on),
                )
              }
              onRemove={(tw) =>
                applyCustomRules(removePhraseSlotEntry(customRules, tw))
              }
              disabled={criteriaSaving}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
