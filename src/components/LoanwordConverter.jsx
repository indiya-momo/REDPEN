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
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCmuDictionary } from '../lib/loanword/cmuDictionary.js';
import { loadYongryeDictionary, lookupYongrye } from '../lib/loanword/yongryeDictionary.js';
import { convertWordAsync, convertPhraseAsync } from '../lib/loanword/convertLoanword.js';
import { preloadEspeak, espeakToIpa } from '../lib/loanword/espeakG2p.js';

const styles = {
  wrap: {
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: 8,
    padding: '8px 12px',
    margin: '6px 0 0',
    background: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
  },
  summary: {
    /* 제목 타이포는 .loanword-converter__summary (main-screen.css) */
    cursor: 'default',
    userSelect: 'none',
    listStyle: 'none',
  },
  form: { margin: '10px 0 6px' },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#666', margin: '10px 0 2px' },
  result: {
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 6,
    padding: '8px 10px',
    marginTop: 6,
    background: '#fff',
  },
  /** 변환 결과 한글 — 검색창 입력 글씨 시작(좌 패딩 10px)과 맞춤 */
  hangulResult: {
    marginTop: 6,
    padding: '2px 0 2px 10px',
  },
  hangul: { fontSize: 'calc(18px * 0.9)', fontWeight: 700 },
  badge: {
    display: 'inline-block',
    padding: '0 5px',
    borderRadius: 3,
    background: '#E8E6E1',
    color: '#555555',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.5,
    verticalAlign: 'baseline',
  },
  estBadge: {
    display: 'inline-block',
    padding: '0 5px',
    borderRadius: 3,
    border: '1px solid #555555',
    background: '#F3F1EC',
    color: '#555555',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.5,
    verticalAlign: 'baseline',
  },
  partialEstBadge: {
    display: 'inline-block',
    padding: '0 5px',
    borderRadius: 3,
    border: '1px solid #555555',
    background: '#F3F1EC',
    color: '#555555',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.5,
    verticalAlign: 'baseline',
  },
  meta: { color: '#666', marginLeft: 8, fontSize: 12 },
  meaning: { color: '#555', fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 },
  traceBlock: { marginTop: 6 },
  traceToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#555',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.4,
  },
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

