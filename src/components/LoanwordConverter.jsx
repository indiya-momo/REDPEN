/**
 * 외래어 표기 변환 도구 (맞춤법 탭) — 3단 구조.
 *
 * 1단: 국립국어원 "용례 목록 - 외래어 표기법" 등재 표기 (공식 심의 결과)
 * 2단: 외래어 표기법(표 1 + 제3장 제1절) 규칙 엔진 변환 (근거 조항 표시)
 * 3단: 발음 사전에 없는 단어는 철자 기반 발음 추정(G2P)으로라도 결과 생성
 *      — "없는 표기를 만들어 보는 것"이 이 도구의 존재 이유이므로,
 *        어떤 입력에도 결과가 나오는 것을 보장한다 (추정임을 명시)
 *
 * 여러 단어(공백·하이픈)는 단어별로 변환해 이어 붙인다(제10항 2).
 */
import { useCallback, useRef, useState } from 'react';
import { loadCmuDictionary } from '../lib/loanword/cmuDictionary.js';
import { loadYongryeDictionary, lookupYongrye } from '../lib/loanword/yongryeDictionary.js';
import { convertWord, convertPhrase } from '../lib/loanword/convertLoanword.js';

const styles = {
  wrap: {
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: 8,
    padding: '8px 12px',
    margin: '6px 0',
    background: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  summary: { cursor: 'pointer', fontWeight: 600, userSelect: 'none' },
  form: { display: 'flex', gap: 6, margin: '10px 0 6px' },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    border: '1px solid rgba(0, 0, 0, 0.2)',
    borderRadius: 6,
    fontSize: 13,
  },
  button: {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 6,
    background: '#4a5568',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    whiteSpace: 'nowrap',
  },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#666', margin: '10px 0 2px' },
  result: {
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 6,
    padding: '8px 10px',
    marginTop: 6,
    background: '#fff',
  },
  officialResult: {
    border: '1px solid rgba(37, 99, 235, 0.35)',
    borderRadius: 6,
    padding: '8px 10px',
    marginTop: 6,
    background: '#f5f9ff',
  },
  hangul: { fontSize: 18, fontWeight: 700 },
  badge: {
    display: 'inline-block',
    marginLeft: 8,
    padding: '1px 6px',
    borderRadius: 4,
    background: '#2563eb',
    color: '#fff',
    fontSize: 10,
    verticalAlign: 'middle',
  },
  estBadge: {
    display: 'inline-block',
    marginLeft: 8,
    padding: '1px 6px',
    borderRadius: 4,
    background: '#d97706',
    color: '#fff',
    fontSize: 10,
    verticalAlign: 'middle',
  },
  ruleBadge: {
    display: 'inline-block',
    marginLeft: 8,
    padding: '1px 6px',
    borderRadius: 4,
    background: '#6b7280',
    color: '#fff',
    fontSize: 10,
    verticalAlign: 'middle',
  },
  meta: { color: '#666', marginLeft: 8, fontSize: 12 },
  meaning: { color: '#555', fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 },
  traceList: { margin: '6px 0 0', paddingLeft: 18, color: '#444', fontSize: 12 },
  note: { color: '#888', fontSize: 11, marginTop: 8, lineHeight: 1.5 },
  error: { color: '#b91c1c', marginTop: 6, fontSize: 12 },
};

/** 같은 표기를 한 카드로 묶는다 (동명이인 존스 6건 → 존스 1장 + 의미 목록) */
function groupOfficial(entries) {
  const grouped = [];
  for (const entry of entries) {
    const g = grouped.find((x) => x.h === entry.h);
    if (g) {
      if (entry.c && !g.cats.includes(entry.c)) g.cats.push(entry.c);
      if (entry.m) g.meanings.push(entry.m);
      for (const alt of entry.a ?? []) if (!g.alts.includes(alt)) g.alts.push(alt);
    } else {
      grouped.push({
        h: entry.h,
        cats: entry.c ? [entry.c] : [],
        meanings: entry.m ? [entry.m] : [],
        alts: [...(entry.a ?? [])],
      });
    }
  }
  return grouped;
}

