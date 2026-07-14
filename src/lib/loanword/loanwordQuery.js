/**
 * 외래어 표기 질의 — 영어 변환 + 한글/오표기 조회 + 원어(한자·가나·키릴 등) 조회.
 */
import { convertPhraseAsync, convertWordAsync } from './convertLoanword.js';
import { isKornormsConfigured, searchKornormsExamples } from './kornormsApi.js';
import { lookupYongrye } from './yongryeDictionary.js';

const HANGUL_RE = /[\uAC00-\uD7A3]/;
/** 이체자 선택자 등 — 검색 전 제거 (伊藤󠄁博󠄁文 → 伊藤博文) */
const VARIATION_SELECTOR_RE = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu;

/**
 * 입력 정규화 — 공백 정리·변형 선택자 제거.
 * @param {string} s
 */
export function normalizeLoanwordQuery(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(VARIATION_SELECTOR_RE, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** @param {string} q */
export function queryHasHangul(q) {
  return HANGUL_RE.test(String(q ?? ''));
}

/**
 * 순수 라틴(영문) 질의 — 표기 추정 엔진 경로.
 * @param {string} q
 */
export function queryLooksLatin(q) {
  const n = normalizeLoanwordQuery(q);
  if (!n || queryHasHangul(n)) return false;
  return /^[A-Za-z\s'\-]+$/.test(n) && /[A-Za-z]/.test(n);
}

/**
 * 한자·가나·키릴·아랍 등 비라틴 원어 → 어문회 원어 검색.
 * @param {string} q
 */
export function queryNeedsSourceLookup(q) {
  const n = normalizeLoanwordQuery(q);
  if (!n || queryHasHangul(n) || queryLooksLatin(n)) return false;
  return /\p{L}/u.test(n);
}

/** @deprecated queryNeedsSourceLookup 사용 */
export function queryHasCjk(q) {
  return queryNeedsSourceLookup(q);
}

/**
 * 원어 표기에서 읽기(…) 제거 — "伊藤博文(いとう ひろぶみ)" → "伊藤博文"
 * @param {string} src
 */
export function stripSrcReading(src) {
  return String(src ?? '')
    .replace(/[（(][^)）]*[)）]/g, '')
    .trim();
}

/**
 * 원어 표기의 읽기(괄호 안) 목록 — "孫正義(そん まさよし)" → ["そん まさよし"]
 * @param {string} src
 * @returns {string[]}
 */
export function extractSrcReadings(src) {
  const text = String(src ?? '');
  return [...text.matchAll(/[（(]([^)）]+)[)）]/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
}

/**
 * 원어 질의 매칭 — 국어원 사이트 ‘포함’과 같이.
 * 한자·원문·괄호 안 가나에 질의가 들어가면 통과.
 * @param {string} src
 * @param {string} query
 */
export function srcMatchesSourceQuery(src, query) {
  const qKey = sourceKey(query);
  if (!qKey) return false;
  const raw = String(src ?? '').trim();
  if (!raw) return false;
  const candidates = [
    raw,
    stripSrcReading(raw),
    ...extractSrcReadings(raw),
  ];
  return candidates.some((part) => sourceKey(part).includes(qKey));
}

/**
 * @param {string} s
 */
function hangulKey(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/**
 * @param {string} s
 */
function sourceKey(s) {
  return normalizeLoanwordQuery(s).replace(/\s+/g, '');
}

/**
 * @param {string} query
 * @param {Array<{ h: string, src?: string, a?: string[], o?: string[] }>} items
 * @returns {'exact' | 'alt' | 'typo' | 'other'}
 */
export function classifyHangulMatch(query, items) {
  const q = String(query).trim().replace(/\s+/g, ' ');
  const qKey = hangulKey(q);
  for (const item of items) {
    if (item.h === q || hangulKey(item.h) === qKey) return 'exact';
  }
  for (const item of items) {
    if ((item.a ?? []).some((a) => a === q || hangulKey(a) === qKey)) {
      return 'alt';
    }
  }
  for (const item of items) {
    if ((item.o ?? []).some((o) => o === q || hangulKey(o) === qKey)) {
      return 'typo';
    }
  }
  return 'other';
}

/**
 * 로컬 용례 — 한글 표기·이표기로 역검색 (공백 무시).
 * @param {string} hangul
 * @param {Record<string, Array>} yongrye
 */
export function lookupYongryeByHangul(hangul, yongrye) {
  const qKey = hangulKey(hangul);
  if (!qKey || !yongrye) return [];
  /** @type {Array<{ h: string, c?: string, m?: string, a?: string[], src?: string }>} */
  const hits = [];
  for (const [src, entries] of Object.entries(yongrye)) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const forms = [e.h, ...(e.a ?? [])].filter(Boolean);
      if (!forms.some((f) => hangulKey(f) === qKey)) continue;
      hits.push({
        h: e.h,
        c: e.c,
        m: e.m,
        a: e.a,
        src,
      });
    }
  }
  return hits;
}

/**
 * 한글 질의 변형 (원문 + 공백 제거).
 * @param {string} hangul
 * @returns {string[]}
 */
export function hangulQueryVariants(hangul) {
  const q = String(hangul).trim().replace(/\s+/g, ' ');
  const compact = hangulKey(q);
  /** @type {string[]} */
  const out = [];
  for (const v of [q, compact]) {
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * 토큰에 대한 후보 점수 (높을수록 좋음).
 * @param {string} token
 * @param {{ h: string, a?: string[], o?: string[] }} item
 * @param {{ allowTypo?: boolean }} [opts] 구문 조합 시 false — 오표기(킹→칭)로 단어를 바꾸지 않음
 */
export function scoreHangulTokenMatch(token, item, opts = {}) {
  const allowTypo = opts.allowTypo !== false;
  const t = hangulKey(token);
  if (!t || !item?.h) return 0;
  if (hangulKey(item.h) === t) return 100;
  if (allowTypo && (item.o ?? []).some((o) => hangulKey(o) === t)) return 90;
  if ((item.a ?? []).some((a) => hangulKey(a) === t)) return 80;
  const parts = String(item.h)
    .split(/[\s,·∙･]+/)
    .map(hangulKey)
    .filter(Boolean);
  if (parts.includes(t)) return 50;
  if (hangulKey(item.h).includes(t)) return 10;
  return 0;
}

/**
 * @param {string} token
 * @param {Array<{ h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} items
 * @param {{ minScore?: number, allowTypo?: boolean }} [opts]
 */
export function pickBestHangulTokenItem(token, items, opts = {}) {
  const minScore = opts.minScore ?? 80;
  const allowTypo = opts.allowTypo !== false;
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreHangulTokenMatch(token, item, { allowTypo });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best || bestScore < minScore) return null;
  // "성, 이름" 일부만 빌릴 때 — 다른 인명 메타데이터를 붙이지 않음
  if (bestScore === 50 || bestScore === 10) {
    return { h: String(token).trim() };
  }
  return best;
}

/**
 * @param {string} keyword
 * @param {AbortSignal} [signal]
 * @param {{ forCompose?: boolean }} [opts]
 *   forCompose: 오표기 검색 생략 + 한글 완전일치 우선 (스티븐 킹 조합용)
 */
async function searchHangulKeywordViaApi(keyword, signal, opts = {}) {
  const forCompose = Boolean(opts.forCompose);
  /** @type {ReturnType<typeof searchKornormsExamples>[]} */
  const jobs = [];
  if (!forCompose) {
    jobs.push(
      searchKornormsExamples({
        searchKeyword: keyword,
        searchCondition: 'relate_mark_o',
        searchEquals: 'like',
        numOfRows: 30,
        signal,
      }),
    );
  }
  // equal 이 like 잡음보다 정확 (킹 → King, 스티븐 → Stephen)
  jobs.push(
    searchKornormsExamples({
      searchKeyword: keyword,
      searchCondition: 'korean_mark',
      searchEquals: 'equal',
      numOfRows: 10,
      signal,
    }),
  );
  jobs.push(
    searchKornormsExamples({
      searchKeyword: keyword,
      searchCondition: 'korean_mark',
      searchEquals: 'like',
      numOfRows: 30,
      signal,
    }),
  );
  const results = await Promise.all(jobs);
  const merged = new Map();
  for (const remote of results) {
    for (const item of remote.items) {
      const key = `${item.h}|${item.src ?? ''}|${item.c ?? ''}|${item.m ?? ''}`;
      if (!merged.has(key)) merged.set(key, item);
    }
  }
  return [...merged.values()];
}

/**
 * 공백으로 나눈 한글을 단어별로 각각 조회한다.
 * 통째 등재가 없으면 영어 구문과 같이 단어 카드로 보여 주기 위함.
 * (오표기 교정은 쓰지 않음 — 국어원 “킹(X)→칭” 오교정 방지)
 * @param {string[]} tokens
 * @param {Record<string, Array>} yongrye
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ items: Array<{ token: string, h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>, source: string } | null>}
 */
export async function resolveHangulTokensCompose(tokens, yongrye, signal) {
  if (tokens.length < 2) return null;
  /** @type {Array<{ token: string, h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} */
  const picks = [];
  let source = 'local';

  for (const token of tokens) {
    /** @type {Array<{ h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} */
    let pool = [];
    if (isKornormsConfigured()) {
      try {
        pool = await searchHangulKeywordViaApi(token, signal, {
          forCompose: true,
        });
        if (pool.length) source = 'kornorms';
      } catch {
        pool = [];
      }
    }
    pool = [...pool, ...lookupYongryeByHangul(token, yongrye)];
    if (!pool.length) continue;
    const best = pickBestHangulTokenItem(token, pool, {
      minScore: 50,
      allowTypo: false,
    });
    if (best) picks.push({ token, ...best });
  }

  if (!picks.length) return null;
  return { items: picks, source };
}

/**
 * 한글 질의 — 어문회 API(오표기·한글) 우선, 공백 구분이면 단어별 조합, 없으면 로컬.
 * @param {string} hangul
 * @param {Record<string, Array>} yongrye
 * @param {AbortSignal} [signal]
 */
export async function resolveHangulLoanwordQuery(hangul, yongrye, signal) {
  const q = String(hangul).trim().replace(/\s+/g, ' ');
  const variants = hangulQueryVariants(q);
  const tokens = q.split(/\s+/).filter(Boolean);
  /** @type {Array<{ h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} */
  let items = [];
  let source = 'local';

  if (isKornormsConfigured()) {
    try {
      const merged = new Map();
      for (const variant of variants) {
        for (const item of await searchHangulKeywordViaApi(variant, signal)) {
          const key = `${item.h}|${item.src ?? ''}|${item.c ?? ''}|${item.m ?? ''}`;
          if (!merged.has(key)) merged.set(key, item);
        }
      }
      // 전체 질의와 공백 무시로 맞는 항목만 남김 (스티븐 → 91건 나열 방지)
      const qKey = hangulKey(q);
      const filtered = [...merged.values()].filter((item) => {
        if (hangulKey(item.h) === qKey) return true;
        if ((item.o ?? []).some((o) => hangulKey(o) === qKey)) return true;
        if ((item.a ?? []).some((a) => hangulKey(a) === qKey)) return true;
        return false;
      });
      items = filtered.length ? filtered : [];
      if (items.length) source = 'kornorms';
    } catch {
      // 네트워크·키 오류 시 로컬 폴백
    }
  }

  if (!items.length) {
    for (const variant of variants) {
      items = lookupYongryeByHangul(variant, yongrye);
      if (items.length) break;
    }
    if (items.length) source = 'local';
  }

  // 구문 통째 등재 없음 → 영어 Stephen King처럼 단어별 카드
  if (!items.length && tokens.length > 1) {
    const perToken = await resolveHangulTokensCompose(tokens, yongrye, signal);
    if (perToken?.items?.length) {
      const words = perToken.items.map((p) => ({
        // 원어가 있으면 영어 구문 UI와 동일하게 Stephen → 스티븐
        word: p.src || p.token,
        hangul: p.h,
        source: 'yongrye',
        officialForms: [p.h, ...(p.a ?? [])],
        engine: null,
      }));
      return {
        mode: 'hangul',
        word: q,
        official: [],
        matchKind: 'other',
        source: perToken.source,
        engine: {
          phrase: q,
          found: true,
          estimated: false,
          hangul: words.map((w) => w.hangul).join(' '),
          words,
          results: [],
        },
        phrase: true,
      };
    }
  }

  const matchKind = classifyHangulMatch(q, items);
  return {
    mode: 'hangul',
    word: q,
    official: items,
    matchKind,
    source,
    engine: null,
    phrase: tokens.length > 1,
  };
}

/**
 * 원어(한자·가나·키릴·아랍 등) 질의 — 어문회 원어(srclang_mark) 검색.
 * @param {string} raw
 * @param {Record<string, Array>} _yongrye
 * @param {AbortSignal} [signal]
 */
export async function resolveSourceLangLoanwordQuery(raw, _yongrye, signal) {
  const q = normalizeLoanwordQuery(raw);
  const qKey = sourceKey(q);
  /** @type {Array<{ h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} */
  let items = [];
  let source = 'local';

  if (isKornormsConfigured() && qKey) {
    try {
      const [byEqual, byLike] = await Promise.all([
        searchKornormsExamples({
          searchKeyword: q,
          searchCondition: 'srclang_mark',
          searchEquals: 'equal',
          numOfRows: 30,
          signal,
        }),
        searchKornormsExamples({
          searchKeyword: q,
          searchCondition: 'srclang_mark',
          searchEquals: 'like',
          numOfRows: 50,
          signal,
        }),
      ]);
      const merged = new Map();
      for (const item of [...byEqual.items, ...byLike.items]) {
        const key = `${item.h}|${item.src ?? ''}|${item.c ?? ''}|${item.m ?? ''}`;
        if (!merged.has(key)) merged.set(key, item);
      }
      // API like 결과를 국어원 ‘포함’과 같이 통과 (いとう → 이토·사이토 등)
      items = [...merged.values()].filter((item) =>
        srcMatchesSourceQuery(item.src ?? '', q),
      );
      if (items.length) source = 'kornorms';
    } catch {
      // 네트워크·키 오류
    }
  }

  return {
    mode: 'source',
    word: q,
    official: items,
    matchKind: items.length ? 'exact' : 'other',
    source,
    engine: null,
    phrase: false,
  };
}

/** @deprecated resolveSourceLangLoanwordQuery 사용 */
export async function resolveCjkLoanwordQuery(raw, yongrye, signal) {
  return resolveSourceLangLoanwordQuery(raw, yongrye, signal);
}

/**
 * 원어 표기가 라틴 질의와 맞는지 — "Merkel" / "Merkel, Angela" / "Merkel 소체".
 * @param {string} src
 * @param {string} query
 */
export function srcMatchesLatinQuery(src, query) {
  const q = String(query).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return false;
  const base = stripSrcReading(src)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!base) return false;
  if (base === q) return true;
  if (base.startsWith(`${q},`) || base.startsWith(`${q} `)) return true;
  return false;
}

/**
 * 영어 질의 — API(어문회 원어) 우선, 키 없거나 실패 시에만 로컬 용례집.
 * (로컬 JSON은 영어 행만 잘라 둔 것이라 독일어 인명 등이 빠짐)
 * @param {string} word
 * @param {Record<string, Array>} yongrye
 * @param {Record<string, string>} cmu
 * @param {(w: string) => Promise<string | null>} ipaProvider
 * @param {AbortSignal} [signal]
 */
export async function resolveLatinLoanwordQuery(
  word,
  yongrye,
  cmu,
  ipaProvider,
  signal,
) {
  const q = String(word).trim();
  /** @type {Array<{ h: string, c?: string, m?: string, a?: string[], o?: string[], src?: string }>} */
  let official = [];
  let source = 'local';

  if (isKornormsConfigured()) {
    try {
      const [byEqual, byLike] = await Promise.all([
        searchKornormsExamples({
          searchKeyword: q,
          searchCondition: 'srclang_mark',
          searchEquals: 'equal',
          numOfRows: 20,
          signal,
        }),
        searchKornormsExamples({
          searchKeyword: q,
          searchCondition: 'srclang_mark',
          searchEquals: 'like',
          numOfRows: 30,
          signal,
        }),
      ]);
      const merged = new Map();
      for (const item of [...byEqual.items, ...byLike.items]) {
        if (!srcMatchesLatinQuery(item.src ?? '', q)) continue;
        const key = `${item.h}|${item.src ?? ''}|${item.c ?? ''}|${item.m ?? ''}`;
        if (!merged.has(key)) merged.set(key, item);
      }
      official = [...merged.values()];
      if (official.length) {
        source = 'kornorms';
        const catRank = (c) => {
          if (c === '인명') return 0;
          if (c === '일반 용어') return 1;
          if (c === '지명') return 2;
          return 3;
        };
        official.sort((a, b) => catRank(a.c) - catRank(b.c));
      }
    } catch {
      // API 실패 시 로컬 폴백
    }
  }

  if (!official.length) {
    official = lookupYongrye(q, yongrye).map((e) => ({ ...e }));
    source = 'local';
  }

  const isPhrase = /\s/.test(q);
  // 공식 등재는 API로 이미 채움 → 단어별 변환은 로컬 영어 용례로 덮지 않음
  const yongryeForEngine = source === 'kornorms' ? null : yongrye;
  const engine = isPhrase
    ? await convertPhraseAsync(q, cmu, yongryeForEngine, ipaProvider)
    : await convertWordAsync(q, cmu, ipaProvider);

  return {
    mode: 'latin',
    word: q,
    official,
    matchKind: official.length ? 'exact' : 'other',
    source,
    engine,
    phrase: isPhrase,
  };
}
