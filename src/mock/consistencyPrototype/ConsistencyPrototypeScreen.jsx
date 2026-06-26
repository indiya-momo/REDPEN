import { useCallback, useState } from 'react';
import ConsistencyRegisterField from '../../components/consistency/ConsistencyRegisterField.jsx';
import ExcludePhraseList from '../../components/consistency/ExcludePhraseList.jsx';
import RegisteredChip from '../../components/consistency/RegisteredChip.jsx';
import { SPACE_INPUT_PLACEHOLDER } from '../../components/consistency/constants.js';
import './consistency-prototype.css';
import {
  MOCK_EXCLUDE_PHRASES,
  MOCK_FIND_TERMS,
  MOCK_PHRASE_SLOTS,
  MOCK_UNIFY_MAPPINGS,
} from './mockConsistencyState.js';

function splitCommaInput(raw) {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * DEV: ?window=consistency-mock — 작업대 일관성 UI + 통일형 만들기만 추가
 */
export default function ConsistencyPrototypeScreen() {
  const [literalInput, setLiteralInput] = useState('');
  const [findTerms, setFindTerms] = useState(MOCK_FIND_TERMS);
  const [unifiedDraft, setUnifiedDraft] = useState('붉은 표시');
  const [correctionDraft, setCorrectionDraft] = useState('');
  const [mappings, setMappings] = useState(MOCK_UNIFY_MAPPINGS);
  const [slotInput, setSlotInput] = useState('');
  const [phraseSlots, setPhraseSlots] = useState(MOCK_PHRASE_SLOTS);
  const [excludeInput, setExcludeInput] = useState('');
  const [excludePhrases, setExcludePhrases] = useState(MOCK_EXCLUDE_PHRASES);

  const registerLiteral = useCallback(() => {
    const variants = splitCommaInput(literalInput);
    if (!variants.length) return;
    setFindTerms((prev) => {
      const seen = new Set(prev.map((t) => t.label));
      const next = [...prev];
      for (const label of variants) {
        if (seen.has(label)) continue;
        seen.add(label);
        next.push({
          id: `t-${Date.now()}-${label}`,
          label,
          pinned: false,
        });
      }
      return next;
    });
    setLiteralInput('');
  }, [literalInput]);

  const togglePin = useCallback((id) => {
    setFindTerms((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const pinned = !t.pinned;
        if (pinned) setUnifiedDraft(t.label);
        return { ...t, pinned };
      }),
    );
  }, []);

  const removeFindTerm = useCallback((id) => {
    setFindTerms((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addMapping = useCallback(() => {
    const unified = unifiedDraft.trim();
    const correction = correctionDraft.trim();
    if (!unified || !correction) return;
    setMappings((prev) => [
      ...prev,
      { id: `m-${Date.now()}`, unified, correction },
    ]);
    setCorrectionDraft('');
  }, [correctionDraft, unifiedDraft]);

  const removeMapping = useCallback((id) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const registerSlot = useCallback(() => {
    const value = slotInput.trim();
    if (!value || phraseSlots.includes(value)) return;
    setPhraseSlots((prev) => [...prev, value]);
    setSlotInput('');
  }, [phraseSlots, slotInput]);

  const registerExclude = useCallback(() => {
    const values = splitCommaInput(excludeInput);
    if (!values.length) return;
    setExcludePhrases((prev) => {
      const set = new Set(prev);
      for (const v of values) set.add(v);
      return [...set];
    });
    setExcludeInput('');
  }, [excludeInput]);

  return (
    <div className="consistency-proto-page">
      <div className="consistency-proto__dev-banner" role="status">
        DEV 목업 · <code>?window=consistency-mock</code> · 규칙 저장·검수 없음
        {' · '}
        <a href="/?devPdf=1">실제 작업대</a>
      </div>

      <div className="consistency-proto__frame panel-left">
        <div className="consistency-embed">
          <section className="consistency-unified-box" aria-label="여러 개 찾기">
            <p className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading">
              여러 개 찾기(1회 검수 8개 이내 추천)⭐
            </p>
            <div className="consistency-subsection consistency-subsection--first">
              <p className="hint consistency-hint-block">
                한글 · 영문 대소문자 등을 찾습니다. 여러 항목은 사이에 , 를 넣어 한
                번에 입력하세요
                <br />
                예: 원고 내 &apos;조선시대&apos; 일관성 확인 →{' '}
                <span className="consistency-hint-example">
                  &apos;조선˅시대,조선시대&apos;
                </span>{' '}
                입력 후 검수하세요
                <br />
                결과에 핀 꽂으면 아래 통일형으로 연결됩니다.
              </p>
              <ConsistencyRegisterField
                value={literalInput}
                onChange={setLiteralInput}
                onRegister={registerLiteral}
                placeholder={SPACE_INPUT_PLACEHOLDER}
                ariaLabel="여러 개 찾기"
              />
              {findTerms.length > 0 ? (
                <ul className="tail-list consistency-proto__pin-list" aria-label="등록된 찾기 항목">
                  {findTerms.map((term) => (
                    <li key={term.id} className="consistency-proto__pin-item">
                      <span
                        className={`consistency-proto__pin-chip${term.pinned ? ' consistency-proto__pin-chip--on' : ''}`}
                      >
                        <button
                          type="button"
                          className="consistency-proto__pin-btn"
                          aria-label={
                            term.pinned
                              ? `${term.label} 통일형 고정 해제`
                              : `${term.label} 통일형으로 고정`
                          }
                          aria-pressed={term.pinned}
                          onClick={() => togglePin(term.id)}
                        >
                          📌
                        </button>
                        <span>{term.label}</span>
                        <button
                          type="button"
                          className="consistency-proto__pin-remove"
                          aria-label={`${term.label} 삭제`}
                          onClick={() => removeFindTerm(term.id)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="consistency-subsection consistency-proto-unify">
              <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
                통일형 만들기
              </p>
              <p className="hint">
                찾은 표기를 통일합니다. <strong>수정형</strong>은 원고에서 찾을
                표기, <strong>통일형</strong>은 PDF 위에 보여 줄 안내 문구입니다
                (자동 치환 아님).
              </p>
              <div className="consistency-proto-unify-cols">
                <label className="consistency-proto-unify-field">
                  <span className="consistency-proto-unify-label">통일형</span>
                  <input
                    type="text"
                    className="field-input"
                    value={unifiedDraft}
                    onChange={(e) => setUnifiedDraft(e.target.value)}
                    placeholder="결과에서 고정하거나 직접 입력"
                  />
                </label>
                <div className="consistency-proto-unify-field">
                  <span className="consistency-proto-unify-label">수정형</span>
                  <div className="tail-form consistency-proto-unify-add-row">
                    <input
                      type="text"
                      className="field-input"
                      value={correctionDraft}
                      onChange={(e) => setCorrectionDraft(e.target.value)}
                      placeholder="입력 후 Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMapping();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn consistency-proto-unify-add-btn"
                      onClick={addMapping}
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
              <p className="hint consistency-proto-unify-note">
                통일형을 정하면, 수정형은 검수 시 원고 위에 통일형으로 안내됩니다.
              </p>
              {mappings.length > 0 ? (
                <ul className="consistency-proto__mapping-list" aria-label="통일 매핑">
                  {mappings.map((row) => (
                    <li key={row.id} className="consistency-proto__mapping">
                      <span className="consistency-proto__mapping-correction">
                        {row.correction}
                      </span>
                      <span aria-hidden>→</span>
                      <span className="consistency-proto__mapping-unified">
                        {row.unified}
                      </span>
                      <button
                        type="button"
                        className="consistency-proto__mapping-remove"
                        aria-label={`${row.correction} → ${row.unified} 삭제`}
                        onClick={() => removeMapping(row.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="consistency-subsection-row">
              <div className="consistency-subsection consistency-subsection--half">
                <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
                  공통 문자열 찾기(1개)
                </p>
                <div className="consistency-subsection__hints-area">
                  <p className="hint consistency-hint-block">
                    @을 포함한 항목을 모두 찾습니다
                    <br />
                    예: <span className="consistency-hint-example">&apos;@시대&apos;</span>{' '}
                    검색→{' '}
                    <span className="consistency-hint-example">
                      &apos;조선시대, 고려시대, 신라시대&apos;
                    </span>{' '}
                    표시
                  </p>
                </div>
                <ConsistencyRegisterField
                  value={slotInput}
                  onChange={setSlotInput}
                  onRegister={registerSlot}
                  placeholder={SPACE_INPUT_PLACEHOLDER}
                  ariaLabel="공통 문자열 찾기(1개)"
                  inputClassName="field-input mono"
                />
                {phraseSlots.length > 0 ? (
                  <ul className="tail-list">
                    {phraseSlots.map((slot) => (
                      <RegisteredChip
                        key={slot}
                        label={slot}
                        onRemove={() =>
                          setPhraseSlots((prev) => prev.filter((s) => s !== slot))
                        }
                      />
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="consistency-subsection consistency-subsection--half consistency-subsection--exclude">
                <p className="printed-page-setup__title consistency-subsection-title">
                  검수 제외 단어
                </p>
                <div className="consistency-subsection__hints-area">
                  <p className="hint">
                    등록한 단어는 찾지 않습니다
                    <br />
                    예: <span className="consistency-hint-example">&apos;소녀시대&apos;</span>
                  </p>
                </div>
                <ConsistencyRegisterField
                  value={excludeInput}
                  onChange={setExcludeInput}
                  onRegister={registerExclude}
                  placeholder={SPACE_INPUT_PLACEHOLDER}
                  ariaLabel="검수 제외 단어"
                />
                <ExcludePhraseList
                  phrases={excludePhrases}
                  onRemove={(phrase) =>
                    setExcludePhrases((prev) => prev.filter((p) => p !== phrase))
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
