import { useEffect, useRef, useState } from 'react';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from '../lib/activeRuleCount.js';
import {
  buildRulesForEntry,
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
  planConsistencyEntries,
  removeConsistencyEntry,
  toggleConsistencyEntry,
} from '../lib/compoundPairRegister.js';
import { registerConsistencyLiteralBatch } from '../lib/consistencyLiteralRegister.js';
import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
  setAllAuxiliaryVerbEntries,
  toggleAuxiliaryVerbEntry,
} from '../lib/auxiliaryVerbRegister.js';
import {
  buildRulesForPhraseSlot,
  isPhraseSlotEntryEnabled,
  isPhraseSlotPattern,
  listPhraseSlotEntries,
  parsePhraseSlotInput,
  removePhraseSlotEntry,
  togglePhraseSlotEntry,
} from '../lib/phraseSlotRegister.js';
import { parseCommaList } from '../lib/matchFilters.js';
import { isBonBojoRequiredItem, AUXILIARY_VERB_FEATURE_LABEL } from '../lib/bonBojoRules.js';
import {
  countPhraseSlotRegisteredEntries,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
  MAX_GLOBAL_EXCLUDE_REGISTERED_ENTRIES,
  canAddGlobalExcludeRegisteredEntries,
  globalExcludeRegistrationBlockedMessage,
  phraseSlotRegistrationBlockedMessage,
  LITERAL_FIND_FEATURE_LABEL,
} from '../lib/consistencyRuleLimit.js';
import ConsistencyRegisterField from './consistency/ConsistencyRegisterField.jsx';
import ConsistencyHintExample from './consistency/ConsistencyHintExample.jsx';
import ConsistencyUnifySection from './consistency/ConsistencyUnifySection.jsx';
import ExcludePhraseList from './consistency/ExcludePhraseList.jsx';
import RegisteredList from './consistency/RegisteredList.jsx';
import {
  CONSISTENCY_EXCLUDE_INPUT_PLACEHOLDER,
  CONSISTENCY_LITERAL_INPUT_PLACEHOLDER,
  CONSISTENCY_PHRASE_SLOT_INPUT_PLACEHOLDER,
} from './consistency/constants.js';
import TocBodySetupPanel from '../toc-body/components/TocBodySetupPanel.jsx';
import { isTocBodyCheckEnabled } from '../lib/featureFlags.js';
import DetailsChevron from './DetailsChevron.jsx';
import TooltipGuide from './TooltipGuide.jsx';

/**
 * @param {{
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   globalExcludePhrases: string[],
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   builtInEnabled: Record<string, boolean>,
 *   cautionEnabled: Record<string, boolean>,
 *   tocBodyText?: string,
 *   onTocBodyTextChange?: (text: string) => void,
 *   tocBodyExcludePages?: string,
 *   onTocBodyExcludePagesChange?: (value: string) => void,
 *   printedPagesActive?: boolean,
 *   currentSystemPage?: number,
 *   currentPrintedLabel?: string,
 *   previewPrintedLabel?: string,
 *   spreadInput?: boolean,
 *   onSpreadInputChange?: (v: boolean) => void,
 *   firstPageSingle?: boolean,
 *   onFirstPageSingleChange?: (v: boolean) => void,
 *   onCalibrateFromInput?: (raw: string, isSpread: boolean) => void,
 *   onRunTocCheck?: () => void | Promise<void>,
 *   hasPdf?: boolean,
 *   isProcessing?: boolean,
 *   checkQuotaBlocked?: boolean,
 *   auxiliaryVerbGuide?: {
 *     storageKey: string,
 *     alignToBubbleChain: readonly object[],
 *     pinned: boolean,
 *     onDismiss: () => void,
 *   } | null,
 * }} props
 */
