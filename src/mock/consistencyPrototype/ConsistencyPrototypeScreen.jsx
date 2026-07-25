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
 * DEV: ?window=consistency-mock
 * 표기 통일하기를 외래어 변환처럼 탭 맨 위 분리 카드로 둔 목업
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
    const parts = splitCommaInput(correctionDraft);
    if (!parts.length) return;
    const unified = parts[0];
    const corrections = parts.length > 1 ? parts.slice(1) : [];
    if (corrections.length) {
      setMappings((prev) => [
        ...prev,
        ...corrections.map((correction, i) => ({
          id: `m-${Date.now()}-${i}-${correction}`,
          unified,
          correction,
        })),
      ]);
    }
    setUnifiedDraft(unified);
    setCorrectionDraft('');
  }, [correctionDraft]);

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
        DEV 목업 · <code>?window=consistency-mock</code> · 통일형 맨 위 분리
        {' · '}
        <a href="/?devPdf=1">실제 작업대</a>
      </div>

      <div className="consistency-proto__frame panel-left">
        <div className="consistency-embed">
          <section
            className="consistency-unify-hero"
            aria-label="표기 통일하기"
          >
            <div className="consistency-unify-hero__summary panel-criteria-heading">
              <span className="consistency-unify-hero__summary-title">
                표기 통일하기
                <span className="panel-criteria-heading-meta">
                  (최대 3항목, 통일형 1항목)
                </span>
                <span
                  className="consistency-unify-hero__badge"
                  aria-label="하루 5회"
                >
                  1일 5회
                </span>
                <span
                  className="consistency-unify-hero__badge consistency-unify-hero__badge--feedback"
                  aria-label="피드백 시 10회"
                  title="피드백을 남기면 하루 10회"
                >
                  ×2 피드백
                </span>
              </span>
            </div>
            <p className="hint consistency-hint-block consistency-unify-hero__hint">
              여러 항목 중 하나를 통일형📌으로 지정하고, 나머지를 찾아 바꿀 수
              있습니다
              <br />
              예:{' '}
              <span className="consistency-hint-example">
                &apos;조선시대,조선˅시대&apos;
              </span>{' '}
              입력 → &apos;조선시대&apos; 통일형 📌지정하고 찾기
            </p>
            <div className="consistency-unify-action-row">
              <div className="consistency-unify-action-row__field">
                <ConsistencyRegisterField
                  value={correctionDraft}
                  onChange={setCorrectionDraft}
                  onRegister={addMapping}
                  placeholder="조선시대,조선˅시대"
                  ariaLabel="표기 통일하기"
                  addLabel="등록"
                />
              </div>
              <button
                type="button"
                className="consistency-unify-run-btn"
                disabled={mappings.length === 0}
                title="목업 — 등록한 통일형만 검수"
              >
                검수
              </button>
            </div>
            {mappings.length > 0 ? (
              <ul
                className="tail-list consistency-proto__pin-list"
                aria-label="통일 매핑"
              >
                {mappings.map((row) => (
                  <li key={row.id} className="consistency-proto__pin-item">
                    <span className="consistency-proto__pin-chip consistency-proto__pin-chip--on">
                      <span className="consistency-proto__pin-btn" aria-hidden>
                        📌
                      </span>
                      <span>
                        {row.correction} → {row.unified}
                      </span>
                      <button
                        type="button"
                        className="consistency-proto__pin-remove"
                        aria-label={`${row.correction} → ${row.unified} 삭제`}
                        onClick={() => removeMapping(row.id)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="consistency-unified-box" aria-label="여러 항목 찾기">
            <p className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading">
              여러 항목 찾기
              <span className="panel-criteria-heading-meta">
                (최대 5항목, 영문 대소문자 지원)
              </span>
            </p>
            <div className="consistency-subsection consistency-subsection--first">
              <p className="hint consistency-hint-block">
                여러 항목 사이 &apos;,&apos;를 넣어 입력하면 한 번에 찾을 수
                있습니다
                <br />
                예:{' '}
                <span className="consistency-hint-example">
                  &apos;고구려,백제,신라,Silla&apos;
                </span>{' '}
                입력 → 4항목 한 번에 찾기
              </p>
              <ConsistencyRegisterField
                value={literalInput}
                onChange={setLiteralInput}
                onRegister={registerLiteral}
                placeholder={SPACE_INPUT_PLACEHOLDER}
                ariaLabel="여러 항목 찾기"
              />
              {findTerms.length > 0 ? (
                <ul
                  className="tail-list consistency-proto__pin-list"
                  aria-label="등록된 찾기 항목"
                >
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

            <div className="consistency-subsection-row">
              <div className="consistency-subsection consistency-subsection--half">
                <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
                  공통 항목 찾기
                  <span className="panel-criteria-heading-meta">(1항목)</span>
                </p>
                <div className="consistency-subsection__hints-area">
                  <p className="hint consistency-hint-block">
                    @을 포함한 항목을 모두 찾습니다
                    <br />
                    예:{' '}
                    <span className="consistency-hint-example">
                      &apos;@시대&apos;
                    </span>{' '}
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
                  ariaLabel="공통 항목 찾기(1개)"
                  inputClassName="field-input mono"
                />
                {phraseSlots.length > 0 ? (
                  <ul className="tail-list">
                    {phraseSlots.map((slot) => (
                      <RegisteredChip
                        key={slot}
                        label={slot}
                        onRemove={() =>
                          setPhraseSlots((prev) =>
                            prev.filter((s) => s !== slot),
                          )
                        }
                      />
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="consistency-subsection consistency-subsection--half consistency-subsection--exclude">
                <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
                  검수 제외 항목
                  <span className="panel-criteria-heading-meta">(1항목)</span>
                </p>
                <div className="consistency-subsection__hints-area">
                  <p className="hint consistency-hint-block">
                    입력한 항목은 찾지 않습니다
                    <br />
                    예:{' '}
                    <span className="consistency-hint-example">
                      &apos;소녀시대&apos;
                    </span>
                  </p>
                </div>
                <ConsistencyRegisterField
                  value={excludeInput}
                  onChange={setExcludeInput}
                  onRegister={registerExclude}
                  placeholder={SPACE_INPUT_PLACEHOLDER}
                  ariaLabel="검수 제외 항목"
                />
                <ExcludePhraseList
                  phrases={excludePhrases}
                  onRemove={(phrase) =>
                    setExcludePhrases((prev) =>
                      prev.filter((p) => p !== phrase),
                    )
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
