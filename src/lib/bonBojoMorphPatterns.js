/**
 * 본보조 형태소 패턴 카탈로그 — 라벨 정리·재사용 단일 입구.
 *
 * 핵심: `displayLabel` "(아/어) + 하다" 가 「동사(보조용언) 연결 패턴」이다.
 * 활용 표면(기록하다·기록하여…) 단어장이 아니라, 본보조 시트 항목을 그대로 쓴다.
 *
 * - 라벨 정리: `bon-bojo-rules.json` 의 displayLabel / stems 만 고치면 여기·표기통일 잡음이 따라감
 * - 재사용: 표기통일 1차 휴리스틱, denylist patterns 메타, 추후 UI
 *
 * @see src/data/bon-bojo-rules.json
 * @see src/lib/unifyNoiseList.js
 */
import { getBonBojoGroups } from './bonBojoRules.js';
import {
  isUnifyHadaConjugationKey,
  isUnifyIdaConjugationKey,
} from './unifyPredicateBucket.js';

/** @typedef {'auxiliary-verb'} BonBojoMorphPatternKind */

/**
 * @typedef {{
 *   itemId: string,
 *   displayLabel: string,
 *   connective: string | null,
 *   auxiliary: string | null,
 *   primaryLabel: string,
 *   stems: readonly string[],
 *   enabled: boolean,
 *   kind: BonBojoMorphPatternKind,
 *   groupId: string,
 * }} BonBojoMorphPattern
 */

/** displayLabel: "(아/어) + 하다" → connective / auxiliary */
const DISPLAY_LABEL_RE = /^\(([^)]+)\)\s*\+\s*(.+)$/u;

/**
 * @param {string | undefined} displayLabel
 * @returns {{ connective: string | null, auxiliary: string | null, raw: string }}
 */
export function parseBonBojoDisplayLabel(displayLabel) {
  const raw = String(displayLabel ?? '').trim();
  const m = raw.match(DISPLAY_LABEL_RE);
  if (!m) {
    return { connective: null, auxiliary: null, raw };
  }
  return {
    connective: m[1].trim() || null,
    auxiliary: m[2].trim() || null,
    raw,
  };
}

/**
 * 앞으로 라벨 정리할 때 쓰는 정규 포맷.
 * @param {string} connective 예: 아/어
 * @param {string} auxiliary 예: 하다
 */
export function formatBonBojoDisplayLabel(connective, auxiliary) {
  const c = String(connective ?? '').trim();
  const a = String(auxiliary ?? '').trim();
  if (!c || !a) return '';
  return `(${c}) + ${a}`;
}

/**
 * @returns {readonly BonBojoMorphPattern[]}
 */
export function listBonBojoMorphPatterns() {
  /** @type {BonBojoMorphPattern[]} */
  const out = [];
  for (const group of getBonBojoGroups()) {
    const groupId = String(group.id ?? '').trim();
    for (const item of group.items ?? []) {
      const itemId = String(item.id ?? '').trim();
      if (!itemId) continue;
      const primaryLabel = String(item.label ?? '').trim();
      const parsed = parseBonBojoDisplayLabel(item.displayLabel);
      const displayLabel =
        parsed.raw ||
        (primaryLabel
          ? formatBonBojoDisplayLabel('아/어', `${primaryLabel}다`)
          : itemId);
      const stems = Object.freeze(
        (Array.isArray(item.stems) ? item.stems : [])
          .map((s) => String(s ?? '').trim().replace(/\s+/g, ' '))
          .filter(Boolean),
      );
      out.push(
        Object.freeze({
          itemId,
          displayLabel,
          connective: parsed.connective,
          auxiliary: parsed.auxiliary,
          primaryLabel,
          stems,
          enabled: item.enabled === true,
          kind: /** @type {BonBojoMorphPatternKind} */ ('auxiliary-verb'),
          groupId,
        }),
      );
    }
  }
  return Object.freeze(out);
}

/**
 * @param {string} itemId
 * @returns {BonBojoMorphPattern | undefined}
 */
export function getBonBojoMorphPattern(itemId) {
  const id = String(itemId ?? '').trim();
  if (!id) return undefined;
  return listBonBojoMorphPatterns().find((p) => p.itemId === id);
}

/**
 * 보조용언 사전형 꼬리 — PREDICATE_DICTIONARY_TAILS 와 맞춤용.
 * @returns {readonly string[]}
 */