function EngineResult({ result, label, estimated }) {
  return (
    <div style={styles.result}>
      <span style={styles.hangul}>{result.hangul}</span>
      {estimated ? <span style={styles.estBadge}>발음 추정</span> : null}
      <span style={styles.meta}>
        {label ? `${label} · ` : ''}[{result.ipa}]
      </span>
      <details>
        <summary style={{ ...styles.summary, fontWeight: 400, fontSize: 12, color: '#555' }}>
          적용 근거 (외래어 표기법)
        </summary>
        <ul style={styles.traceList}>
          {estimated ? (
            <li>발음 사전에 없는 단어라 철자에서 발음을 추정했습니다 (근사치).</li>
          ) : null}
          {result.trace
            .filter((e) => e.rule)
            .map((e, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={i}>
                {e.ph} → {e.out || '(음절 결합)'} — <strong>{e.rule.id}</strong> {e.rule.text}
              </li>
            ))}
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function LoanwordConverter() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState(null); // { word, official, engine, phrase }
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
      const isPhrase = /[\s-]/.test(word);
      if (isPhrase) {
        // 단어별 캐스케이드: 용례집 → 발음 사전+규정 → 철자 추정
        const engine = convertPhrase(word, cmu, yongrye);
        setOutcome({ word, official, engine, phrase: true });
      } else {
        const engine = convertWord(word, cmu);
        setOutcome({ word, official, engine, phrase: false });
      }
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
  const groupedOfficial = hasOfficial ? groupOfficial(outcome.official) : [];

  return (
    <details style={styles.wrap}>
      <summary style={styles.summary}>외래어 표기 변환 (영어)</summary>

      <div style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="영어 단어·이름 입력 (예: williams, stephen king)"
          aria-label="외래어 표기로 변환할 영어 단어"
          style={styles.input}
        />
        <button type="button" onClick={handleConvert} disabled={loading} style={styles.button}>
          {loading ? '변환 중…' : '변환'}
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {hasOfficial ? (
        <>
          <p style={styles.sectionLabel}>국립국어원 용례집 등재 표기 (공식 심의 결과)</p>
          {groupedOfficial.map((entry) => (
            <div key={entry.h} style={styles.officialResult}>
              <span style={styles.hangul}>{entry.h}</span>
              <span style={styles.badge}>용례집</span>
              {entry.cats.length ? <span style={styles.meta}>{entry.cats.join(' · ')}</span> : null}
              {entry.alts.length ? (
                <span style={styles.meta}>이표기: {entry.alts.join(', ')}</span>
              ) : null}
              {entry.meanings.slice(0, 2).map((m) => (
                <p key={m} style={styles.meaning}>
                  {m}
                </p>
              ))}
              {entry.meanings.length > 2 ? (
                <p style={styles.meaning}>외 같은 표기 {entry.meanings.length - 2}건</p>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {hasEngine && !outcome.phrase && !hasOfficial ? (
        <>
          <p style={styles.sectionLabel}>외래어 표기법 규정 적용 결과</p>
          {outcome.engine.results.map((r, idx) => (
            <EngineResult
              key={r.arpabet}
              result={r}
              estimated={outcome.engine.estimated}
              label={outcome.engine.results.length > 1 ? `발음 ${idx + 1}` : ''}
            />
          ))}
        </>
      ) : null}

      {hasEngine && outcome.phrase && !hasOfficial ? (
        <>
          <p style={styles.sectionLabel}>
            권장 표기 — 단어별 우선순위: 용례집 → 규정 → 철자 추정 (제10항 2: 띄어 쓴 대로)
          </p>
          <div style={styles.officialResult}>
            <span style={styles.hangul}>{outcome.engine.hangul}</span>
            {outcome.engine.estimated ? <span style={styles.estBadge}>일부 발음 추정</span> : null}
          </div>
          {outcome.engine.words.map((w) => (
            <div key={w.word} style={{ ...styles.result, marginLeft: 12 }}>
              <span style={{ fontWeight: 600 }}>{w.word}</span>
              <span style={styles.meta}>→ {w.hangul}</span>
              {w.source === 'yongrye' ? <span style={styles.badge}>용례집</span> : null}
              {w.source === 'dict' ? <span style={styles.ruleBadge}>규정</span> : null}
              {w.source === 'g2p' ? <span style={styles.estBadge}>발음 추정</span> : null}
              {w.officialForms.length > 1 ? (
                <span style={styles.meta}>다른 표기: {w.officialForms.slice(1).join(', ')}</span>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {outcome && !hasOfficial && !hasEngine ? (
        <p style={styles.error}>‘{outcome.word}’을(를) 변환하지 못했습니다. 철자를 확인해 주세요.</p>
      ) : null}

      <p style={styles.note}>
        국립국어원 용례집(외래어 표기법 용례 목록)에 등재된 단어는 공식 심의 표기만
        보여줍니다. 등재되지 않은 단어만 외래어 표기법(제3장 제1절 영어) 규정을 적용해
        변환하며, 발음 사전에도 없으면 철자에서 발음을 추정하고 <b>발음 추정</b> 표시가
        붙습니다. 최종 선택은 편집자의 판단에 맡깁니다.
      </p>
    </details>
  );
}
