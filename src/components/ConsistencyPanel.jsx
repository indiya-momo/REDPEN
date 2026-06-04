import { useEffect, useRef, useState } from 'react';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from '../lib/activeRuleCount.js';
import {
  buildRulesForEntry,
  isConsistencyEntryEnabled,
  isLiteralConsistencyEntry,
  listConsistencyEntries,
  planConsistencyEntries,
  parseConsistencyInput,
  removeConsistencyEntry,
  toggleConsistencyEntry,
} from '../lib/compoundPairRegister.js';
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
import { isAuxiliaryStem, isHaeBoPattern } from '../lib/compoundPatternCommon.js';
import { parseCommaList } from '../lib/matchFilters.js';
import { isBonBojoRequiredItem } from '../lib/bonBojoRules.js';
import {
  canAddPhraseSlotRegisteredEntries,
  countPhraseSlotRegisteredEntries,
  MAX_PHRASE_SLOT_REGISTERED_ENTRIES,
  phraseSlotRegistrationBlockedMessage,
} from '../lib/consistencyRuleLimit.js';
import ConsistencyRegisterField from './consistency/ConsistencyRegisterField.jsx';
import ExcludePhraseList from './consistency/ExcludePhraseList.jsx';
import RegisteredList from './consistency/RegisteredList.jsx';
import { SPACE_INPUT_PLACEHOLDER } from './consistency/constants.js';
import TocBodySetupPanel from '../toc-body/components/TocBodySetupPanel.jsx';
import { isTocBodyCheckEnabled } from '../lib/featureFlags.js';
import DetailsChevron from './DetailsChevron.jsx';
import PanelSectionRunButton from './PanelSectionRunButton.jsx';
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
 *   onClearPrintedPageOffset?: () => void,
 *   onRunTocCheck?: () => void | Promise<void>,
 *   onRunRulesCheck?: () => void | Promise<void>,
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
  onClearPrintedPageOffset = () => {},
  onRunTocCheck = () => {},
  onRunRulesCheck = () => {},
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

  const literalEntries = listConsistencyEntries(customRules);
  const slotEntries = listPhraseSlotEntries(customRules);
  const phraseSlotRegisteredCount = countPhraseSlotRegisteredEntries(customRules);
  const phraseSlotRegisterFull =
    phraseSlotRegisteredCount >= MAX_PHRASE_SLOT_REGISTERED_ENTRIES;
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
    const variants = parseConsistencyInput(literalInput);
    if (!variants.length) {
      alert('문자열을 입력하세요.');
      return;
    }
    let merged = customRules;
    /** @type {import('../lib/ruleTypes.js').Rule[]} */
    const toAdd = [];
    for (const raw of planConsistencyEntries(variants)) {
      if (!isLiteralConsistencyEntry(raw)) {
        if (isPhraseSlotPattern(raw)) {
          alert(`「${raw}」은 공통 문자열 찾기에 등록하세요. (@)`);
        } else if (isAuxiliaryStem(raw) || isHaeBoPattern(raw)) {
          alert(`「${raw}」은 본용언+보조용언 표기에 등록하세요.`);
        } else {
          const parts = raw.split(/\s+/).filter(Boolean);
          if (parts.length === 2 && isAuxiliaryStem(parts[1])) {
            alert(`「${raw}」은 본용언+보조용언 표기에 등록하세요.`);
          } else {
            alert(`등록할 수 없는 형식입니다: ${raw}`);
          }
        }
        continue;
      }
      const batch = buildRulesForEntry(merged, raw);
      if (!batch.length) continue;
      toAdd.push(...batch);
      merged = [...merged, ...batch];
    }
    if (!toAdd.length) {
      alert('입력한 항목은 모두 이미 등록되어 있거나 다른 칸에 넣어야 합니다.');
      return;
    }
    if (!assertSlots(toAdd)) return;
    setLiteralInput('');
  }

  function registerSlot() {
    const variants = parsePhraseSlotInput(slotInput);
    if (!variants.length) {
      alert('패턴을 입력하세요. (예: @시대)');
      return;
    }
    let merged = customRules;
    const toAdd = [];
    let newEntryCount = 0;
    for (const raw of planConsistencyEntries(variants)) {
      if (!isPhraseSlotPattern(raw)) {
        alert(`「${raw}」에는 @가 필요합니다. (예: @시대)`);
        continue;
      }
      const batch = buildRulesForPhraseSlot(merged, raw);
      if (!batch.length) continue;
      newEntryCount += 1;
      toAdd.push(...batch);
      merged = [...merged, ...batch];
    }
    if (!toAdd.length) {
      alert('입력한 패턴은 모두 이미 등록되어 있습니다.');
      return;
    }
    if (!canAddPhraseSlotRegisteredEntries(customRules, newEntryCount)) {
      alert(
        phraseSlotRegistrationBlockedMessage(
          phraseSlotRegisteredCount,
          newEntryCount,
        ),
      );
      return;
    }
    if (!assertSlots(toAdd)) return;
    setSlotInput('');
  }

  function addGlobalExcludePhrases() {
    const parsed = parseCommaList(globalExcludeInput);
    if (!parsed.length) {
      alert('제외할 구문을 입력하세요.');
      return;
    }
    const merged = [...globalExcludePhrases];
    for (const phrase of parsed) {
      if (!merged.some((p) => p === phrase)) merged.push(phrase);
    }
    onGlobalExcludePhrasesChange(merged);
    setGlobalExcludeInput('');
  }

  function removeGlobalExclude(phrase) {
    onGlobalExcludePhrasesChange(
      globalExcludePhrases.filter((p) => p !== phrase),
    );
  }

  return (
    <div className="consistency-embed">
      {hasPdf ? (
        <div className="consistency-tab-layout__run-row">
          <PanelSectionRunButton
            label="일관성+용언 검수"
            onClick={onRunRulesCheck}
            disabled={!hasPdf || checkQuotaBlocked}
            isProcessing={isProcessing}
          />
        </div>
      ) : null}
      <section className="consistency-unified-box" aria-label="표기 일관성 찾기">
        <p className="printed-page-setup__title consistency-panel-section-title">
          일관성 찾기(1회 검수 8개 이내 추천)
        </p>
        <div className="consistency-subsection consistency-subsection--first">
          <p className="hint">
            한글 · 영문 대소문자 · 띄어쓰기 등을 찾습니다(예: 조선˅시대/조선시대, RED˅PEN/Red˅pen)
          </p>
          <ConsistencyRegisterField
            value={literalInput}
            onChange={setLiteralInput}
            onRegister={registerLiteral}
            placeholder={SPACE_INPUT_PLACEHOLDER}
            ariaLabel="일관성 찾기"
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

        <div className="consistency-subsection-row">
          <div className="consistency-subsection consistency-subsection--half">
            <p className="printed-page-setup__title consistency-subsection-title">
              공통 문자열 찾기(1회 검수 8개 이내 추천)
            </p>
            <div className="consistency-subsection__hints-area">
              <p className="hint consistency-hint-block">
                {`@을 포함한 공통 문자열을 모두 찾습니다
(예: @시대 → 조선시대, 고려시대, 신라시대)`}
              </p>
            </div>
            <ConsistencyRegisterField
              value={slotInput}
              onChange={setSlotInput}
              onRegister={registerSlot}
              placeholder={SPACE_INPUT_PLACEHOLDER}
              ariaLabel="공통 문자열 찾기(1회 검수 8개 이내 추천)"
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
            <p className="printed-page-setup__title consistency-subsection-title">
              검수 제외 단어
            </p>
            <div className="consistency-subsection__hints-area">
              <p className="hint">등록한 단어는 찾지 않습니다 (예: 소녀시대)</p>
            </div>
            <ConsistencyRegisterField
              value={globalExcludeInput}
              onChange={setGlobalExcludeInput}
              onRegister={addGlobalExcludePhrases}
              placeholder={SPACE_INPUT_PLACEHOLDER}
              ariaLabel="검수 제외 단어"
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
        <details className="consistency-auxiliary-details" open>
          <summary
            id="consistency-aux-heading"
            className="consistency-section-head bon-bojo-checklist-header consistency-auxiliary-summary"
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
                aria-label="본용언+보조용언 표기 전체 선택"
              />
            </label>
            <span className="printed-page-setup__title bon-bojo-checklist-title consistency-panel-section-title consistency-auxiliary-summary-title">
              본용언 + 보조용언 표기
              {auxiliaryTotal > 0
                ? ` (선택 ${auxiliaryActiveCount}/${auxiliaryTotal})`
                : ''}
            </span>
          </summary>
          <p className="auxiliary-checklist-intro">
            (개발중) ‘본용언+보조용언’ 붙여 쓸 수 있는 표기를 찾습니다
            <br />
            본용언이 3음절 이상 복합어(예:생각하다)이면 검색에서 제외됩니다
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
                  본용언+보조용언 표기
                </span>
                를 검색한다냥
                <br />
                아직 개발중이라 부족한 점도 있다냥
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
          onClearPrintedPageOffset={onClearPrintedPageOffset}
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
            className="printed-page-setup__title consistency-panel-section-title"
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
