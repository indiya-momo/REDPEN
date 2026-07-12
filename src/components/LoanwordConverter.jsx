/**
 * 외래어 표기 변환 도구 (맞춤법 탭) — 2단 구조.
 *
 * 1단: 국립국어원 용례집 등재 표기
 * 2단: 외래어 표기법 규정 적용 결과(참고) — 여러 단어는 단어별 변환 후 이어 붙임
 */
import { useCallback, useRef, useState } from 'react';
import { loadCmuDictionary } from '../lib/loanword/cmuDictionary.js';
import { loadYongryeDictionary, lookupYongrye } from '../lib/loanword/yongryeDictionary.js';
import { convertWord } from '../lib/loanword/convertLoanword.js';
import ConsistencyHintExample from './consistency/ConsistencyHintExample.jsx';

/**
 * @param {string} phrase
 * @param {Record<string, string>} cmu
 * @param {Record<string, Array>} yongrye
 */
function buildEngineOutcome(phrase, cmu, yongrye) {
  const parts = phrase.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { kind: 'single', found: false, results: [], parts: [] };
  }
  if (parts.length === 1) {
    const single = convertWord(parts[0], cmu);
    return {
      kind: 'single',
      found: single.found,
      results: single.results,
      parts: [],
      note: '',
    };
  }

  const broken = parts.map((w) => {
    const engine = convertWord(w, cmu);
    const official = lookupYongrye(w, yongrye);
    const hangul = engine.found
      ? engine.results[0].hangul
      : official[0]?.h || '';
    return {
      word: w,
      hangul,
      engine,
      official,
    };
  });

  const found = broken.some((p) => p.hangul);
  return {
    kind: 'phrase',
    found,
    hangul: broken.map((p) => p.hangul || p.word).join(' '),
    note: '단어별로 변환해 이어 붙임 (제10항 2)',
    results: [],
    parts: broken,
  };
}

export default function LoanwordConverter() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  const handleConvert = useCallback(async () => {
    const word = input.trim();
    if (!word || busyRef.current) return;
    if (!/^[a-zA-Z''\- ]+$/.test(word)) {
      setError('영어 철자만 입력해 주세요. (알파벳, 하이픈, 어깻점, 공백)');
      setOutcome(null);
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setError('');
    try {
      const [yongrye, cmu] = await Promise.all([
        loadYongryeDictionary(),
        loadCmuDictionary(),
      ]);
      const official = lookupYongrye(word, yongrye);
      const engine = buildEngineOutcome(word, cmu, yongrye);
      setOutcome({ word, official, engine });
    } catch {
      setError('사전을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      setOutcome(null);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [input]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConvert();
      }
    },
    [handleConvert],
  );

  const hasOfficial = Boolean(outcome?.official?.length);
  const hasEngine = Boolean(outcome?.engine?.found);

  /** 같은 표기는 한 카드로 묶고 구분·의미를 모은다 */
  const groupedOfficial = [];
  if (hasOfficial) {
    for (const entry of outcome.official) {
      const g = groupedOfficial.find((x) => x.h === entry.h);
      if (g) {
        if (entry.c && !g.cats.includes(entry.c)) g.cats.push(entry.c);
        if (entry.m) g.meanings.push(entry.m);
        for (const alt of entry.a ?? []) {
          if (!g.alts.includes(alt)) g.alts.push(alt);
        }
      } else {
        groupedOfficial.push({
          h: entry.h,
          cats: entry.c ? [entry.c] : [],
          meanings: entry.m ? [entry.m] : [],
          alts: [...(entry.a ?? [])],
        });
      }
    }
  }

  return (
    <section
      className="printed-page-setup loanword-converter"
      aria-label="외래어 표기 변환"
    >
      <p className="printed-page-setup__title panel-criteria-heading">
        외래어 표기 변환
        <span className="panel-criteria-heading-meta">(영어 → 한글 참고)</span>
      </p>
      <p className="hint consistency-hint-block">
        국립국어원 용례집을 먼저 찾고, 없으면 규정 적용 결과를 보여 줍니다
        <br />
        <ConsistencyHintExample>
          Stephen King → 스티븐 킹 Maximilian → 맥시밀리언
        </ConsistencyHintExample>
      </p>

      <div className="loanword-converter__form">
        <input
          type="text"
          className="loanword-converter__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="영어 단어 (예: Stephen King)"
          aria-label="외래어 표기로 변환할 영어 단어"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="loanword-converter__submit"
          onClick={handleConvert}
          disabled={loading}
        >
          {loading ? '변환 중…' : '변환'}
        </button>
      </div>

      {error ? <p className="loanword-converter__error">{error}</p> : null}

      {outcome && !hasOfficial && !hasEngine ? (
        <p className="loanword-converter__error">
          ‘{outcome.word}’은(는) 용례집과 발음 사전 어디에도 없습니다. 철자를 확인해 주세요.
        </p>
      ) : null}

      {hasOfficial ? (
        <div className="loanword-converter__block">
          <p className="loanword-converter__label">
            국립국어원 용례집 등재 표기 (공식 심의 결과)
          </p>
          {groupedOfficial.map((entry) => (
            <div key={entry.h} className="loanword-converter__card loanword-converter__card--official">
              <div className="loanword-converter__card-head">
                <strong className="loanword-converter__hangul">{entry.h}</strong>
                <span className="loanword-converter__badge">용례집</span>
                {entry.cats.length ? (
                  <span className="loanword-converter__meta">
                    {entry.cats.join(' · ')}
                  </span>
                ) : null}
                {entry.alts.length ? (
                  <span className="loanword-converter__meta">
                    이표기: {entry.alts.join(', ')}
                  </span>
                ) : null}
              </div>
              {entry.meanings.slice(0, 3).map((m) => (
                <p key={m} className="loanword-converter__meaning">
                  {m}
                </p>
              ))}
              {entry.meanings.length > 3 ? (
                <p className="loanword-converter__meaning">
                  외 같은 표기 {entry.meanings.length - 3}건
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {hasEngine ? (
        <div className="loanword-converter__block">
          <p className="loanword-converter__label">
            {hasOfficial
              ? '외래어 표기법 규정 적용 결과 (참고)'
              : '외래어 표기법 규정 적용 결과'}
          </p>

          {outcome.engine.kind === 'phrase' ? (
            <div className="loanword-converter__card">
              <div className="loanword-converter__card-head">
                <strong className="loanword-converter__hangul">
                  {outcome.engine.hangul}
                </strong>
                {outcome.engine.note ? (
                  <span className="loanword-converter__meta">
                    {outcome.engine.note}
                  </span>
                ) : null}
              </div>
              <div className="loanword-converter__parts">
                {outcome.engine.parts.map((p) => (
                  <div key={p.word} className="loanword-converter__part">
                    <span>
                      {p.word} → {p.hangul || '(없음)'}
                    </span>
                    {p.official[0]?.h ? (
                      <span className="loanword-converter__meta">
                        용례집: {p.official[0].h}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            outcome.engine.results.map((r, idx) => (
              <div key={r.arpabet} className="loanword-converter__card">
                <div className="loanword-converter__card-head">
                  <strong className="loanword-converter__hangul">{r.hangul}</strong>
                  <span className="loanword-converter__meta">
                    {outcome.engine.results.length > 1 ? `발음 ${idx + 1} · ` : ''}
                    {r.ipa ? `[${r.ipa}]` : ''}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
