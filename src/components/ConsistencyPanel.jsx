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
import ConsistencyRegisterField from './consistency/ConsistencyRegisterField.jsx';
import ExcludePhraseList from './consistency/ExcludePhraseList.jsx';
import RegisteredList from './consistency/RegisteredList.jsx';
import { SPACE_INPUT_PLACEHOLDER } from './consistency/constants.js';

/**
 * @param {{
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   globalExcludePhrases: string[],
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   builtInEnabled: Record<string, boolean>,
 *   cautionEnabled: Record<string, boolean>,
 * }} props
 */
export default function ConsistencyPanel({
  customRules,
  onCustomRulesChange,
  globalExcludePhrases,
  onGlobalExcludePhrasesChange,
  builtInEnabled,
  cautionEnabled,
}) {
  const [literalInput, setLiteralInput] = useState('');
  const [slotInput, setSlotInput] = useState('');
  const [globalExcludeInput, setGlobalExcludeInput] = useState('');

  useEffect(() => {
    setGlobalExcludeInput('');
  }, [globalExcludePhrases]);

  const literalEntries = listConsistencyEntries(customRules);
  const slotEntries = listPhraseSlotEntries(customRules);
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
          alert(`「${raw}」은 본용언+보조용언 붙이기에 등록하세요.`);
        } else {
          const parts = raw.split(/\s+/).filter(Boolean);
          if (parts.length === 2 && isAuxiliaryStem(parts[1])) {
            alert(`「${raw}」은 본용언+보조용언 붙이기에 등록하세요.`);
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
    for (const raw of planConsistencyEntries(variants)) {
      if (!isPhraseSlotPattern(raw)) {
        alert(`「${raw}」에는 @가 필요합니다. (예: @시대)`);
        continue;
      }
      const batch = buildRulesForPhraseSlot(merged, raw);
      if (!batch.length) continue;
      toAdd.push(...batch);
      merged = [...merged, ...batch];
    }
    if (!toAdd.length) {
      alert('입력한 패턴은 모두 이미 등록되어 있습니다.');
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
      <section className="consistency-unified-box" aria-label="표기 일관성 찾기">
        <div className="consistency-subsection consistency-subsection--first">
          <p className="field-label">일관성 찾기 (1회 검색 8개 이내 추천)</p>
          <p className="hint">
            한글 · 영문 대소문자 · 기호 · 띄어쓰기 등을 찾습니다 (예: 조선˅시대/조선시대,
            RED˅PEN/Redpen)
          </p>
          <ConsistencyRegisterField
            value={literalInput}
            onChange={setLiteralInput}
            onRegister={registerLiteral}
            placeholder={SPACE_INPUT_PLACEHOLDER}
            ariaLabel="일관성 찾기 (1회 검색 8개 이내 추천)"
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

        <div className="consistency-subsection">
          <p className="field-label">공통 문자열 찾기</p>
          <p className="hint">
            @을 포함한 공통 문자열을 모두 찾습니다 (예: @시대 → 조선시대, 고려시대,
            신라시대 … / @˅PEN → RED PEN, BLUE PEN)
          </p>
          <ConsistencyRegisterField
            value={slotInput}
            onChange={setSlotInput}
            onRegister={registerSlot}
            placeholder={SPACE_INPUT_PLACEHOLDER}
            ariaLabel="공통 문자열 찾기"
            inputClassName="field-input mono"
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

        <div className="consistency-subsection consistency-subsection--exclude">
          <p className="field-label">검수 제외 단어</p>
          <p className="hint">등록한 단어는 찾지 않습니다 (예: 소녀시대)</p>
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
      </section>

      <section
        className="consistency-section-box"
        aria-labelledby="consistency-aux-heading"
      >
        <div className="bon-bojo-checklist-header">
          <label className="caution-checklist-select-all">
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
              aria-label="본용언+보조용언 붙이기 전체 선택"
            />
          </label>
          <p id="consistency-aux-heading" className="field-label bon-bojo-checklist-title">
            본용언+보조용언 붙이기
            {auxiliaryTotal > 0
              ? ` (선택 ${auxiliaryActiveCount}/${auxiliaryTotal})`
              : ''}
          </p>
        </div>
        <p className="hint">현재 개발중인 기능으로 부족한 점이 있을 수 있습니다</p>
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
      </section>

      <section
        className="consistency-section-box consistency-toc-section"
        aria-labelledby="consistency-toc-heading"
      >
        <div className="consistency-toc-section__header">
          <p id="consistency-toc-heading" className="field-label consistency-toc-section__title">
            목차 · 본문 일관성 검사
          </p>
          <span className="consistency-toc-section__badge">개발중</span>
        </div>
        <div className="consistency-toc-section__body">
          <p className="hint consistency-toc-section__hint">
            목차와 본문의 일관성을 맞춰 보는 검사입니다.
          </p>
        </div>
      </section>
    </div>
  );
}
