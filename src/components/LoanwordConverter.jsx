/**
 * 외래어 표기 변환 도구 (맞춤법 탭) — 3단 구조.
 *
 * 1단: 국립국어원 "용례 목록 - 외래어 표기법" 등재 표기 (공식 심의 결과)
 *      + 어문 규범 Open API(한글·오표기 검색, 키 있을 때)
 * 2단: 외래어 표기법(표 1 + 제3장 제1절) 규칙 엔진 변환 (근거 조항 표시)
 * 3단: 발음 사전에 없는 단어는 철자 기반 발음 추정(G2P)으로라도 결과 생성
 *      — "없는 표기를 만들어 보는 것"이 이 도구의 존재 이유이므로,
 *        어떤 입력에도 결과가 나오는 것을 보장한다 (추정임을 명시)
 *
 * 여러 단어(공백·하이픈)는 단어별로 변환해 이어 붙인다(제10항 2).
 * 한글 입력: 바른 표기·오표기 조회 (변환 엔진이 아님).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCmuDictionary } from '../lib/loanword/cmuDictionary.js';
import { isKornormsConfigured } from '../lib/loanword/kornormsApi.js';
import {
  normalizeLoanwordQuery,
  queryHasHangul,
  queryLooksLatin,
  queryNeedsSourceLookup,
  resolveHangulLoanwordQuery,
  resolveLatinLoanwordQuery,
  resolveSourceLangLoanwordQuery,
} from '../lib/loanword/loanwordQuery.js';
import { loadYongryeDictionary } from '../lib/loanword/yongryeDictionary.js';
import { preloadEspeak, espeakToIpa } from '../lib/loanword/espeakG2p.js';
import ConsistencyHintExample from './consistency/ConsistencyHintExample.jsx';

/** 용례집 미등재·규정 적용 결과 뱃지 — UI 통일 라벨 */
const EST_BADGE_LABEL = '추정 표기';
const PARTIAL_EST_BADGE_LABEL = '일부 추정 표기';

/**
 * 문자(모든 언어)·결합 기호·공백·하이픈·어깻점·이체자 선택자.
 * 한글 자모는 IME 조합용으로 포함.
 */