function ApplicationTrace({ result, estimated }) {
  const [traceOpen, setTraceOpen] = useState(false);
  if (!result) return null;
  return (
    <div style={styles.traceBlock}>
      <button
        type="button"
        style={styles.traceToggle}
        aria-expanded={traceOpen}
        onClick={() => setTraceOpen((v) => !v)}
      >
        적용 근거 (외래어 표기법)
      </button>
      {traceOpen ? (
        <ul style={styles.traceList}>
          <li>용례집에 없어 외래어 표기법 규정으로 변환했습니다.</li>
          {estimated ? (
            <li>발음 사전에 없는 단어라 철자·음성 엔진에서 발음을 추정했습니다 (근사치).</li>
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
      ) : null}
    </div>
  );
}

function EngineResult({ result, label, estimated }) {
  return (
    <div style={styles.hangulResult}>
      <span style={styles.hangul}>{result.hangul}</span>
      <span style={{ ...styles.estBadge, marginLeft: 6 }}>발음 추정</span>
      <span style={styles.meta}>
        {label ? `${label} · ` : ''}[{result.ipa}]
      </span>
      <ApplicationTrace result={result} estimated={estimated} />
    </div>
  );
}

/**
 * @param {{ onConvertClick?: () => void, guideSpotlight?: boolean }} [props]
 */
export default function LoanwordConverter({
  onConvertClick,
  guideSpotlight = false,
} = {}) {
  const [input, setInput] = useState('Jo March');
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState(null); // { word, official, engine, phrase }
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  // 발음 추정 엔진(eSpeak-NG)을 앱이 뜬 뒤 유휴 시간에 미리 받아 둔다
  useEffect(() => {
    preloadEspeak();
  }, []);

  const handleConvert = useCallback(async () => {
    const word = input.trim();
    if (!word || busyRef.current) return;
    if (!/^[a-zA-Z ]+$/.test(word)) {
      setError('영어 철자, 공백만 입력 가능합니다');
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
      const isPhrase = /\s/.test(word);
      if (isPhrase) {
        // 단어별 캐스케이드: 용례집 → 발음 사전+규정 → 발음 추정(eSpeak → 철자)
        const engine = await convertPhraseAsync(word, cmu, yongrye, espeakToIpa);
        setOutcome({ word, official, engine, phrase: true });
      } else {
        const engine = await convertWordAsync(word, cmu, espeakToIpa);
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
    <details
      className={`loanword-converter${guideSpotlight ? ' work-guide-spotlight' : ''}`}
      style={styles.wrap}
      open
      onToggle={(e) => {
        e.currentTarget.open = true;
      }}
      data-work-guide="loanword-section"
    >
      <summary
        className="loanword-converter__summary panel-criteria-heading"
        style={styles.summary}
        onClick={(e) => e.preventDefault()}
      >
        <span className="loanword-converter__summary-title">
          외래어 표기
          <span className="panel-criteria-heading-meta">(영어 → 한국어 지원)</span>
          <span className="loanword-converter__free-badge" aria-label="무제한">
            FREE
          </span>
        </span>
      </summary>

      <div className="loanword-converter__field" style={styles.form}>
        <input
          type="text"
          className="loanword-converter__input"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z ]/g, ''))}
          onKeyDown={onKeyDown}
          placeholder="영어 단어·이름 입력 (예: Jo March)"
          aria-label="외래어 표기로 변환할 영어 단어"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="loanword-converter__submit"
          onClick={() => {
            onConvertClick?.();
            void handleConvert();
          }}
          disabled={loading}
          data-work-guide="loanword-convert"
        >
          {loading ? '변환 중…' : '변환'}
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      {hasOfficial ? (
        <>
          <p style={styles.sectionLabel}>국립국어원 용례집 등재 표기 (공식 심의 결과)</p>
          {groupedOfficial.map((entry) => (
            <div key={entry.h} style={styles.hangulResult}>
              <span style={styles.hangul}>{entry.h}</span>
              <span style={{ ...styles.badge, marginLeft: 6 }}>용례집</span>
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
          <div style={styles.hangulResult}>
            <span style={styles.hangul}>{outcome.engine.hangul}</span>
            {outcome.engine.words.some((w) => w.source !== 'yongrye') ? (
              outcome.engine.words.every((w) => w.source !== 'yongrye') ? (
                <span style={{ ...styles.estBadge, marginLeft: 6 }}>발음 추정</span>
              ) : (
                <span style={{ ...styles.partialEstBadge, marginLeft: 6 }}>
                  일부 발음 추정
                </span>
              )
            ) : null}
          </div>
          {outcome.engine.words.map((w) => (
            <div key={w.word} style={{ ...styles.result, marginLeft: 12 }}>
              <span style={{ fontWeight: 600 }}>{w.word}</span>
              <span style={styles.meta}>→ {w.hangul}</span>
              {w.source === 'yongrye' ? (
                <span style={{ ...styles.badge, marginLeft: 6 }}>용례집</span>
              ) : null}
              {w.source === 'dict' || w.source === 'g2p' ? (
                <span style={{ ...styles.estBadge, marginLeft: 6 }}>발음 추정</span>
              ) : null}
              {w.officialForms.length > 1 ? (
                <span style={styles.meta}>다른 표기: {w.officialForms.slice(1).join(', ')}</span>
              ) : null}
              {w.source === 'dict' || w.source === 'g2p' ? (
                <ApplicationTrace
                  result={w.engine?.results?.[0]}
                  estimated={Boolean(w.engine?.estimated) || w.source === 'g2p'}
                />
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      {outcome && !hasOfficial && !hasEngine ? (
        <p style={styles.error}>‘{outcome.word}’을(를) 변환하지 못했습니다. 철자를 확인해 주세요.</p>
      ) : null}

      <p style={styles.note}>
        {'외국어 원문을 입력하면 한국어로 변환합니다. 외래어 표기법'}
        <span style={{ ...styles.badge, marginLeft: '0.25em' }}>용례집</span>
        {'을 우선하며, 등재되지 않은 경우 규정을 적용해'}
        <span style={{ ...styles.estBadge, marginLeft: '0.25em' }}>발음 추정</span>
        {'합니다'}
      </p>
    </details>
  );
}