export function listBonBojoAuxiliaryLemmas() {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const p of listBonBojoMorphPatterns()) {
    const lemma = p.auxiliary?.trim();
    if (!lemma || seen.has(lemma)) continue;
    seen.add(lemma);
    out.push(lemma);
  }
  return Object.freeze(out);
}

/** 공통 어미 — label(하·지·버…) 뒤에 붙어 「용언 연결」 표면을 만든다. 단어장 아님. */
const AUX_ENDING_EC = Object.freeze(
  [
    '습니다',
    'ㅂ니다',
    'ㅂ니까',
    '도록',
    '다면',
    '려면',
    '므로',
    '면서',
    '고서',
    '다고',
    '라는',
    '라고',
    '지만',
    '거나',
    '든지',
    '던',
    '었',
    '았',
    '였',
    '겠',
    '려',
    '고',
    '서',
    '며',
    '면',
    '니',
    '게',
    '지',
    '기',
    '는',
    '은',
    '을',
    '다',
    '네',
    '요',
    '죠',
    '라',
    '자',
    '여',
    '어',
    '아',
    '해',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

/**
 * stems 오른쪽 음절(하·했·진…) + EC → 연결 꼬리 집합.
 * @param {BonBojoMorphPattern} pattern
 * @returns {readonly string[]}
 */
export function conjugationTailsForBonBojoPattern(pattern) {
  const tails = new Set();
  const label = pattern.primaryLabel;
  if (label) {
    for (const ec of AUX_ENDING_EC) {
      tails.add(`${label}${ec}`);
    }
    tails.add(label);
  }
  if (pattern.auxiliary) {
    tails.add(pattern.auxiliary);
  }
  for (const spaced of pattern.stems) {
    const right = spaced.split(/\s+/).filter(Boolean).at(-1);
    if (!right) continue;
    tails.add(right);
    for (const ec of AUX_ENDING_EC) {
      if (right.length === 1) tails.add(`${right}${ec}`);
    }
  }
  return Object.freeze(
    [...tails].toSorted(
      (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
    ),
  );
}

/**
 * @param {string} surface
 */
function hangulOnly(surface) {
  return String(surface ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

/** @type {readonly string[] | null} */
let cachedNonHadaTails = null;

function nonHadaConjugationTails() {
  if (cachedNonHadaTails) return cachedNonHadaTails;
  const set = new Set();
  for (const pattern of listBonBojoMorphPatterns()) {
    if (pattern.itemId === 'verb-hada' || pattern.auxiliary === '하다') continue;
    for (const tail of conjugationTailsForBonBojoPattern(pattern)) {
      if (tail.length >= 2) set.add(tail);
    }
  }
  cachedNonHadaTails = Object.freeze(
    [...set].toSorted(
      (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
    ),
  );
  return cachedNonHadaTails;
}

/**
 * 어절이 본보조 계열 「동사 연결」 표면인지 (Kiwi 없이 1차).
 * - 하다/이다: 기존 활용 꼬리 재사용 (단어장 아님)
 * - 그 외 보조: displayLabel·stems 에서 만든 label+EC 패턴
 *
 * @param {string} eojeol
 * @returns {boolean}
 */
export function matchesBonBojoVerbalConnectiveHeuristic(eojeol) {
  const h = hangulOnly(eojeol);
  // 보면(2)·하여(2) 등 짧은 연결 표면
  if (h.length < 2) return false;

  // verb-hada / 명사+하다 — 본보조 핵심 패턴의 활용 표면
  if (isUnifyHadaConjugationKey(h)) return true;
  // 이다는 본보조 시트 밖이지만 같은 「용언 연결」 잡음
  if (isUnifyIdaConjugationKey(h)) return true;

  for (const tail of nonHadaConjugationTails()) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    // 꼬리 단독(보면)만 1·0음절 허용 — 캐나다⊃나다 오탐 방지
    if (!stem) return true;
    if (stem.length < 2) continue;
    if (!/^[\uAC00-\uD7A3]+$/u.test(stem)) continue;
    return true;
  }
  return false;
}

/**
 * denylist / 문서용 — 패턴 id 목록 (bon-bojo itemId).
 * @returns {readonly string[]}
 */
export function listBonBojoMorphPatternIds() {
  return Object.freeze(listBonBojoMorphPatterns().map((p) => p.itemId));
}