export default function ConsistencyPanel({
  customRules,
  onCustomRulesChange,
  globalExcludePhrases,
  onGlobalExcludePhrasesChange,
  builtInEnabled,
  cautionEnabled,
  tocBodyText = '',
  onTocBodyTextChange = () => {},
  tocBodyExcludePages = '',
  onTocBodyExcludePagesChange = () => {},
  printedPagesActive = false,
  currentSystemPage = 1,
  currentPrintedLabel = '',
  previewPrintedLabel = '',
  spreadInput = false,
  onSpreadInputChange = () => {},
  firstPageSingle = true,
  onFirstPageSingleChange = () => {},
  onCalibrateFromInput = () => {},
  onRunTocCheck = () => {},
  hasPdf = false,
  isProcessing = false,
  checkQuotaBlocked = false,
  auxiliaryVerbGuide = null,
}) {
  const [literalInput, setLiteralInput] = useState('');
  const [slotInput, setSlotInput] = useState('');
  const [globalExcludeInput, setGlobalExcludeInput] = useState('');

  useEffect(() => {
    setGlobalExcludeInput('');
  }, [globalExcludePhrases]);

  const literalEntries = listConsistencyLiteralEntries(customRules);
  const slotEntries = listPhraseSlotEntries(customRules);
  const phraseSlotRegisteredCount = countPhraseSlotRegisteredEntries(customRules);
  const phraseSlotRegisterFull =
    phraseSlotRegisteredCount >= MAX_PHRASE_SLOT_REGISTERED_ENTRIES;
  const excludeRegisterFull =
    globalExcludePhrases.length >= MAX_GLOBAL_EXCLUDE_REGISTERED_ENTRIES;
  const auxiliaryEntries = listAuxiliaryVerbEntries(customRules);
  const auxiliarySelectAllRef = useRef(
    /** @type {HTMLInputElement | null} */ (null),
  );
  const auxiliaryTotal = auxiliaryEntries.length;
  const auxiliaryActiveCount = auxiliaryEntries.filter((entry) =>
    isAuxiliaryVerbEntryEnabled(customRules, entry),
  ).length;
  const auxiliaryAllChecked =
    auxiliaryTotal > 0 && auxiliaryActiveCount === auxiliaryTotal;
  const auxiliarySomeChecked =
    auxiliaryActiveCount > 0 && auxiliaryActiveCount < auxiliaryTotal;

  useEffect(() => {
    if (auxiliarySelectAllRef.current) {
      auxiliarySelectAllRef.current.indeterminate = auxiliarySomeChecked;
    }
  }, [auxiliarySomeChecked]);

  function applyCustomRules(nextRules) {
    const count = countActiveRules({
      builtInEnabled,
      cautionEnabled,
      customRules: nextRules,
    });
    if (isOverMaxRules(count)) {
      alert(maxRulesExceededMessage(count));
      return false;
    }
    onCustomRulesChange(nextRules);
    return true;
  }

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

  function addGlobalExcludePhrases() {
    const input =
      globalExcludeInput.trim() || CONSISTENCY_EXCLUDE_INPUT_PLACEHOLDER;
    const parsed = parseCommaList(input);
    if (!parsed.length) {
      alert('제외할 항목을 입력하세요.');
      return;
    }
    if (parsed.length > 1) {
      alert('검수 제외 항목은 1항목만 등록할 수 있습니다.');
      return;
    }
    if (excludeRegisterFull) {
      alert(
        globalExcludeRegistrationBlockedMessage(globalExcludePhrases.length, 1),
      );
      return;
    }
    const phrase = parsed[0];
    if (globalExcludePhrases.some((p) => p === phrase)) {
      alert('입력한 항목은 이미 등록되어 있습니다.');
      return;
    }
    onGlobalExcludePhrasesChange([...globalExcludePhrases, phrase]);
    setGlobalExcludeInput('');
  }

  function removeGlobalExclude(phrase) {
    onGlobalExcludePhrasesChange(
      globalExcludePhrases.filter((p) => p !== phrase),
    );
  }

  return (
    <div className="consistency-embed">
      <section className="consistency-unified-box" aria-label={LITERAL_FIND_FEATURE_LABEL}>
        <p className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading">
          {LITERAL_FIND_FEATURE_LABEL}
          <span className="panel-criteria-heading-meta">
            (1회 5항목까지 가능, 영문 대소문자 지원)
          </span>
        </p>
        <div className="consistency-subsection consistency-subsection--first">
          <p className="hint consistency-hint-block">
            여러 항목은 사이에 &apos;,&apos;를 넣어 한 번에 입력하고 찾아 볼 수 있습니다
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
              onCustomRulesChange(removeConsistencyEntry(customRules, tw))
            }
          />
        </div>

        <ConsistencyUnifySection
          customRules={customRules}
          onApplyRules={applyCustomRules}
        />

        <div className="consistency-subsection-row">
          <div className="consistency-subsection consistency-subsection--half">
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
              inputClassName="field-input mono"
              registerDisabled={phraseSlotRegisterFull}
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
                onCustomRulesChange(removePhraseSlotEntry(customRules, tw))
              }
            />
          </div>

          <div className="consistency-subsection consistency-subsection--half consistency-subsection--exclude">
            <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
              검수 제외 항목
              <span className="panel-criteria-heading-meta">(1항목)</span>
            </p>
            <p className="hint consistency-hint-block">
              입력한 항목은 찾지 않습니다
              <br />
              <ConsistencyHintExample>
                &apos;소녀시대&apos;
              </ConsistencyHintExample>
            </p>
            <ConsistencyRegisterField
              value={globalExcludeInput}
              onChange={setGlobalExcludeInput}
              onRegister={addGlobalExcludePhrases}
              placeholder={CONSISTENCY_EXCLUDE_INPUT_PLACEHOLDER}
              ariaLabel="검수 제외 항목(1항목)"
              registerDisabled={excludeRegisterFull}
            />
            <ExcludePhraseList
              phrases={globalExcludePhrases}
              onRemove={removeGlobalExclude}
            />
          </div>
        </div>
      </section>

      <section
        className="consistency-section-box"
        data-work-guide-step="auxiliary-box"
      >
        <details className="caution-checklist-details consistency-auxiliary-details" open>
          <summary
            id="consistency-aux-heading"
            className="caution-checklist-summary panel-criteria-heading"
          >
            <DetailsChevron />
            <label
              className="caution-checklist-select-all"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <input
                ref={auxiliarySelectAllRef}
                type="checkbox"
                checked={auxiliaryAllChecked}
                disabled={auxiliaryTotal === 0}
                onChange={() =>
                  applyCustomRules(
                    setAllAuxiliaryVerbEntries(
                      customRules,
                      auxiliaryEntries,
                      !auxiliaryAllChecked,
                    ),
                  )
                }
                aria-label={`${AUXILIARY_VERB_FEATURE_LABEL} 전체 선택`}
              />
            </label>
            <span className="caution-checklist-summary-title">
              {AUXILIARY_VERB_FEATURE_LABEL}
              {auxiliaryTotal > 0 ? (
                <span className="panel-criteria-heading-meta">
                  {`(${auxiliaryActiveCount}/${auxiliaryTotal})`}
                </span>
              ) : null}
            </span>
          </summary>
          <p className="auxiliary-checklist-intro hint">
            ｢한글맞춤법｣ 기준 붙여 쓸 수 있는 ‘본용언(-아/어) + 보조용언’ 을 찾습니다
            <br />
            (본용언이 3음절 이상 복합어인 경우는 제외{' '}
            <ConsistencyHintExample>생각하다</ConsistencyHintExample>)
          </p>
          <RegisteredList
            entries={auxiliaryEntries}
            customRules={customRules}
            isEnabled={isAuxiliaryVerbEntryEnabled}
            onToggle={(row, on) =>
              applyCustomRules(toggleAuxiliaryVerbEntry(customRules, row, on))
            }
            variant="auxiliary-grid"
            isRequired={(row) => isBonBojoRequiredItem(row.bonBojoItemId)}
          />
        </details>
        {auxiliaryVerbGuide ? (
          <TooltipGuide
            storageKey={auxiliaryVerbGuide.storageKey}
            placement="right"
            bubbleType="left"
            useFixedLayer
            alignToBubbleChain={auxiliaryVerbGuide.alignToBubbleChain}
            bubbleGuideStep="5"
            offsetX={0}
            offsetY={0}
            pinned={auxiliaryVerbGuide.pinned}
            message={
              <>
                <span className="tooltip-guide__gothic-label">
                  {AUXILIARY_VERB_FEATURE_LABEL}
                </span>
                <br />
                이거 하다보면 공부 많이 되고
                <br />
                자기 전에 생각난다냥...
              </>
            }
            onDismiss={auxiliaryVerbGuide.onDismiss}
          >
            <span
              className="work-guide-anchor work-guide-anchor--auxiliary"
              aria-hidden
            />
          </TooltipGuide>
        ) : null}
      </section>

      {isTocBodyCheckEnabled() ? (
        <TocBodySetupPanel
          textareaRows={7}
          tocBodyText={tocBodyText}
          onTocBodyTextChange={onTocBodyTextChange}
          tocBodyExcludePages={tocBodyExcludePages}
          onTocBodyExcludePagesChange={onTocBodyExcludePagesChange}
          printedPagesActive={printedPagesActive}
          currentSystemPage={currentSystemPage}
          currentPrintedLabel={currentPrintedLabel}
          previewPrintedLabel={previewPrintedLabel}
          spreadInput={spreadInput}
          onSpreadInputChange={onSpreadInputChange}
          firstPageSingle={firstPageSingle}
          onFirstPageSingleChange={onFirstPageSingleChange}
          onCalibrateFromInput={onCalibrateFromInput}
          onRunCheck={onRunTocCheck}
          hasPdf={hasPdf}
          isProcessing={isProcessing}
          checkQuotaBlocked={checkQuotaBlocked}
        />
      ) : (
        <section
          className="consistency-section-box consistency-toc-section consistency-toc-section--disabled"
          aria-labelledby="consistency-toc-heading"
        >
          <p
            id="consistency-toc-heading"
            className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading"
          >
            목차 · 본문 일치 확인 🚧
          </p>
          <p className="hint consistency-toc-section__hint">
            열심히 준비하고 있어요 · ฅ•ω•ฅ
          </p>
        </section>
      )}
    </div>
  );
}
