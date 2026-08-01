/**
 * 표기통일 발견 — Kiwi로 「이다」활용·종결·나열·원자 명사 잡음 제외.
 *
 * @see project-docs/kiwi-morph-product-effects-2026-08-02.md
 */
import { analyzeLine } from './analyze.js';
import { isJosaTag, isSkippableTrailingTag } from './tokens.js';
import { isKiwiBoundaryStemTag } from './boundaryGate.js';

/**
 * @param {string} tag
 */
function tagBase(tag) {
  return String(tag ?? '').split('-')[0];
}

function hangulOnly(surface) {
  return String(surface ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

/**
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {import('./tokens.js').KiwiToken[] | null} null = 분석 불가(캐시 미스·미로드)
 */
function analyzeTokens(surface, opts = {}) {
  const hangul = hangulOnly(surface);
  if (hangul.length < 2) return null;
  const analyzed = analyzeLine(hangul, opts);
  if (!analyzed?.tokens?.length) return null;
  return analyzed.tokens;
}

/**
 * 표면이 명사+이다 종결/연결(VCP+EF|EC)이면 true — 띄어쓰기 통일 후보 아님.
 * 분석 불가면 false (호출측에서 ready+unknown 별도 처리).
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiCopulaEndingSurface(surface, opts = {}) {
  const hangul = hangulOnly(surface);
  if (hangul.length < 3) return false;

  const tokens = analyzeTokens(hangul, opts);
  if (!tokens) return false;

  const tags = tokens.map((t) => tagBase(t.tag));
  for (let i = 0; i < tags.length - 1; i += 1) {
    if (
      tags[i] === 'VCP' &&
      (tags[i + 1] === 'EF' || tags[i + 1] === 'EC')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 나열 기호로 이어진 명사구(경제학·철학 → NNG+SP+NNG)이면 true.
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiEnumerationSurface(surface, opts = {}) {
  const text = String(surface ?? '').normalize('NFC');
  if (!text) return false;
  const analyzed = analyzeLine(text, opts);
  if (!analyzed?.tokens?.length) return false;
  const tags = analyzed.tokens.map((t) => tagBase(t.tag));
  for (let i = 1; i < tags.length - 1; i += 1) {
    if (tags[i] !== 'SP') continue;
    const left = tags[i - 1];
    const right = tags[i + 1];
    if (
      (left === 'NNG' || left === 'NNP') &&
      (right === 'NNG' || right === 'NNP')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 명사 글루 분류 — 위성·발견 제외의 공통 근거.
 * - `closed`: 단일 명사±XSN±조사 (경제학상·세계화·경제학이) → 통일 잡음
 * - `multi`: 명사 복합 (경제+침체·영국+정부) → 위성 허용
 * - `other`: 그 외 (용언 등)
 * - `unknown`: 분석 실패 (서버 모드 캐시 미스 등)
 *
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {'closed' | 'multi' | 'other' | 'unknown'}
 */
export function classifyKiwiGluedNoun(surface, opts = {}) {
  const tokens = analyzeTokens(surface, opts);
  if (!tokens) return 'unknown';

  const content = tokens.filter(
    (t) => !isSkippableTrailingTag(t.tag) && !isJosaTag(t.tag),
  );
  if (!content.length) return 'other';

  if (!isKiwiBoundaryStemTag(content[0].tag)) return 'other';
  if (content[0].position !== 0) return 'other';

  const stemEnd =
    content[content.length - 1].position + content[content.length - 1].length;
  for (const t of tokens) {
    if (t.position < stemEnd) continue;
    if (!isJosaTag(t.tag) && !isSkippableTrailingTag(t.tag)) return 'other';
  }

  const hangul = hangulOnly(surface);
  if (stemEnd > hangul.length) return 'other';

  // 명사 어간 1 + (XSN)*  → closed
  let onlyXsnAfter = true;
  for (let i = 1; i < content.length; i += 1) {
    if (tagBase(content[i].tag) !== 'XSN') {
      onlyXsnAfter = false;
      break;
    }
  }
  if (onlyXsnAfter) return 'closed';

  // 명사 계열 토큰만 2개 이상 → multi (경제+침체)
  if (
    content.length >= 2 &&
    content.every((t) => isKiwiBoundaryStemTag(t.tag))
  ) {
    return 'multi';
  }

  return 'other';
}

/**
 * 닫힌 명사 어간이면 true.
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiAtomicNounLexeme(surface, opts = {}) {
  return classifyKiwiGluedNoun(surface, opts) === 'closed';
}

/**
 * 표기통일 글루 잡음(발견 제외) — closed·이다·명사+하다/연결. unknown은 false(fail-open).
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function shouldExcludeUnifyGluedByKiwi(surface, opts = {}) {
  const kind = classifyKiwiGluedNoun(surface, opts);
  if (kind === 'closed') return true;
  if (isKiwiCopulaEndingSurface(surface, opts)) return true;
  if (isKiwiNounVerbalConnectiveSurface(surface, opts)) return true;
  return false;
}

/**
 * 명사+동사화(+어미) 또는 명사+하고/JC:
 * 상환하기·가치있다고·구성되며·예측하고·환경하고.
 * (`하`뿐 아니라 `있/VV`·`되/XSV` 등 포함. 뒤에 조사·다른 명사가 이어져도 제외.)
 * 명사 복합(명사+명사) 표기통일 후보가 아님. 분석 불가면 false(fail-open).
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiNounVerbalConnectiveSurface(surface, opts = {}) {
  const hangul = hangulOnly(surface);
  if (hangul.length < 3) return false;
  const tokens = analyzeTokens(hangul, opts);
  if (!tokens?.length) return false;

  let verbalIdx = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const base = tagBase(tokens[i].tag);
    // 하다(XSV)·되다(XSV)·있다(VV)·기타 동사화
    if (base === 'XSV' || base === 'VV' || base === 'VX') {
      verbalIdx = i;
      break;
    }
  }

  if (verbalIdx > 0) {
    const before = tokens
      .slice(0, verbalIdx)
      .filter((t) => !isJosaTag(t.tag) && !isSkippableTrailingTag(t.tag));
    if (
      before.length &&
      before.every((t) => isKiwiBoundaryStemTag(t.tag)) &&
      before.some((t) => {
        const b = tagBase(t.tag);
        return b === 'NNG' || b === 'NNP';
      })
    ) {
      let sawEnding = false;
      for (let i = verbalIdx + 1; i < tokens.length; i += 1) {
        const t = tokens[i];
        const base = tagBase(t.tag);
        if (base.startsWith('E')) {
          sawEnding = true;
          continue;
        }
        if (isJosaTag(t.tag) || isSkippableTrailingTag(t.tag)) continue;
        // 상환하기와상환 — 어미 뒤에 명사가 더 있어도 명사+동사화 표기
        if (sawEnding) return true;
        return false;
      }
      // 어미만 있거나 어미 없이 동사화만(드묾) → 제외
      return true;
    }
  }

  // 환경하고 → 환경/NNG + 하고/JC (접속조사)
  let jcIdx = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const base = tagBase(tokens[i].tag);
    const form = String(tokens[i].str ?? '');
    if (base === 'JC' && form === '하고') {
      jcIdx = i;
      break;
    }
  }
  if (jcIdx <= 0) return false;
  const beforeJc = tokens
    .slice(0, jcIdx)
    .filter((t) => !isJosaTag(t.tag) && !isSkippableTrailingTag(t.tag));
  if (!beforeJc.length) return false;
  if (!beforeJc.every((t) => isKiwiBoundaryStemTag(t.tag))) return false;
  if (
    !beforeJc.some((t) => {
      const b = tagBase(t.tag);
      return b === 'NNG' || b === 'NNP';
    })
  ) {
    return false;
  }
  for (let i = jcIdx + 1; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!isJosaTag(t.tag) && !isSkippableTrailingTag(t.tag)) return false;
  }
  return true;
}

/** @deprecated 이름 유지 — {@link isKiwiNounVerbalConnectiveSurface} */
export function isKiwiNounHadaConnectiveSurface(surface, opts = {}) {
  return isKiwiNounVerbalConnectiveSurface(surface, opts);
}

/**
 * 위성만 거부 — 분석된 closed·이다·명사+동사화. unknown은 통과(이형태 0회 위성 유지).
 * @param {string} surface
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function shouldRejectUnifySatelliteGlued(surface, opts = {}) {
  return shouldExcludeUnifyGluedByKiwi(surface, opts);
}

/**
 * 어절이 단독으로 명사(복합 성분)만인지.
 * `결국`은 문맥에선 NNG로도 붙지만 단독 분석은 MAG → false.
 * `이는`(이/NP+는/JX)처럼 대명사만 있는 어절은 명사 복합 성분이 아님.
 * @param {string} eojeol
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean} 분석 불가면 true(fail-open — 명사로 간주)
 */
export function isKiwiNounCompoundEojeol(eojeol, opts = {}) {
  const part = String(eojeol ?? '')
    .normalize('NFC')
    .trim();
  if (!part) return false;
  // 숫자·기호만(한글 없음) → 명사 복합 성분 아님
  if (!hangulOnly(part)) return false;
  const tokens = analyzeTokens(part, opts);
  if (!tokens) return true;
  const content = tokens.filter(
    (t) => !isSkippableTrailingTag(t.tag) && !isJosaTag(t.tag),
  );
  if (!content.length) return false;
  if (!content.every((t) => isKiwiBoundaryStemTag(t.tag))) return false;
  // NNG/NNP/외래어만 복합 명사 성분. NP·숫자(SN)는 제외.
  return content.some((t) => {
    const b = tagBase(t.tag);
    return b === 'NNG' || b === 'NNP' || b === 'SL' || b === 'SH';
  });
}

/** 동사 어간 태그 (VV·보조용언·동사화 접미사). 형용사 VA/XSA 제외. */
const KIWI_VERB_STEM_TAGS = new Set(['VV', 'VX', 'XSV']);

/**
 * @param {string} tag
 */
function isVerbStemTag(tag) {
  return KIWI_VERB_STEM_TAGS.has(tagBase(tag));
}

/**
 * 어미(E*)·조사 — 동사 어절 판별 시 무시
 * @param {string} tag
 */
function isVerbSkippableTag(tag) {
  const base = tagBase(tag);
  return base.startsWith('E') || isJosaTag(tag) || isSkippableTrailingTag(tag);
}

/**
 * 어절이 단독으로 동사(복합 성분)만인지. 형용사(VA)는 제외.
 * 분석 불가면 true(fail-open).
 * @param {string} eojeol
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiVerbCompoundEojeol(eojeol, opts = {}) {
  const part = String(eojeol ?? '')
    .normalize('NFC')
    .trim();
  if (!part) return false;
  const tokens = analyzeTokens(part, opts);
  if (!tokens) return true;
  const content = tokens.filter((t) => !isVerbSkippableTag(t.tag));
  if (!content.length) return false;
  return content.every((t) => isVerbStemTag(t.tag));
}

/**
 * 띄움 이형태가 명사·명사 복합이 아니면 true (결국 시장·말해 시장).
 * @param {string} spacedVariant
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiNonNounCompoundSpaced(spacedVariant, opts = {}) {
  const parts = String(spacedVariant ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  return parts.some((p) => !isKiwiNounCompoundEojeol(p, opts));
}

/**
 * 띄움이 동사·동사 복합이 아니면 true.
 * @param {string} spacedVariant
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function isKiwiNonVerbCompoundSpaced(spacedVariant, opts = {}) {
  const parts = String(spacedVariant ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  return parts.some((p) => !isKiwiVerbCompoundEojeol(p, opts));
}

/**
 * 띄움 어절 품사 분류 (위성 동종 판별용). fail-open 없음 — unknown 구분.
 * @param {string} eojeol
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {'noun' | 'verb' | 'other' | 'unknown'}
 */
export function classifyKiwiSpacedEojeolPos(eojeol, opts = {}) {
  const part = String(eojeol ?? '')
    .normalize('NFC')
    .trim();
  if (!part) return 'other';
  if (!hangulOnly(part)) return 'other';
  const tokens = analyzeTokens(part, opts);
  if (!tokens) return 'unknown';

  const nounContent = tokens.filter(
    (t) => !isSkippableTrailingTag(t.tag) && !isJosaTag(t.tag),
  );
  if (
    nounContent.length &&
    nounContent.every((t) => isKiwiBoundaryStemTag(t.tag)) &&
    nounContent.some((t) => {
      const b = tagBase(t.tag);
      return b === 'NNG' || b === 'NNP' || b === 'SL' || b === 'SH';
    })
  ) {
    return 'noun';
  }

  const verbContent = tokens.filter((t) => !isVerbSkippableTag(t.tag));
  if (verbContent.length && verbContent.every((t) => isVerbStemTag(t.tag))) {
    return 'verb';
  }
  return 'other';
}

/**
 * 이형태 없는 위성의 띄움형 — 동종 복합이 아니면 true(거부).
 * - 명사+명사도 동사+동사도 아니면 거부 (보통·손쉽게·말해 시장)
 * - `사실상 시장`(NNG+XSN)은 명사+명사로 유지
 * - dictPos=noun → 명사+명사만 / predicate → 동사+동사만
 * - 어절 분석 실패(unknown) → false(fail-open). 단, 명사·동사 양쪽에
 *   fail-open을 겹치면 잡음이 통과하므로 unknown은 여기서만 별도 처리.
 * @param {string} spacedVariant
 * @param {'noun' | 'predicate' | string | undefined | null} dictPos
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 * @returns {boolean}
 */
export function shouldRejectUnifySatelliteSpacedByPos(
  spacedVariant,
  dictPos,
  opts = {},
) {
  if (!/\s/.test(String(spacedVariant ?? ''))) return false;
  try {
    const parts = String(spacedVariant)
      .normalize('NFC')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length < 2) return false;
    const classes = parts.map((p) => classifyKiwiSpacedEojeolPos(p, opts));
    if (classes.some((c) => c === 'unknown')) return false;
    const allNoun = classes.every((c) => c === 'noun');
    const allVerb = classes.every((c) => c === 'verb');
    if (!allNoun && !allVerb) return true;
    if (dictPos === 'noun') return !allNoun;
    if (dictPos === 'predicate') return !allVerb;
    return false;
  } catch {
    return false;
  }
}
