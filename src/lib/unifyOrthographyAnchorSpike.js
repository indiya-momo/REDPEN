/**
 * 표기 통일 목표 3단 스파이크 — 라틴 괄호 병기 앵커.
 *
 * Discover 제품 경로에 아직 연결하지 않는다. 진단·설계 검증용.
 * 대상은 **명사(고유명·일반 명사 추정)** 만 — 용언·의존명사+의 는 제외.
 * @see project-docs/unify-stage3-orthography-spike-2026-08-06.md
 */

import { classifyUnifyListStem } from './unifyListStemTriage.js';
import { hasUnifyNoiseDenyEojeol } from './unifyNoiseListData.js';

const HANGUL_SYL = '\uAC00-\uD7A3';
/** 한글덩어리 + 선택 공백 + (Latin…) — 예: 도널드(Donald), 초콜릿 (Chocolate) */
const LATIN_PAREN_ANCHOR_RE = new RegExp(
  `([${HANGUL_SYL}]{2,})\\s*\\(([A-Za-z][A-Za-z '\\-]{0,60})\\)`,
  'g',
);
const HANGUL_TOKEN_RE = new RegExp(`[${HANGUL_SYL}]{2,}`, 'g');

/** 병기 밖 이형태가 조사에 붙는 경우(도날드가)용 — Discover 조사 목록의 짧은 부분집합 */
const TRAILING_JOSA = Object.freeze([
  '으로부터',
  '으로서',
  '에서',
  '으로',
  '로서',
  '로써',
  '부터',
  '까지',
  '처럼',
  '만이',
  '을',
  '를',
  '이',
  '가',
  '은',
  '는',
  '와',
  '과',
  '의',
  '에',
  '로',
  '도',
  '만',
]);

const CHO = Object.freeze([
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]);
const JUNG = Object.freeze([
  'ㅏ',
  'ㅐ',
  'ㅑ',
  'ㅒ',
  'ㅓ',
  'ㅔ',
  'ㅕ',
  'ㅖ',
  'ㅗ',
  'ㅘ',
  'ㅙ',
  'ㅚ',
  'ㅛ',
  'ㅜ',
  'ㅝ',
  'ㅞ',
  'ㅟ',
  'ㅠ',
  'ㅡ',
  'ㅢ',
  'ㅣ',
]);
const JONG = Object.freeze([
  '',
  'ㄱ',
  'ㄲ',
  'ㄳ',
  'ㄴ',
  'ㄵ',
  'ㄶ',
  'ㄷ',
  'ㄹ',
  'ㄺ',
  'ㄻ',
  'ㄼ',
  'ㄽ',
  'ㄾ',
  'ㄿ',
  'ㅀ',
  'ㅁ',
  'ㅂ',
  'ㅄ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
]);

/**
 * @param {string} text
 * @returns {string}
 */
export function nfc(text) {
  return String(text ?? '').normalize('NFC');
}

/**
 * @param {string} latin
 * @returns {string}
 */
