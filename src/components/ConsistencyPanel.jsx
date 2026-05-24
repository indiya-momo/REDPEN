import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  buildRulesForAuxiliaryEntry,
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
  parseAuxiliaryInput,
  removeAuxiliaryVerbEntry,
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
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';
import { encodeSpacesVisible } from '../lib/spaceVisibleText.js';
import SpaceVisibleInput from './SpaceVisibleInput.jsx';

const SPACE_INPUT_PLACEHOLDER = '공백은 ˅로 표시';

/**
 * @param {{
 *   entries: { tailWord: string }[],
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   isEnabled: (rules: import('../lib/ruleTypes.js').Rule[], tw: string) => boolean,
 *   onToggle: (tw: string, enabled: boolean) => void,
 *   onRemove: (tw: string) => void,
 * }} props
 */
function RegisteredList({
  entries,
  customRules,
  isEnabled,
  onToggle,
  onRemove,
}) {
  if (!entries.length) return null;
  return (
    <ul className="tail-list">
      {entries.map((row) => (
        <li key={row.tailWord} className="rule-row">
          <input
            type="checkbox"
            checked={isEnabled(customRules, row.tailWord)}
            onChange={(e) => onToggle(row.tailWord, e.target.checked)}
          />
          <div className="rule-text">
            <span className="find">
              {formatConsistencyListLabel(row.tailWord)}
            </span>
          </div>
          <button
            type="button"
            className="btn-icon danger"
            onClick={() => onRemove(row.tailWord)}
            aria-label="삭제"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
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
  const [auxiliaryInput, setAuxiliaryInput] = useState('');
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
          alert(`「${raw}」은 본용언+보조용언 찾기에 등록하세요.`);
        } else {
          const parts = raw.split(/\s+/).filter(Boolean);
          if (parts.length === 2 && isAuxiliaryStem(parts[1])) {
            alert(`「${raw}」은 본용언+보조용언 찾기에 등록하세요.`);
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

  function registerAuxiliary() {
    const variants = parseAuxiliaryInput(auxiliaryInput);
    if (!variants.length) {
      alert('보조용언 패턴을 입력하세요.');
      return;
    }
    let merged = customRules;
    const toAdd = [];
    for (const raw of planConsistencyEntries(variants)) {
      const batch = buildRulesForAuxiliaryEntry(merged, raw);
      if (!batch.length) continue;
      toAdd.push(...batch);
      merged = [...merged, ...batch];
    }
    if (!toAdd.length) {
      alert('입력한 항목은 모두 이미 등록되어 있습니다.');
      return;
    }
    if (!assertSlots(toAdd)) return;
    setAuxiliaryInput('');
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
            isEnabled={isConsistencyEntryEnabled}
            onToggle={(tw, on) =>
              applyCustomRules(toggleConsistencyEntry(customRules, tw, on))
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
            isEnabled={isPhraseSlotEntryEnabled}
            onToggle={(tw, on) =>
              applyCustomRules(togglePhraseSlotEntry(customRules, tw, on))
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
              제외 추가
            </button>
          </div>
          {globalExcludePhrases.length > 0 && (
            <ul className="tail-list" style={{ marginTop: 10 }}>
              {globalExcludePhrases.map((phrase) => (
                <li key={phrase} className="rule-row">
                  <div className="rule-text">
                    <span className="find">{encodeSpacesVisible(phrase)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon danger"
                    onClick={() => removeGlobalExclude(phrase)}
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
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
        <p id="consistency-aux-heading" className="field-label">
          본용언+보조용언 찾기
        </p>
        <p className="hint">
          앞말+보조용언+어미 (예: 보, 주, 준, 해˅보, 해보, 해˅준)
        </p>
        <div className="tail-form">
          <SpaceVisibleInput
            value={auxiliaryInput}
            onChange={setAuxiliaryInput}
            placeholder={SPACE_INPUT_PLACEHOLDER}
            aria-label="본용언 보조용언 찾기"
          />
          <button type="button" className="btn-add" onClick={registerAuxiliary}>
            <Plus size={14} />
            등록
          </button>
        </div>
        <RegisteredList
          entries={auxiliaryEntries}
          customRules={customRules}
          isEnabled={isAuxiliaryVerbEntryEnabled}
          onToggle={(tw, on) =>
            applyCustomRules(toggleAuxiliaryVerbEntry(customRules, tw, on))
          }
          onRemove={(tw) =>
            onCustomRulesChange(removeAuxiliaryVerbEntry(customRules, tw))
          }
        />
      </section>
    </div>
  );
}
