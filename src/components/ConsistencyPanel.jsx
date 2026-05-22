import { useEffect, useState } from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { BUILT_IN_RULES, MAX_RULES } from '../lib/builtInRules.js';
import {
  buildCompoundSpacingRules,
  hasCompoundSpacing,
  parseSpacingTailWords,
  removeCompoundSpacing,
} from '../lib/compoundSpacingPattern.js';
import {
  buildCompoundTailRules,
  hasCompoundTail,
  parseTailWords,
  removeCompoundTail,
} from '../lib/compoundTailPattern.js';
import { parseCommaList } from '../lib/matchFilters.js';
import { compileRuleRegex, ruleDisplayLabel } from '../lib/regexFromFind.js';

const COMPOUND_KINDS = new Set(['compound-tail', 'compound-spacing']);

/**
 * @param {{
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   globalExcludePhrases: string[],
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   builtInEnabled: Record<string, boolean>,
 *   embedded?: boolean,
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
  embedded = false,
  onRunCheck,
  isProcessing = false,
  canRunCheck = false,
  progress = null,
  progressLabel = null,
}) {
  const [tailWord, setTailWord] = useState('');
  const [spacingTailWord, setSpacingTailWord] = useState('');
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

  const registeredTails = [
    ...new Set(
      customRules
        .filter((r) => r.patternKind === 'compound-tail' && r.tailWord)
        .map((r) => r.tailWord),
    ),
  ];

  const registeredSpacingTails = [
    ...new Set(
      customRules
        .filter((r) => r.patternKind === 'compound-spacing' && r.tailWord)
        .map((r) => r.tailWord),
    ),
  ];

  const otherRules = customRules.filter(
    (r) => !COMPOUND_KINDS.has(r.patternKind ?? ''),
  );

  function addCompoundTail() {
    const tails = parseTailWords(tailWord);
    if (!tails.length) {
      alert('꼬리 단어를 입력하세요. (예: 정책, 상황 또는 정책,상황)');
      return;
    }

    const toAdd = [];
    for (const tail of tails) {
      if (hasCompoundTail(customRules, tail)) {
        alert(`「${tail}」은(는) 이미 등록되어 있어 건너뜁니다.`);
        continue;
      }
      toAdd.push(...buildCompoundTailRules(tail));
    }
    if (!toAdd.length) return;

    const needSlots = toAdd.filter((r) => r.enabled).length;
    if (totalEnabled + needSlots > MAX_RULES) {
      alert(`활성 규칙은 최대 ${MAX_RULES}개입니다. (추가 시 ${needSlots}칸 필요)`);
      return;
    }
    onCustomRulesChange([...customRules, ...toAdd]);
    setTailWord('');
  }

  function addCompoundSpacing() {
    const tails = parseSpacingTailWords(spacingTailWord);
    if (!tails.length) {
      alert('꼬리 단어를 입력하세요. (예: 정책, 상황 또는 정책,상황)');
      return;
    }

    const toAdd = [];
    for (const tail of tails) {
      if (hasCompoundSpacing(customRules, tail)) {
        alert(`「${tail}」은(는) 이미 등록되어 있어 건너뜁니다.`);
        continue;
      }
      toAdd.push(...buildCompoundSpacingRules(tail));
    }
    if (!toAdd.length) return;

    const needSlots = toAdd.filter((r) => r.enabled).length;
    if (totalEnabled + needSlots > MAX_RULES) {
      alert(`활성 규칙은 최대 ${MAX_RULES}개입니다. (추가 시 ${needSlots}칸 필요)`);
      return;
    }
    onCustomRulesChange([...customRules, ...toAdd]);
    setSpacingTailWord('');
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

  function removeTailGroup(tail) {
    onCustomRulesChange(removeCompoundTail(customRules, tail));
  }

  function removeSpacingTailGroup(tail) {
    onCustomRulesChange(removeCompoundSpacing(customRules, tail));
  }

  function toggleTailGroup(tail, enabled) {
    onCustomRulesChange(
      customRules.map((r) =>
        r.patternKind === 'compound-tail' && r.tailWord === tail
          ? { ...r, enabled }
          : r,
      ),
    );
  }

  function toggleSpacingTailGroup(tail, enabled) {
    onCustomRulesChange(
      customRules.map((r) =>
        r.patternKind === 'compound-spacing' && r.tailWord === tail
          ? { ...r, enabled }
          : r,
      ),
    );
  }

  function isTailGroupEnabled(tail, kind) {
    const group = customRules.filter(
      (r) => r.patternKind === kind && r.tailWord === tail,
    );
    return group.length > 0 && group.every((r) => r.enabled);
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
      alert(`규칙은 최대 ${MAX_RULES}개까지 활성화할 수 있습니다.`);
      return;
    }
    onCustomRulesChange(
      customRules.map((r) => (r === rule ? { ...r, enabled: willEnable } : r)),
    );
  }

  const checking = isProcessing && progress?.phase === 'check';

  return (
    <div className={embedded ? 'consistency-embed' : 'settings-panel'}>
      <section className="consistency-section-box" aria-labelledby="consistency-tail-heading">
        <p id="consistency-tail-heading" className="field-label">
          붙임 패턴 — ○○ + [단어]
        </p>
        <p className="hint" style={{ marginTop: 4 }}>
          앞말 + 띄어쓰기 + <strong>꼬리 단어</strong>를 찾습니다. 예: 「금융 정책」→「금융정책」
        </p>
        <div className="tail-form">
          <div>
            <label className="field-label">꼬리 단어 [단어]</label>
            <input
              className="field-input"
              value={tailWord}
              onChange={(e) => setTailWord(e.target.value)}
              placeholder="예: 정책, 상황 (쉼표로 여러 개)"
            />
          </div>
          <button type="button" className="btn-add" onClick={addCompoundTail}>
            <Plus size={14} />
            붙임 패턴 등록
          </button>
        </div>

        {registeredTails.length > 0 && (
          <ul className="tail-list">
            {registeredTails.map((tail) => (
              <li key={tail} className="rule-row">
                <input
                  type="checkbox"
                  checked={isTailGroupEnabled(tail, 'compound-tail')}
                  onChange={(e) => toggleTailGroup(tail, e.target.checked)}
                />
                <div className="rule-text">
                  <span className="badge-regex">붙임</span>
                  <span className="find">
                    ○○ {tail} → ○○{tail}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => removeTailGroup(tail)}
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="consistency-section-box"
        aria-labelledby="consistency-spacing-heading"
      >
        <p id="consistency-spacing-heading" className="field-label">
          띄우기 패턴 — ○○[단어]
        </p>
        <p className="hint" style={{ marginTop: 4 }}>
          붙어 쓴 <strong>꼬리 단어</strong>를 찾습니다. 예: 「금융정책」→「금융 정책」
        </p>
        <div className="tail-form">
          <div>
            <label className="field-label">꼬리 단어 [단어]</label>
            <input
              className="field-input"
              value={spacingTailWord}
              onChange={(e) => setSpacingTailWord(e.target.value)}
              placeholder="예: 정책, 상황 (쉼표로 여러 개)"
            />
          </div>
          <button type="button" className="btn-add" onClick={addCompoundSpacing}>
            <Plus size={14} />
            띄우기 패턴 등록
          </button>
        </div>

        {registeredSpacingTails.length > 0 && (
          <ul className="tail-list">
            {registeredSpacingTails.map((tail) => (
              <li key={tail} className="rule-row">
                <input
                  type="checkbox"
                  checked={isTailGroupEnabled(tail, 'compound-spacing')}
                  onChange={(e) => toggleSpacingTailGroup(tail, e.target.checked)}
                />
                <div className="rule-text">
                  <span className="badge-regex badge-spacing">띄움</span>
                  <span className="find">
                    ○○{tail} → ○○ {tail}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => removeSpacingTailGroup(tail)}
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
            <input
              className="field-input mono"
              value={newFind}
              onChange={(e) => setNewFind(e.target.value)}
              placeholder={newPattern === 'regex' ? String.raw`예: (\S+)\s+정책` : '예: 우리 나라'}
            />
          </div>
          <div>
            <label className="field-label">
              {newPattern === 'regex' ? '바꿀 표기 (안내)' : '변경'}
            </label>
            <input
              className="field-input mono"
              value={newReplace}
              onChange={(e) => setNewReplace(e.target.value)}
              placeholder={newPattern === 'regex' ? '예: $1정책' : '예: 우리나라'}
            />
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
          예: <code>경제 학자</code>
        </p>
        <input
          className="field-input"
          value={globalExcludeInput}
          onChange={(e) => setGlobalExcludeInput(e.target.value)}
          placeholder="경제 학자, … (쉼표로 구분)"
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
                  <span className="find">{phrase}</span>
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
