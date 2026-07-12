/**
 * 외래어 표기 변환 도구 (맞춤법 탭) — 2단 구조.
 *
 * 1단: 국립국어원 "용례 목록 - 외래어 표기법" 등재 여부 조회 (공식 심의 표기)
 * 2단: 등재 여부와 무관하게, 외래어 표기법(표 1 + 제3장 제1절) 규칙 엔진으로
 *      생성한 "규정 적용 결과"를 참고로 함께 표시
 *
 * - 발음 출처: CMU 발음 사전 (오프라인 내장, 첫 사용 시 지연 로드)
 * - 복수 발음·복수 용례가 있으면 모두 보여준다.
 * - 규칙 엔진 결과에는 적용 조항(근거)을 함께 표시한다.
 * - 여러 단어(공백 포함) 입력은 용례집 조회만 지원한다.
 */
import { useCallback, useRef, useState } from 'react';
import { loadCmuDictionary } from '../lib/loanword/cmuDictionary.js';
import { loadYongryeDictionary, lookupYongrye } from '../lib/loanword/yongryeDictionary.js';
import { convertWord } from '../lib/loanword/convertLoanword.js';

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
  meta: { color: '#666', marginLeft: 8, fontSize: 12 },
  meaning: { color: '#555', fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 },
  traceList: { margin: '6px 0 0', paddingLeft: 18, color: '#444', fontSize: 12 },
  note: { color: '#888', fontSize: 11, marginTop: 8, lineHeight: 1.5 },
  error: { color: '#b91c1c', marginTop: 6, fontSize: 12 },
};

export default function LoanwordConverter() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState(null); // { word, official, engine }
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
      const singleWord = !word.includes(' ');
      const engine = singleWord ? convertWord(word, cmu) : null;
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

  /** 같은 표기는 한 카드로 묶는다 (동명이인 존스 6건 → 존스 1장 + 의미 목록) */
  const groupedOfficial = [];
  if (hasOfficial) {
    for (const entry of outcome.official) {
      const g = groupedOfficial.find((x) => x.h === entry.h);
      if (g) {
        if (entry.c && !g.cats.includes(entry.c)) g.cats.push(entry.c);
        if (entry.m) g.meanings.push(entry.m);
        for (const alt of entry.a ?? []) if (!g.alts.includes(alt)) g.alts.push(alt);
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
    <details style={styles.wrap}>
      <summary style={styles.summary}>외래어 표기 변환 (영어)</summary>

      <div style={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="영어 단어 입력 (예: williams, new orleans)"
          aria-label="외래어 표기로 변환할 영어 단어"
          style={styles.input}
        />
        <button type="button" onClick={handleConvert} disabled={loading} style={styles.button}>
          {loading ? '변환 중…' : '변환'}
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {outcome && !hasOfficial && !hasEngine ? (
        <p style={styles.error}>
          ‘{outcome.word}’은(는) 용례집과 발음 사전 어디에도 없습니다. 철자를 확인해 주세요.
          {outcome.word.includes(' ') ? ' (여러 단어는 용례집 조회만 지원합니다.)' : ''}
        </p>
      ) : null}

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

      {hasEngine ? (
        <>
          <p style={styles.sectionLabel}>
            {hasOfficial ? '외래어 표기법 규정 적용 결과 (참고)' : '외래어 표기법 규정 적용 결과'}
          </p>
          {outcome.engine.results.map((r, idx) => (
            <div key={r.arpabet} style={styles.result}>
              <span style={styles.hangul}>{r.hangul}</span>
              <span style={styles.meta}>
                {outcome.engine.results.length > 1 ? `발음 ${idx + 1} · ` : ''}[{r.ipa}]
              </span>
              <details>
                <summary style={{ ...styles.summary, fontWeight: 400, fontSize: 12, color: '#555' }}>
                  적용 근거 (외래어 표기법)
                </summary>
                <ul style={styles.traceList}>
                  {r.trace
                    .filter((e) => e.rule)
                    .map((e, i) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <li key={i}>
                        {e.ph} → {e.out || '(음절 결합)'} — <strong>{e.rule.id}</strong>{' '}
                        {e.rule.text}
                      </li>
                    ))}
                  {r.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </>
      ) : null}

      <p style={styles.note}>
        1단: 국립국어원 용례집(외래어 표기법 용례 목록, 영어 {'—'} 인명·지명·일반 용어) 등재
        표기를 먼저 보여줍니다. 2단: 규칙 엔진이 외래어 표기법(제3장 제1절 영어의 표기)을 예외 없이
        적용한 결과를 참고로 표시합니다. 발음은 CMU 발음 사전(미국식) 기준이며 철자 참고 조정을
        거칩니다. 두 결과가 다르면 용례집(공식 심의)이 우선이고, 최종 선택은 편집자의 판단에
        맡깁니다.
      </p>
    </details>
  );
}
