import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from '../lib/activeRuleCount.js';
import { MAX_RULES } from '../lib/builtInRules.js';
import {
  buildRulesForEntry,
  isConsistencyEntryEnabled,
  isLiteralConsistencyEntry,
  listConsistencyEntries,
  parseConsistencyInput,
  planConsistencyEntries,
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
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';
import { encodeSpacesVisible } from '../lib/spaceVisibleText.js';
import SpaceVisibleInput from './SpaceVisibleInput.jsx';

const SPACE_INPUT_PLACEHOLDER = '공백은 ˅로 표시';

/**
 * @param {{
 *   entries: { tailWord: string, displayLabel?: string }[],
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *     enabled: boolean,
 *   ) => void,
 *   onRemove?: (tw: string) => void,
 *   columns?: number,
 *   showRemove?: boolean,
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 * }} props
 */
function AuxiliaryGridChip({ row, customRules, isEnabled, onToggle, isRequired }) {
  const label =
    row.displayLabel?.trim() || formatConsistencyListLabel(row.tailWord);
  return (
    <label className="auxiliary-chip">
      <input
        type="checkbox"
        checked={isEnabled(customRules, row)}
        onChange={(e) => onToggle(row, e.target.checked)}
      />
      <span className="find">{label}</span>
      {isRequired?.(row) ? (
        <span className="bon-bojo-required-badge">필수</span>
      ) : null}
    </label>
  );
}

function RegisteredList({
  entries,
  customRules,
  isEnabled,
  onToggle,
  onRemove,
  columns = 1,
  showRemove = true,
  isRequired,
}) {
  if (!entries.length) return null;
  const gridCols = columns > 1 ? columns : 0;
  const listClass = gridCols
    ? `tail-list tail-list--grid tail-list--grid-${gridCols}`
    : 'tail-list';

  if (gridCols && isRequired) {
    const optionalEntries = entries.filter((row) => !isRequired(row));
    const requiredEntries = entries.filter((row) => isRequired(row));

    return (
      <div className="auxiliary-checklist">
        {optionalEntries.length > 0 ? (
          <ul className={listClass}>
            {optionalEntries.map((row) => {
              const rowKey = row.bonBojoItemId || row.tailWord;
              return (
                <li key={rowKey} className="tail-grid-item">
                  <AuxiliaryGridChip
                    row={row}
                    customRules={customRules}
                    isEnabled={isEnabled}
                    onToggle={onToggle}
                    isRequired={isRequired}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        {requiredEntries.length > 0 ? (
          <ul
            className="tail-list tail-list--grid tail-list--grid-required"
            aria-label="필수 본용언+보조용언"
          >
            {requiredEntries.map((row) => {
              const rowKey = row.bonBojoItemId || row.tailWord;
              return (
                <li key={rowKey} className="tail-grid-item">
                  <AuxiliaryGridChip
                    row={row}
                    customRules={customRules}
                    isEnabled={isEnabled}
                    onToggle={onToggle}
                    isRequired={isRequired}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <ul className={listClass}>
      {entries.map((row) => {
        const rowKey = row.bonBojoItemId || row.tailWord;
        const label =
          row.displayLabel?.trim() ||
          formatConsistencyListLabel(row.tailWord);
        if (gridCols) {
          return (
            <li key={rowKey} className="tail-grid-item">
              <AuxiliaryGridChip
                row={row}
                customRules={customRules}
                isEnabled={isEnabled}
                onToggle={onToggle}
                isRequired={isRequired}
              />
            </li>
          );
        }
        return (
          <li key={rowKey} className="registered-chip">
            <label className="registered-chip__label">
              <input
                type="checkbox"
                checked={isEnabled(customRules, row)}
                onChange={(e) => onToggle(row, e.target.checked)}
              />
              <span className="find">{label}</span>
            </label>
            {showRemove && onRemove ? (
              <button
                type="button"
                className="btn-icon btn-icon--dismiss"
                onClick={() => onRemove(row.tailWord)}
                aria-label={`${label} 제거`}
              >
                <X size={14} strokeWidth={2.25} aria-hidden />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

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

  const totalEnabled = countActiveRules({
    builtInEnabled,
    cautionEnabled,
    customRules,
  });
  const slotsLeft = MAX_RULES - totalEnabled;

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
          <p className="field-label">문자열 찾기</p>
          <p className="hint">
            한글과 영문 대소문자를 등록한 그대로 찾습니다 (예: 조선˅시대/조선시대,
            RED˅PEN/Redpen)
          </p>
          <div className="tail-form">
            <SpaceVisibleInput
              value={literalInput}
              onChange={setLiteralInput}
              placeholder={SPACE_INPUT_PLACEHOLDER}
              aria-label="문자열 찾기"
            />
            <button type="button" className="btn-add" onClick={registerLiteral}>
              <Plus size={14} />
              등록
            </button>
          </div>
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
          <div className="tail-form">
            <SpaceVisibleInput
              className="field-input mono"
              value={slotInput}
              onChange={setSlotInput}
              placeholder={SPACE_INPUT_PLACEHOLDER}
              aria-label="공통 문자열 찾기"
            />
            <button type="button" className="btn-add" onClick={registerSlot}>
              <Plus size={14} />
              등록
            </button>
          </div>
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
          <p className="field-label">검사 제외 문구</p>
          <p className="hint">등록한 문구는 찾지 않습니다 (예: 소녀시대)</p>
          <div className="tail-form">
            <SpaceVisibleInput
              value={globalExcludeInput}
              onChange={setGlobalExcludeInput}
              placeholder={SPACE_INPUT_PLACEHOLDER}
            />
            <button
              type="button"
              className="btn-add"
              onClick={addGlobalExcludePhrases}
            >
              <Plus size={14} />
              등록
            </button>
          </div>
          {globalExcludePhrases.length > 0 && (
            <ul className="tail-list" style={{ marginTop: 10 }}>
              {globalExcludePhrases.map((phrase) => (
                <li key={phrase} className="registered-chip">
                  <span className="find registered-chip__text">
                    {encodeSpacesVisible(phrase)}
                  </span>
                  <button
                    type="button"
                    className="btn-icon btn-icon--dismiss"
                    onClick={() => removeGlobalExclude(phrase)}
                    aria-label={`${phrase} 제거`}
                  >
                    <X size={14} strokeWidth={2.25} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
          남은 활성 슬롯: {Math.max(0, slotsLeft)} / {MAX_RULES}
        </p>
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
        <p className="hint">띄어쓰기 찾기, 개발중, 규칙수 비포함</p>
        <RegisteredList
          entries={auxiliaryEntries}
          customRules={customRules}
          isEnabled={isAuxiliaryVerbEntryEnabled}
          onToggle={(row, on) =>
            applyCustomRules(toggleAuxiliaryVerbEntry(customRules, row, on))
          }
          columns={3}
          showRemove={false}
          isRequired={(row) => isBonBojoRequiredItem(row.bonBojoItemId)}
        />
      </section>

      <section
        className="consistency-section-box consistency-toc-section"
        aria-labelledby="consistency-toc-heading"
      >
        <div className="consistency-toc-section__header">
          <p id="consistency-toc-heading" className="field-label consistency-toc-section__title">
            목차 검사
          </p>
          <span className="consistency-toc-section__badge">개발중</span>
        </div>
        <div className="consistency-toc-section__body">
          <p className="hint consistency-toc-section__hint">
            목차의 장 제목·페이지와 본문 해당 쪽 제목을 맞춰 보는 검사입니다. 규칙
            슬롯(1000개)에는 포함되지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