const INPUT_DISALLOWED =
  /[^\p{L}\p{M}\s'\-\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;
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
  noteAbove: {
    color: '#333',
    fontSize: 12,
    margin: '6px 0 8px',
    lineHeight: 1.55,
  },
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
      for (const typo of entry.o ?? []) if (!g.typos.includes(typo)) g.typos.push(typo);
      if (entry.src && !g.srcs.includes(entry.src)) g.srcs.push(entry.src);
    } else {
      grouped.push({
        h: entry.h,
        cats: entry.c ? [entry.c] : [],
        meanings: entry.m ? [entry.m] : [],
        alts: [...(entry.a ?? [])],
        typos: [...(entry.o ?? [])],
        srcs: entry.src ? [entry.src] : [],
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
      <span style={{ ...styles.estBadge, marginLeft: 6 }}>{EST_BADGE_LABEL}</span>
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
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const composingRef = useRef(false);

  // 발음 추정 엔진(eSpeak-NG)을 앱이 뜬 뒤 유휴 시간에 미리 받아 둔다
  useEffect(() => {
    preloadEspeak();
  }, []);

  const handleConvert = useCallback(async () => {
    const word = normalizeLoanwordQuery(input);
    if (!word || busyRef.current) return;
    if (!/\p{L}/u.test(word)) {
      setError('영어·한글·원어 표기를 입력해 주세요');
      setOutcome(null);
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setError('');
    try {
      const yongrye = await loadYongryeDictionary();
      if (queryHasHangul(word)) {
        const next = await resolveHangulLoanwordQuery(word, yongrye);
        setOutcome(next);
        if (!next.official.length && !next.engine?.found && !isKornormsConfigured()) {
          setError(
            '한글·오표기 검색은 어문 규범 API 키가 필요합니다 (.env.local의 VITE_KORNORMS_SERVICE_KEY)',
          );
        }
      } else if (queryNeedsSourceLookup(word)) {
        const next = await resolveSourceLangLoanwordQuery(word, yongrye);
        setOutcome(next);
        if (!next.official.length && !isKornormsConfigured()) {
          setError(
            '원어 검색은 어문 규범 API 키가 필요합니다 (.env.local의 VITE_KORNORMS_SERVICE_KEY)',
          );
        }
      } else if (queryLooksLatin(word)) {
        const cmu = await loadCmuDictionary();
        const next = await resolveLatinLoanwordQuery(
          word,
          yongrye,
          cmu,
          espeakToIpa,
        );
        setOutcome(next);
      } else {
        setError('영어·한글·원어 표기를 입력해 주세요');
        setOutcome(null);
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
  const isLookupMode =
    outcome?.mode === 'hangul' ||
    outcome?.mode === 'source' ||
    outcome?.mode === 'cjk';
  const typoHint =
    outcome?.mode === 'hangul' &&
    outcome.matchKind === 'typo' &&
    hasOfficial
      ? `‘${outcome.word}’은(는) 오표기입니다. 바른 표기는 ‘${groupedOfficial[0]?.h}’입니다.`
      : null;

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
          <span className="panel-criteria-heading-meta">
            (다국어 → 한국어, 영어↔한국어 표기 변환 지원)
          </span>
          <span className="loanword-converter__free-badge" aria-label="무제한">
            FREE
          </span>
        </span>
      </summary>

      <p className="hint consistency-hint-block" style={styles.noteAbove}>
        {'｢외래어 표기법｣ '}
        <span style={styles.badge}>용례집</span>
        {' 검색, 미등재시 영어 한정 '}
        <span style={styles.estBadge}>{EST_BADGE_LABEL}</span>
        {'를 제공합니다'}
        <br />
        <ConsistencyHintExample>
          &apos;孫正義&apos; 또는 &apos;そん まさよし&apos;(등재) 입력 →
          &apos;손 마사요시&apos; 표기
        </ConsistencyHintExample>
      </p>

      <div className="loanword-converter__field" style={styles.form}>
        <input
          type="text"
          className="loanword-converter__input"
          value={input}
          onChange={(e) => {
            const next = e.target.value;
            // 한글 조합 중에는 필터하지 않음 (스페이스·자모 유지)
            if (composingRef.current) {
              setInput(next);
              return;
            }
            setInput(next.replace(INPUT_DISALLOWED, ''));
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setInput(e.currentTarget.value.replace(INPUT_DISALLOWED, ''));
          }}
          onKeyDown={onKeyDown}
          placeholder="孫正義, そん まさよし"
          aria-label="외래어 표기로 변환·조회할 영어·한글·원어"
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
          {loading ? '조회 중…' : '변환'}
        </button>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {typoHint ? <p style={styles.meaning}>{typoHint}</p> : null}

      {hasOfficial ? (
        <>
          <p style={styles.sectionLabel}>
            {isLookupMode
              ? '국립국어원 용례·어문 규범 조회 결과'
              : '국립국어원 용례집 등재 표기 (공식 심의 결과)'}
          </p>
          {groupedOfficial.map((entry) => (
            <div key={entry.h} style={styles.hangulResult}>
              <span style={styles.hangul}>{entry.h}</span>
              <span style={{ ...styles.badge, marginLeft: 6 }}>용례집</span>
              {entry.cats.length ? (
                <span style={styles.meta}>{entry.cats.join(' · ')}</span>
              ) : null}
              {entry.srcs.length ? (
                <span style={styles.meta}>원어: {entry.srcs.join(', ')}</span>
              ) : null}
              {entry.alts.length ? (
                <span style={styles.meta}>이표기: {entry.alts.join(', ')}</span>
              ) : null}
              {entry.meanings.slice(0, 2).map((m) => (
                <p key={m} style={styles.meaning}>
                  {m}
                </p>
              ))}
              {entry.meanings.length > 2 ? (
                <p style={styles.meaning}>
                  외 같은 표기 {entry.meanings.length - 2}건
                </p>
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
                <span style={{ ...styles.estBadge, marginLeft: 6 }}>
                  {EST_BADGE_LABEL}
                </span>
              ) : (
                <span style={{ ...styles.partialEstBadge, marginLeft: 6 }}>
                  {PARTIAL_EST_BADGE_LABEL}
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
                <span style={{ ...styles.estBadge, marginLeft: 6 }}>
                  {EST_BADGE_LABEL}
                </span>
              ) : null}
              {w.officialForms.length > 1 ? (
                <span style={styles.meta}>
                  다른 표기: {w.officialForms.slice(1).join(', ')}
                </span>
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
        <p style={styles.error}>
          {isLookupMode
            ? `‘${outcome.word}’에 대한 용례를 찾지 못했습니다. 다른 원어·한글 표기로 다시 검색해 보세요.`
            : `‘${outcome.word}’을(를) 변환하지 못했습니다. 철자를 확인해 주세요.`}
        </p>
      ) : null}
    </details>
  );
}