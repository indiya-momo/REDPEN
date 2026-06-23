import { useCallback, useState } from 'react';
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
 * DEV: ?window=consistency-mock — 일관성 찾기 + 통일형 만들기 UI 목업
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
      {
        id: `m-${Date.now()}`,
        unified,
        correction,
      },
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
    <div className="consistency-proto">
      <div className="consistency-proto__dev-banner" role="status">
        DEV 목업 · <code>?window=consistency-mock</code> · 규칙 저장·검수 없음
        {' · '}
        <a href="/?devPdf=1">실제 작업대</a>
      </div>

      <div className="consistency-proto__stage">
        <aside className="consistency-proto__panel" aria-label="일관성 패널 목업">
          <section className="consistency-proto__box">
            <h1 className="consistency-proto__title">
              일관성 찾기(1회 검수 8개 이내 추천)⭐
            </h1>
            <p className="consistency-proto__hint">
              한글 · 영문 대소문자 등을 찾습니다. 여러 항목은 사이에 , 를 넣어 한
              번에 입력하세요. 검수 후 결과에서 📌 고정하면 아래 통일형에
              채워집니다.
            </p>

            <div className="consistency-proto__field-row">
              <input
                type="text"
                className="consistency-proto__input"
                value={literalInput}
                onChange={(e) => setLiteralInput(e.target.value)}
                placeholder="붉은˅표시, 붉은표시, 빨간표시"
                aria-label="일관성 찾기"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') registerLiteral();
                }}
              />
              <button
                type="button"
                className="consistency-proto__btn consistency-proto__btn--register"
                onClick={registerLiteral}
              >
                등록
              </button>
            </div>

            <ul className="consistency-proto__tags" aria-label="등록된 찾기 항목">
              {findTerms.map((term) => (
                <li key={term.id}>
                  <span
                    className={`consistency-proto__tag${term.pinned ? ' consistency-proto__tag--pinned' : ''}`}
                  >
                    <button
                      type="button"
                      className="consistency-proto__tag-pin"
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
                    <span className="consistency-proto__tag-label">{term.label}</span>
                    <button
                      type="button"
                      className="consistency-proto__tag-remove"
                      aria-label={`${term.label} 삭제`}
                      onClick={() => removeFindTerm(term.id)}
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <hr className="consistency-proto__divider" />

          <section className="consistency-proto__box">
            <h2 className="consistency-proto__subtitle">통일형 만들기</h2>
            <p className="consistency-proto__hint">
              찾은 표기를 통일합니다. <strong>수정형</strong>은 원고에서 찾을
              표기, <strong>통일형</strong>은 PDF 위에 보여 줄 안내 문구입니다
              (자동 치환 아님).
            </p>

            <div className="consistency-proto__unify-grid">
              <label className="consistency-proto__label">
                <span className="consistency-proto__label-text">통일형</span>
                <input
                  type="text"
                  className="consistency-proto__input"
                  value={unifiedDraft}
                  onChange={(e) => setUnifiedDraft(e.target.value)}
                  placeholder="결과에서 고정하거나 직접 입력"
                />
              </label>
              <label className="consistency-proto__label">
                <span className="consistency-proto__label-text">수정형</span>
                <input
                  type="text"
                  className="consistency-proto__input"
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
              </label>
              <button
                type="button"
                className="consistency-proto__btn consistency-proto__btn--add"
                onClick={addMapping}
              >
                추가
              </button>
            </div>

            <p className="consistency-proto__note">
              통일형을 정하면, 수정형은 검수 시 원고 위에 통일형으로 안내됩니다.
            </p>

            {mappings.length > 0 ? (
              <ul className="consistency-proto__mapping-list" aria-label="통일 매핑">
                {mappings.map((row) => (
                  <li key={row.id} className="consistency-proto__mapping">
                    <span className="consistency-proto__mapping-correction">
                      {row.correction}
                    </span>
                    <span className="consistency-proto__mapping-arrow" aria-hidden>
                      →
                    </span>
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
          </section>

          <hr className="consistency-proto__divider" />

          <div className="consistency-proto__bottom-row">
            <section className="consistency-proto__box consistency-proto__box--half">
              <h2 className="consistency-proto__subtitle">공통 문자열 찾기(1개)</h2>
              <p className="consistency-proto__hint consistency-proto__hint--compact">
                @을 포함한 항목을 모두 찾습니다
                <br />
                예: <em>@시대</em>
              </p>
              <div className="consistency-proto__field-row">
                <input
                  type="text"
                  className="consistency-proto__input consistency-proto__input--mono"
                  value={slotInput}
                  onChange={(e) => setSlotInput(e.target.value)}
                  placeholder="@시대"
                  aria-label="공통 문자열 찾기"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') registerSlot();
                  }}
                />
                <button
                  type="button"
                  className="consistency-proto__btn consistency-proto__btn--register"
                  onClick={registerSlot}
                >
                  등록
                </button>
              </div>
              <ul className="consistency-proto__simple-list">
                {phraseSlots.map((slot) => (
                  <li key={slot}>{slot}</li>
                ))}
              </ul>
            </section>

            <section className="consistency-proto__box consistency-proto__box--half">
              <h2 className="consistency-proto__subtitle">검수 제외 단어</h2>
              <p className="consistency-proto__hint consistency-proto__hint--compact">
                등록한 단어는 찾지 않습니다
                <br />
                예: <em>소녀시대</em>
              </p>
              <div className="consistency-proto__field-row">
                <input
                  type="text"
                  className="consistency-proto__input"
                  value={excludeInput}
                  onChange={(e) => setExcludeInput(e.target.value)}
                  placeholder="소녀시대"
                  aria-label="검수 제외 단어"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') registerExclude();
                  }}
                />
                <button
                  type="button"
                  className="consistency-proto__btn consistency-proto__btn--register"
                  onClick={registerExclude}
                >
                  등록
                </button>
              </div>
              <ul className="consistency-proto__simple-list">
                {excludePhrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            </section>
          </div>
        </aside>

        <div className="consistency-proto__preview-note" aria-hidden>
          <p>좌측 패널 너비·흐름 검증용 목업</p>
          <p className="consistency-proto__preview-chip">
            카드 칩:{' '}
            <span>붉은표시 · 빨간표시 → 붉은 표시</span>
          </p>
        </div>
      </div>
    </div>
  );
}