export function normalizeLatinKey(latin) {
  return nfc(latin)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 완성형 한글 → 자모 열 (편집거리용).
 * @param {string} s
 * @returns {string}
 */
export function hangulToJamo(s) {
  let out = '';
  for (const ch of nfc(s)) {
    const code = ch.codePointAt(0);
    if (code == null || code < 0xac00 || code > 0xd7a3) {
      out += ch;
      continue;
    }
    const syl = code - 0xac00;
    const ci = Math.floor(syl / 588);
    const ji = Math.floor((syl % 588) / 28);
    const gi = syl % 28;
    out += CHO[ci] + JUNG[ji] + (JONG[gi] || '');
  }
  return out;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function jamoEditDistance(a, b) {
  const s = hangulToJamo(a);
  const t = hangulToJamo(b);
  if (s === t) return 0;
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  /** @type {number[]} */
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  /** @type {number[]} */
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const sc = s.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/**
 * 3단 철자·음차 후보로 쓸 명사 표면인지.
 * - 표기통일 triage `certain_noun`
 * - 조사 잔여(조사로·조사에) 제외
 * - 기본형 용언(…다) · 명령/청유(말아라·말하라·말하자) 제외
 * @param {string} surface
 * @returns {boolean}
 */
export function isOrthoNounSurface(surface) {
  const s = nfc(surface);
  if (!s || [...s].length < 2) return false;
  if (hasUnifyNoiseDenyEojeol(s)) return false;
  if (endsWithTrailingJosa(s)) return false;
  if (endsWithDictionaryDa(s) && !NOUN_ENDING_DA.has(s)) return false;
  if (endsWithSpeechPredicateTail(s)) return false;
  // 명사+하 미완성(조사하) — 하다 활용 조각
  if ([...s].length >= 3 && s.endsWith('하')) return false;
  return classifyUnifyListStem(s) === 'certain_noun';
}

/** @param {string} s */
function endsWithTrailingJosa(s) {
  for (const j of TRAILING_JOSA) {
    if (s.length > j.length + 1 && s.endsWith(j)) return true;
  }
  return false;
}

/** @param {string} s */
function endsWithDictionaryDa(s) {
  return s.length >= 2 && s.endsWith('다');
}

/**
 * 명령·청유·하세요체 등 — 말아라/말하라/말하자.
 * 긴 꼬리 우선.
 * @param {string} s
 */
function endsWithSpeechPredicateTail(s) {
  for (const tail of SPEECH_PREDICATE_TAILS) {
    if (s.length > tail.length && s.endsWith(tail)) return true;
  }
  return false;
}

/** 끝이 `다`여도 명사인 닫힌 예외 */
const NOUN_ENDING_DA = Object.freeze(new Set(['바다', '과다']));

/** 명령·청유·하세요체 꼬리 (긴 것 우선) */
const SPEECH_PREDICATE_TAILS = Object.freeze([
  '읍시다',
  '습니까',
  '습니다',
  'ㅂ니다',
  '하세요',
  '아라',
  '어라',
  '여라',
  '하라',
  '거라',
  '려라',
  '너라',
  '하자',
  '보자',
  '지자',
  '세요',
]);

/** 같은 병기 라틴에 묶인 한글끼리 허용하는 최대 자모 거리 */
export const ORTHO_MAX_COHESION_JAMO = 2;

/** 병기 라틴 최소 길이 — SCE 등 약어·잡음 앵커 제외 */
export const ORTHO_MIN_LATIN_LEN = 4;

/** 근접 이웃으로 붙일 수 있는 최대 개수(앵커 제외) */
export const ORTHO_MAX_NEAR_NEIGHBORS = 2;

/**
 * 자모 이웃으로 묶기엔 너무 헐거운 클러스터(폭발) 상한.
 * 넘으면 mix에서 제외.
 */
export const ORTHO_MAX_MIX_VARIANTS = 4;

/**
 * 같은 병기 라틴에 달린 한글이 PDF 순서로 잘못 붙은 경우(세이노↔말아라)를 걸러,
 * 다수형 주변(자모·음절·초성)만 남긴다.
 * @param {string[]} hanguls
 * @param {string} text
 * @param {number} [maxJamo=ORTHO_MAX_COHESION_JAMO]
 * @returns {string[]}
 */
export function filterHangulByMajorityCohesion(
  hanguls,
  text,
  maxJamo = ORTHO_MAX_COHESION_JAMO,
) {
  const uniq = [...new Set(hanguls.map((h) => nfc(h)).filter(Boolean))];
  if (uniq.length <= 1) return uniq;

  const scored = uniq
    .map((h) => ({ h, n: countHangulSurface(text, h) }))
    .toSorted(
      (a, b) => b.n - a.n || a.h.localeCompare(b.h, 'ko'),
    );
  const seed = scored[0].h;

  return uniq.filter((h) => {
    if (h === seed) return true;
    return areOrthoVariantSurfaces(h, seed, maxJamo);
  });
}

/**
 * @param {string} latinKey
 * @returns {boolean}
 */
export function isOrthoLatinKeyAcceptable(latinKey) {
  const key = String(latinKey ?? '').trim();
  // "street knowledge" / "Say No" / "Me first" — 음차 로마자가 아니라 뜻풀이 병기
  if (/\s/.test(key)) return false;
  const letters = key.replace(/[^a-z]/gi, '');
  return letters.length >= ORTHO_MIN_LATIN_LEN;
}

/**
 * 두 한글이 “같은 말의 철자 이형태”로 볼 만큼 가까운지.
 * 2음절은 초성만 같고 모음만 다른 다른 단어(자식·지식)가 많아,
 * 중성 혼동 쌍(ㅏ↔ㅓ, ㅗ↔ㅘ 등)일 때만 허용한다.
 * @param {string} a
 * @param {string} b
 * @param {number} [maxJamo]
 * @returns {boolean}
 */
export function areOrthoVariantSurfaces(a, b, maxJamo = ORTHO_MAX_COHESION_JAMO) {
  const aa = nfc(a);
  const bb = nfc(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  const as = [...aa];
  const bs = [...bb];
  if (as.length !== bs.length) return false;
  if (hangulOnset(aa) !== hangulOnset(bb)) return false;
  const d = jamoEditDistance(aa, bb);
  if (d <= 0 || d > maxJamo) return false;

  let identicalSyl = 0;
  for (let i = 0; i < as.length; i++) {
    if (as[i] === bs[i]) identicalSyl += 1;
  }
  if (identicalSyl < as.length - 1) return false;

  for (let i = 0; i < as.length; i++) {
    if (as[i] === bs[i]) continue;
    if (!syllableConfusableOrthography(as[i], bs[i])) return false;
  }
  return true;
}

/** 외래·음차에서 자주 갈리는 중성 쌍 */
const CONFUSABLE_MEDIALS = Object.freeze({
  ㅏ: new Set(['ㅓ', 'ㅑ']),
  ㅓ: new Set(['ㅏ', 'ㅕ']),
  ㅐ: new Set(['ㅔ']),
  ㅔ: new Set(['ㅐ']),
  ㅗ: new Set(['ㅘ', 'ㅜ']),
  ㅘ: new Set(['ㅗ']),
  ㅜ: new Set(['ㅝ', 'ㅗ']),
  ㅝ: new Set(['ㅜ']),
  ㅡ: new Set(['ㅜ']),
});

/**
 * 한 음절이 음차 이형태로 혼동 가능한지 (초·종성 동일, 중성만 혼동 쌍).
 * @param {string} sylA
 * @param {string} sylB
 */
function syllableConfusableOrthography(sylA, sylB) {
  if (sylA === sylB) return true;
  if ([...sylA].length !== 1 || [...sylB].length !== 1) return false;
  const ja = hangulToJamo(sylA);
  const jb = hangulToJamo(sylB);
  if (ja.length < 2 || jb.length < 2) return false;
  if (ja[0] !== jb[0]) return false;
  const codaA = ja.length > 2 ? ja.slice(2) : '';
  const codaB = jb.length > 2 ? jb.slice(2) : '';
  if (codaA !== codaB) return false;
  const medialA = ja.slice(1, ja.length - codaA.length);
  const medialB = jb.slice(1, jb.length - codaB.length);
  if (medialA === medialB) return true;
  const conf = CONFUSABLE_MEDIALS[medialA];
  return Boolean(conf && conf.has(medialB));
}

/**
 * @typedef {{
 *   hangul: string,
 *   latin: string,
 *   latinKey: string,
 *   index: number,
 *   matchedText: string,
 * }} OrthoLatinParenAnchor
 */

/**
 * @param {string} text
 * @returns {OrthoLatinParenAnchor[]}
 */
export function extractLatinParenAnchors(text) {
  const src = nfc(text);
  /** @type {OrthoLatinParenAnchor[]} */
  const out = [];
  LATIN_PAREN_ANCHOR_RE.lastIndex = 0;
  let m;
  while ((m = LATIN_PAREN_ANCHOR_RE.exec(src)) !== null) {
    const hangul = m[1];
    const latin = m[2].trim();
    if (!hangul || !latin) continue;
    const latinKey = normalizeLatinKey(latin);
    if (!isOrthoLatinKeyAcceptable(latinKey)) continue;
    out.push({
      hangul,
      latin,
      latinKey,
      index: m.index,
      matchedText: m[0],
    });
  }
  return out;
}

/**
 * 조사만 떼어 낸 최장 줄기 하나. 조사 잔여 원형은 넣지 않음.
 * @param {string} token
 * @returns {string | null}
 */
export function primaryHangulStem(token) {
  const t = nfc(token);
  let best = t;
  for (const j of TRAILING_JOSA) {
    if (best.length > j.length + 1 && best.endsWith(j)) {
      best = best.slice(0, -j.length);
    }
  }
  // 여러 조사 연쇄 재적용
  let changed = true;
  while (changed) {
    changed = false;
    for (const j of TRAILING_JOSA) {
      if (best.length > j.length + 1 && best.endsWith(j)) {
        best = best.slice(0, -j.length);
        changed = true;
        break;
      }
    }
  }
  if ([...best].length < 2) return null;
  return best;
}

/**
 * @param {string} token
 * @returns {string[]} 원형 + 조사 제거 줄기
 */
export function hangulStemsFromToken(token) {
  const t = nfc(token);
  /** @type {string[]} */
  const out = [t];
  for (const j of TRAILING_JOSA) {
    if (t.length > j.length + 1 && t.endsWith(j)) {
      out.push(t.slice(0, -j.length));
    }
  }
  return out;
}

/**
 * 문서 내 한글 덩어리(조사 포함 어절) 출현 수.
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function countHangulTokens(text) {
  const src = nfc(text);
  /** @type {Map<string, number>} */
  const map = new Map();
  HANGUL_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = HANGUL_TOKEN_RE.exec(src)) !== null) {
    const t = m[0];
    map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

/**
 * 표면형 출현 수 — 단독 어절 + 조사만 붙인 어절(도날드가).
 * @param {string} text
 * @param {string} surface
 * @returns {number}
 */
export function countHangulSurface(text, surface) {
  const s = nfc(surface);
  if (s.length < 2) return 0;
  const src = nfc(text);
  let n = 0;
  HANGUL_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = HANGUL_TOKEN_RE.exec(src)) !== null) {
    const tok = m[0];
    if (tok === s || hangulStemsFromToken(tok).includes(s)) n += 1;
  }
  return n;
}

/**
 * 완성형 한 글자의 초성 자모. 비한글이면 ''.
 * @param {string} syl
 * @returns {string}
 */
export function hangulOnset(syl) {
  const ch = nfc(syl)[0];
  if (!ch) return '';
  const code = ch.codePointAt(0);
  if (code == null || code < 0xac00 || code > 0xd7a3) return '';
  return CHO[Math.floor((code - 0xac00) / 588)] || '';
}

/**
 * @param {Map<string, number>} counts
 * @param {string[]} variants
 * @returns {string}
 */
export function pickMajoritySurface(counts, variants) {
  let best = variants[0] || '';
  let bestN = -1;
  for (const v of variants) {
    const n = counts.get(v) || 0;
    if (n > bestN || (n === bestN && v.localeCompare(best, 'ko') < 0)) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/**
 * 음절 단위로 다른 자리의 (이전→이후) 표기 차.
 * @param {string} a
 * @param {string} b
 * @returns {string[]}
 */
export function syllableDiffPairs(a, b) {
  const aa = [...nfc(a)];
  const bb = [...nfc(b)];
  const n = Math.min(aa.length, bb.length);
  /** @type {string[]} */
  const diffs = [];
  for (let i = 0; i < n; i++) {
    if (aa[i] !== bb[i]) diffs.push(`${aa[i]}↔${bb[i]}`);
  }
  if (aa.length !== bb.length) {
    diffs.push(`len:${aa.length}↔${bb.length}`);
  }
  return diffs;
}

/**
 * @typedef {{
 *   key: string,
 *   latin: string,
 *   latinKey: string,
 *   variants: string[],
 *   counts: Record<string, number>,
 *   recommendedUnify: string,
 *   totalCount: number,
 *   needsVerification: true,
 *   source: 'latin-paren-anchor',
 *   kind: 'latin-multi-hangul' | 'anchor-near-hangul' | 'anchor-only',
 *   jamoDistances?: Record<string, number>,
 *   observedSyllableDiffs?: string[],
 *   anchors: OrthoLatinParenAnchor[],
 * }} OrthoAnchorCluster
 */

/**
 * @param {object} opts
 * @param {string} opts.text
 * @param {number} [opts.maxJamoDistance=1] 근접 이웃 자모 거리 (켤 때만)
 * @param {boolean} [opts.includeNearNeighbors=false] 기본 끔 — 자모 비슷한 다른 단어 오탐 방지
 * @returns {{
 *   anchors: OrthoLatinParenAnchor[],
 *   clusters: OrthoAnchorCluster[],
 *   mixClusters: OrthoAnchorCluster[],
 *   observedSyllableDiffs: string[],
 * }}
 */
export function discoverOrthographyFromLatinParenAnchors(opts) {
  const text = nfc(opts.text);
  const maxJamoDistance = opts.maxJamoDistance ?? 1;
  const includeNearNeighbors = opts.includeNearNeighbors === true;

  const anchors = extractLatinParenAnchors(text).filter((a) =>
    isOrthoNounSurface(a.hangul),
  );
  const tokenCounts = countHangulTokens(text);
  /** @type {Set<string>} */
  const stemUniverse = new Set();
  for (const tok of tokenCounts.keys()) {
    const stem = primaryHangulStem(tok);
    if (stem && isOrthoNounSurface(stem)) stemUniverse.add(stem);
  }

  /** @type {Map<string, OrthoLatinParenAnchor[]>} */
  const byLatin = new Map();
  for (const a of anchors) {
    const list = byLatin.get(a.latinKey) || [];
    list.push(a);
    byLatin.set(a.latinKey, list);
  }

  /** @type {OrthoAnchorCluster[]} */
  const clusters = [];
  /** @type {Set<string>} */
  const allDiffs = new Set();

  for (const [latinKey, group] of byLatin) {
    if (!isOrthoLatinKeyAcceptable(latinKey)) continue;

    const hangulRaw = [
      ...new Set(group.map((g) => g.hangul).filter(isOrthoNounSurface)),
    ];
    // 같은 (Say No)에 말아라·세이노처럼 자모가 먼 한글이 같이 붙으면 다수형 쪽으로만
    const hangulFromAnchors = filterHangulByMajorityCohesion(hangulRaw, text);
    if (!hangulFromAnchors.length) continue;

    /** @type {Set<string>} */
    const variantSet = new Set(hangulFromAnchors);

    /** @type {Record<string, number>} */
    const jamoDistances = {};

    if (includeNearNeighbors) {
      /** @type {{ stem: string, d: number }[]} */
      const candidates = [];
      for (const seed of hangulFromAnchors) {
        for (const stem of stemUniverse) {
          if (variantSet.has(stem)) continue;
          if (!isOrthoNounSurface(stem)) continue;
          if (!areOrthoVariantSurfaces(seed, stem, maxJamoDistance)) continue;
          candidates.push({ stem, d: jamoEditDistance(seed, stem) });
        }
      }
      candidates.sort(
        (a, b) => a.d - b.d || a.stem.localeCompare(b.stem, 'ko'),
      );
      let added = 0;
      for (const { stem, d } of candidates) {
        if (variantSet.has(stem)) continue;
        if (added >= ORTHO_MAX_NEAR_NEIGHBORS) break;
        const cohesive = filterHangulByMajorityCohesion(
          [...variantSet, stem],
          text,
        );
        if (!cohesive.includes(stem)) continue;
        variantSet.add(stem);
        jamoDistances[stem] = d;
        added += 1;
      }
    }

    const variants = [...variantSet]
      .filter(isOrthoNounSurface)
      .toSorted((a, b) => a.localeCompare(b, 'ko'));
    if (!variants.length) continue;

    /** @type {Record<string, number>} */
    const counts = {};
    let totalCount = 0;
    for (const v of variants) {
      const n = countHangulSurface(text, v);
      counts[v] = n;
      totalCount += n;
    }

    /** @type {string[]} */
    const observedSyllableDiffs = [];
    for (let i = 0; i < hangulFromAnchors.length; i++) {
      for (let j = i + 1; j < hangulFromAnchors.length; j++) {
        for (const d of syllableDiffPairs(hangulFromAnchors[i], hangulFromAnchors[j])) {
          observedSyllableDiffs.push(d);
          allDiffs.add(d);
        }
      }
    }
    for (const seed of hangulFromAnchors) {
      for (const v of variants) {
        if (hangulFromAnchors.includes(v)) continue;
        for (const d of syllableDiffPairs(seed, v)) {
          observedSyllableDiffs.push(d);
          allDiffs.add(d);
        }
      }
    }

    let kind = /** @type {OrthoAnchorCluster['kind']} */ ('anchor-only');
    if (hangulFromAnchors.length >= 2) kind = 'latin-multi-hangul';
    else if (variants.length >= 2) kind = 'anchor-near-hangul';

    clusters.push({
      key: `ortho:latin:${latinKey}`,
      latin: group[0].latin,
      latinKey,
      variants,
      counts,
      recommendedUnify: pickMajoritySurface(
        new Map(Object.entries(counts)),
        variants,
      ),
      totalCount,
      needsVerification: true,
      source: 'latin-paren-anchor',
      kind,
      jamoDistances:
        Object.keys(jamoDistances).length > 0 ? jamoDistances : undefined,
      observedSyllableDiffs:
        observedSyllableDiffs.length > 0
          ? [...new Set(observedSyllableDiffs)]
          : undefined,
      anchors: group,
    });
  }

  clusters.sort(
    (a, b) =>
      b.totalCount - a.totalCount ||
      a.latinKey.localeCompare(b.latinKey, 'en'),
  );

  const mixClusters = clusters.filter(
    (c) =>
      c.variants.length >= 2 &&
      c.variants.length <= ORTHO_MAX_MIX_VARIANTS,
  );

  return {
    anchors,
    clusters,
    mixClusters,
    observedSyllableDiffs: [...allDiffs].toSorted((a, b) =>
      a.localeCompare(b, 'ko'),
    ),
  };
}

/**
 * PDF 페이지 텍스트 배열에서 3단 병기 앵커 Discover.
 * @param {{ pageNum?: number, text?: string }[]} pages
 * @param {{ maxJamoDistance?: number, includeNearNeighbors?: boolean }} [opts]
 * @returns {{
 *   anchors: OrthoLatinParenAnchor[],
 *   clusters: OrthoAnchorCluster[],
 *   mixClusters: (OrthoAnchorCluster & {
 *     pagesByVariant: Record<string, number[]>,
 *   })[],
 *   observedSyllableDiffs: string[],
 * }}
 */
export function discoverOrthographyFromPages(pages, opts = {}) {
  const list = Array.isArray(pages) ? pages : [];
  const text = list.map((p) => String(p?.text ?? '')).join('\n');
  const base = discoverOrthographyFromLatinParenAnchors({ text, ...opts });

  const mixClusters = base.mixClusters.map((c) => {
    /** @type {Record<string, number[]>} */
    const pagesByVariant = {};
    for (const v of c.variants) {
      /** @type {number[]} */
      const nums = [];
      for (const p of list) {
        const pageNum = Number(p?.pageNum);
        if (!Number.isFinite(pageNum)) continue;
        if (countHangulSurface(String(p?.text ?? ''), v) > 0) {
          nums.push(pageNum);
        }
      }
      pagesByVariant[v] = nums;
    }
    return { ...c, pagesByVariant };
  });

  return {
    ...base,
    mixClusters,
  };
}
