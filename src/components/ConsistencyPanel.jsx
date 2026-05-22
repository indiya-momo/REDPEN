import { useEffect, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { BUILT_IN_RULES, MAX_RULES } from '../lib/builtInRules.js';
import {
  buildRulesForEntry,
  isConsistencyEntryEnabled,
  listConsistencyEntries,
  parseConsistencyInput,
  planConsistencyEntries,
  removeConsistencyEntry,
  toggleConsistencyEntry,
} from '../lib/compoundPairRegister.js';
import { parseCommaList } from '../lib/matchFilters.js';
import { compileRuleRegex, ruleDisplayLabel } from '../lib/regexFromFind.js';
import {
  formatCompoundSpacingLabel,
  formatCompoundTailLabel,
} from '../lib/patternDisplayLabels.js';
import { encodeSpacesVisible } from '../lib/spaceVisibleText.js';
import SpaceVisibleInput from './SpaceVisibleInput.jsx';

const COMPOUND_KINDS = new Set(['compound-tail', 'compound-spacing']);

/**
 * @param {{
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   globalExcludePhrases: string[],
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   builtInEnabled: Record<string, boolean>,
 *   onRunCheck?: () => void,
 *   isProcessing?: boolean,
 *   canRunCheck?: boolean,
 *   progress?: { current: number, total: number, phase: string } | null,
 *   progressLabel?: string | null,
 * }} props
 */
export default function ConsistencyPanel({
  customRules,
  onCustomRulesChange,
  globalExcludePhrases,
  onGlobalExcludePhrasesChange,
  builtInEnabled,
  onRunCheck,
  isProcessing = false,
  canRunCheck = false,
  progress = null,
  progressLabel = null,
}) {
  const [consistencyInput, setConsistencyInput] = useState('');
  const [globalExcludeInput, setGlobalExcludeInput] = useState('');
  const [newFind, setNewFind] = useState('');
  const [newReplace, setNewReplace] = useState('');
  const [newPattern, setNewPattern] = useState('literal');

  useEffect(() => {
    setGlobalExcludeInput('');
  }, [globalExcludePhrases]);

  const enabledBuiltIn = BUILT_IN_RULES.filter(
    (r) => builtInEnabled[r.find] !== false,
  ).length;
  const enabledCustom = customRules.filter((r) => r.enabled).length;
  const totalEnabled = enabledBuiltIn + enabledCustom;
  const slotsLeft = MAX_RULES - totalEnabled;

  const registeredEntries = listConsistencyEntries(customRules);

  const otherRules = customRules.filter(
    (r) => !COMPOUND_KINDS.has(r.patternKind ?? ''),
  );

  function registerConsistency() {
    const variants = parseConsistencyInput(consistencyInput);
    if (!variants.length) {
      alert('패턴을 입력하세요.');
      return;
    }

    const entries = planConsistencyEntries(variants);
    let merged = customRules;
    /** @type {import('../lib/ruleTypes.js').Rule[]} */
    const toAdd = [];

    for (const tailWord of entries) {
      const batch = buildRulesForEntry(merged, tailWord);
      if (!batch.length) continue;
      toAdd.push(...batch);
      merged = [...merged, ...batch];
    }

    if (!toAdd.length) {
      alert('입력한 패턴은 모두 이미 등록되어 있습니다.');
      return;
    }

    const needSlots = toAdd.filter((r) => r.enabled).length;
    if (totalEnabled + needSlots > MAX_RULES) {
      alert(`활성 규칙은 최대 ${MAX_RULES}개입니다. (추가 시 ${needSlots}칸 필요)`);
      return;
    }

    onCustomRulesChange([...customRules, ...toAdd]);
    setConsistencyInput('');
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

  function addCustomRule() {
    if (!newFind.trim() || !newReplace.trim()) return;
    if (totalEnabled >= MAX_RULES) {
      alert(`규칙은 최대 ${MAX_RULES}개까지 활성화할 수 있습니다.`);
      return;
    }
    const rule = {
      find: newFind.trim(),
      replace: newReplace.trim(),
      enabled: true,
      pattern: newPattern,
      patternKind: newPattern === 'regex' ? 'custom-regex' : undefined,
    };
    if (newPattern === 'regex' && !compileRuleRegex(rule)) {
      alert('정규식 문법을 확인해 주세요.');
      return;
    }
    onCustomRulesChange([...customRules, rule]);
    setNewFind('');
    setNewReplace('');
    setNewPattern('literal');
  }

  function deleteOtherRule(index) {
    const rule = otherRules[index];
    onCustomRulesChange(customRules.filter((r) => r !== rule));
  }

  function toggleOtherRule(index) {
    const rule = otherRules[index];
    const willEnable = !rule.enabled;
    if (willEnable && totalEnabled >= MAX_RULES) {
      alert(`규칙은 최대 ${MAX_RULES}개입니다.`);
      return;
    }
    onCustomRulesChange(
      customRules.map((r) => (r === rule ? { ...r, enabled: willEnable } : r)),
    );
  }

  const checking = isProcessing && progress?.phase === 'check';

  return (
    <div className="consistency-embed">
      <section
        className="consistency-section-box"
        aria-labelledby="consistency-register-heading"
      >
        <p id="consistency-register-heading" className="field-label">
          일관성 등록
        </p>
        <p className="hint" style={{ marginTop: 4 }}>
          예: 빨간펜, 빨간˅펜, REDPEN, RED˅PEN, Red˅Pen
        </p>
        <div className="tail-form">
          <div>
            <SpaceVisibleInput
              value={consistencyInput}
              onChange={setConsistencyInput}
              placeholder="공백은 ˅로 표시됩니다"
              aria-label="일관성 등록"
            />
          </div>
          <button type="button" className="btn-add" onClick={registerConsistency}>
            <Plus size={14} />
            등록
          </button>
        </div>

        {registeredEntries.length > 0 && (
          <ul className="tail-list">
            {registeredEntries.map((row) => (
              <li key={row.tailWord} className="rule-row">
                <input
                  type="checkbox"
                  checked={isConsistencyEntryEnabled(customRules, row.tailWord)}
                  onChange={(e) =>
                    onCustomRulesChange(
                      toggleConsistencyEntry(
                        customRules,
                        row.tailWord,
                        e.target.checked,
                      ),
                    )
                  }
                />
                <div className="rule-text consistency-pair-labels">
                  {row.hasTail && (
                    <span className="consistency-pair-line">
                      <span className="badge-regex">붙임</span>
                      <span className="find">
                        {formatCompoundTailLabel(row.tailWord)}
                      </span>
                    </span>
                  )}
                  {row.hasSpacing && (
                    <span className="consistency-pair-line">
                      <span className="badge-regex badge-spacing">띄움</span>
                      <span className="find">
                        {formatCompoundSpacingLabel(row.tailWord)}
                      </span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() =>
                    onCustomRulesChange(
                      removeConsistencyEntry(customRules, row.tailWord),
                    )
                  }
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="consistency-section-box" aria-labelledby="consistency-rule-heading">
        <div className="rule-form rule-form--boxed">
          <p id="consistency-rule-heading" className="field-label">
            문자열 / 정규식 규칙 (개별)
          </p>
          <label className="pattern-toggle">
            <input
              type="checkbox"
              checked={newPattern === 'regex'}
              onChange={(e) => setNewPattern(e.target.checked ? 'regex' : 'literal')}
            />
            정규식 직접 입력 ($1 = 앞의 한 덩어리)
          </label>
          <div>
            <label className="field-label">
              {newPattern === 'regex' ? '정규식 (찾기)' : '찾기'}
            </label>
            {newPattern === 'regex' ? (
              <input
                className="field-input mono"
                value={newFind}
                onChange={(e) => setNewFind(e.target.value)}
                placeholder={String.raw`예: (\S+)\s+정책`}
              />
            ) : (
              <SpaceVisibleInput
                className="field-input mono"
                value={newFind}
                onChange={setNewFind}
                placeholder="예: 우리˅나라"
              />
            )}
          </div>
          <div>
            <label className="field-label">
              {newPattern === 'regex' ? '바꿀 표기 (안내)' : '변경'}
            </label>
            {newPattern === 'regex' ? (
              <input
                className="field-input mono"
                value={newReplace}
                onChange={(e) => setNewReplace(e.target.value)}
                placeholder="예: $1정책"
              />
            ) : (
              <SpaceVisibleInput
                className="field-input mono"
                value={newReplace}
                onChange={setNewReplace}
                placeholder="예: 우리나라"
              />
            )}
          </div>
          <button type="button" className="btn-add" onClick={addCustomRule}>
            <Plus size={14} />
            규칙 추가
          </button>
        </div>

        {otherRules.length > 0 && (
          <ul className="rule-list">
            {otherRules.map((rule, i) => (
              <li key={`${rule.find}-${i}`} className="rule-row">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleOtherRule(i)}
                />
                <div className="rule-text">
                  {rule.pattern === 'regex' && (
                    <span className="badge-regex">정규식</span>
                  )}
                  <span className="find">{ruleDisplayLabel(rule)}</span>
                </div>
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => deleteOtherRule(i)}
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ marginTop: 8 }}>
          남은 활성 슬롯: {Math.max(0, slotsLeft)} / {MAX_RULES}
        </p>
      </section>

      <section className="consistency-section-box" aria-labelledby="consistency-exclude-heading">
        <p id="consistency-exclude-heading" className="field-label">
          검사 제외 구문 (전체)
        </p>
        <p className="hint" style={{ marginTop: 4 }}>
          어떤 규칙이든 아래 문구는 <strong>검사하지 않음</strong>.
          공백은 입력 시 <strong>˅</strong> 로 보입니다. 예: <code>경제˅학자</code>
        </p>
        <SpaceVisibleInput
          value={globalExcludeInput}
          onChange={setGlobalExcludeInput}
          placeholder="경제˅학자, … (쉼표로 구분)"
        />
        <button type="button" className="btn-add" style={{ marginTop: 8 }} onClick={addGlobalExcludePhrases}>
          <Plus size={14} />
          제외목록 추가
        </button>

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
      </section>

      {onRunCheck && (
        <section className="consistency-section-box consistency-run-box">
          <button
            type="button"
            className="btn-run"
            onClick={onRunCheck}
            disabled={isProcessing || !canRunCheck}
          >
            <Play size={16} />
            {checking ? '검사 중…' : '검사 실행'}
          </button>
          {isProcessing && progressLabel && progress?.phase !== 'check' && (
            <>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p className="hint">{progressLabel}</p>
            </>
          )}
          {isProcessing && progress?.phase === 'check' && (
            <p className="hint" style={{ marginTop: 8 }}>
              검사 실행 중…
            </p>
          )}
          {!canRunCheck && (
            <p className="hint" style={{ marginTop: 8 }}>
              위에서 PDF를 연 뒤 검사할 수 있습니다.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
