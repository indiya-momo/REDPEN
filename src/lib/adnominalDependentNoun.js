/**
 * 한글 맞춤법 제42항 — 관형사형 어미(ETM) 뒤 의존명사(NNB) 붙임 → 띄어.
 * 후보 어절만 Kiwi로 보고, ETM 직후 NNB가 확인될 때만 제안(fail-closed).
 * ruleEngine·시트 핫패스에 붙이지 않는다. 띄어쓰기 폴더 findHits만.
 *
 * KEEP: 할수록(EC) · 끝난걸/할걸(거+JKO·EF) · 그만큼(MAG) · 키만큼(JKB) · 말한바(바는 n-ba)
 */

import { analyzeLine } from './kiwiMorph/analyze.js';
import { getKiwiInstance } from './kiwiMorph/runtime.js';
import { matchDeHeadwordGate } from './stdictDeHeadwords.js';
import {
  lookupStdictPosHits,
  stdictPosIndexBareKeyCount,
} from './stdictPosIndex.js';

export const ADNOMINAL_DEP_CATEGORY = '관형사형+의존명사';
export const ADNOMINAL_DEP_LABEL = '관형사형+의존명사';
export const ADNOMINAL_DEP_TIP =
  '한글 맞춤법 제42항: 관형사형 어미 뒤 의존명사(수·것·거·만큼·지·데·무렵·녘·때문·동안)는 띄어 씀. 무렵·녘·때문·동안은 붙여 쓴 전체가 표준국어대사전 표제어이면 잡지 않음. 조사가 붙은 하는데다·좋은데가는 잡고, 연결어미로 쓰인 하는데·없는데·없는데도는 잡지 않는다.';

/** 붙임 후보로만 훑는 의존명사 표면 (형태소 NNB 확인 전 필터). 걸=거+ㄹ 시각형 포함. */
const NNB_SURFACE_HINT = /수|것|거|걸|만큼|지|데|무렵|녘|때문|동안/;
/** 힌트 집합은 위 정규식에서 그대로 가져온다. */
const NNB_HINT_SET = new Set([
  '수',
  '것',
  '거',
  '걸',
  '만큼',
  '지',
  '데',
  '무렵',
  '녘',
  '때문',
  '동안',
]);

/**
 * 표제어 게이트를 거는 의존명사. 색인이 없으면 이 네 가지는 내지 않는다.
 * 수·것·거·만큼·지·데는 기존과 같이 형태소만 본다.
 */
const DICT_GATED_NNB = new Set(['무렵', '녘', '때문', '동안']);

/** 표제어 조회 전에 어절 끝에서 한 번만 떼는 조사. 긴 것 우선. */
const HEADWORD_GATE_PARTICLES = Object.freeze([
  '에서는',
  '에서도',
  '에서',
  '으로',
  '은',
  '는',
  '을',
  '를',
  '이',
  '가',
  '의',
  '에',
  '도',
  '만',
  '와',
  '과',
  '로',
]);

/** 는·은·ㄴ(+ 한) 뒤 데: 뜻을 가르는 조사가 있을 때만 잡음. 도·는은 침묵. */
const DE_ETM_GUARD = new Set(['는', '은', 'ㄴ', 'ᆫ', '한']);
const DE_OK_PARTICLES = new Set(['에', '가', '를', '다', '다가']);

/** @param {string | undefined} tag */
function tagBase(tag) {
  return String(tag ?? '').split('-')[0];
}

/**
 * 붙여 쓴 표면·제안 구간·조사 한 겹을 뗀 어간이 표제어이면 복합어로 본다.
 * @param {string} surface
 * @param {string} matchedText
 * @returns {boolean}
 */
function isRegisteredCompoundSurface(surface, matchedText) {
  const word = String(surface ?? '').normalize('NFC');
  const matched = String(matchedText ?? '').normalize('NFC');
  if (lookupStdictPosHits(word).length > 0) return true;
  if (matched && matched !== word && lookupStdictPosHits(matched).length > 0) {
    return true;
  }
  for (const particle of HEADWORD_GATE_PARTICLES) {
    if (word.length <= particle.length || !word.endsWith(particle)) continue;
    if (lookupStdictPosHits(word.slice(0, -particle.length)).length > 0) return true;
  }
  return false;
}

/**
 * @param {string} surface
 * @returns {boolean}
 */
export function looksLikeGluedAdnominalNnb(surface) {
  const s = String(surface ?? '');
  if (s.length < 2) return false;
  return NNB_SURFACE_HINT.test(s);
}

/**
 * @param {{ str?: string, tag?: string }[]} tokens
 * @param {number} etmIndex
 */
function deParticleAllowsSplit(tokens, etmIndex) {
  const next = tokens[etmIndex + 2];
  const nextStr = String(next?.str ?? '');
  if (DE_OK_PARTICLES.has(nextStr)) return true;
  if (nextStr === '다' && String(tokens[etmIndex + 3]?.str ?? '') === '가') {
    return true;
  }
  return false;
}

/**
 * @param {string} surface
 * @param {{ tokens?: { str: string, tag: string, position: number, length: number }[], surface1to1?: boolean } | null} analyzed
 * @returns {{ matchedText: string, suggestedText: string, kind: string, insertAt: number } | null}
 */
export function decideAdnominalDependentSplit(surface, analyzed) {
  const s = String(surface ?? '');
  if (!s || !analyzed) return null;
  const tokens = analyzed.tokens ?? [];
  if (tokens.length < 2) return null;

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const etm = tokens[i];
    const nnb = tokens[i + 1];
    if (tagBase(etm?.tag) !== 'ETM') continue;
    if (tagBase(nnb?.tag) !== 'NNB') continue;

    const nnbStr = String(nnb.str ?? '');
    // 바 — 연결어미성 「말한바」 KEEP (n-ba 모듈 담당)
    if (nnbStr === '바') continue;
    // 힌트 밖 NNB(듯·뿐·대로 등)는 건너뛰고 다음 힌트 쌍을 본다.
    if (!NNB_HINT_SET.has(nnbStr)) continue;

    const next = tokens[i + 2];
    // 거 + 조사(걸) — 「끝난걸」「한걸」 KEEP
    if (
      nnbStr === '거' &&
      next &&
      tagBase(next.tag).startsWith('J') &&
      Number(next.position) === Number(nnb.position)
    ) {
      continue;
    }

    // 가드 4: 는·은·ㄴ(+한) + 데는 에·가·를·다(가)가 있을 때만. 건너뛰어 고른 쌍에도 적용.
    if (nnbStr === '데' && DE_ETM_GUARD.has(String(etm.str ?? ''))) {
      if (!deParticleAllowsSplit(tokens, i)) continue;
    }

    const insertAt = Number(nnb.position);
    if (!Number.isFinite(insertAt) || insertAt <= 0 || insertAt >= s.length) {
      continue;
    }
    // 이미 띈 경우
    if (/\s/.test(s[insertAt - 1] ?? '')) continue;

    let end = insertAt + Math.max(Number(nnb.length) || 0, 1);
    // 걸까 — 거+이+ㄹ까가 같은 시각 위치에 붙음 → 매치 끝을 「걸까」까지
    if (nnbStr === '거') {
      const rest = s.slice(insertAt);
      const geolkka = rest.match(/^걸까/);
      if (geolkka) {
        end = insertAt + geolkka[0].length;
      } else {
        // 단독 「거」 음절
        end = insertAt + 1;
      }
    } else if (nnbStr === '만큼') {
      end = insertAt + 2;
    } else if (
      nnbStr === '것' ||
      nnbStr === '수' ||
      nnbStr === '지' ||
      nnbStr === '데'
    ) {
      end = insertAt + 1;
    } else {
      // 기타 NNB: 표면에서 nnb.str 길이만큼 (자모 토큰이면 최소 1)
      const visual = s.slice(insertAt);
      if (visual.startsWith(nnbStr) && nnbStr.length > 0) {
        end = insertAt + nnbStr.length;
      }
    }

    if (end <= insertAt || end > s.length) continue;
    const matchedText = s.slice(0, end);
    const suggestedText = `${s.slice(0, insertAt)} ${s.slice(insertAt, end)}`;
    if (!matchedText || matchedText === suggestedText) continue;

    return {
      matchedText,
      suggestedText,
      kind: nnbStr || 'NNB',
      insertAt,
    };
  }
  return null;
}

/**
 * @param {string} text
 * @param {{
 *   kiwi?: { ready?: () => boolean, analyze: Function } | null,
 * }} [opts]
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findAdnominalDependentNounHits(text, opts = {}) {
  if (!text) return [];
  const kiwi = opts.kiwi !== undefined ? opts.kiwi : getKiwiInstance();
  if (!kiwi?.ready?.()) return [];

  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const occupied = [];

  const overlaps = (start, end) =>
    occupied.some(([a, b]) => start < b && end > a);

  const re = /[\uAC00-\uD7A3]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const surface = m[0];
    if (!looksLikeGluedAdnominalNnb(surface)) continue;
    // 게이트는 접두 비교라 Kiwi보다 앞에 둔다.
    if (matchDeHeadwordGate(surface)) continue;
    const analyzed = analyzeLine(surface, { kiwi });
    const decided = decideAdnominalDependentSplit(surface, analyzed);
    if (!decided) continue;
    if (DICT_GATED_NNB.has(decided.kind)) {
      // 색인이 없으면 저물녘 같은 표제어를 잘못 띄울 수 있어 내지 않는다.
      if (stdictPosIndexBareKeyCount() === 0) continue;
      if (isRegisteredCompoundSurface(surface, decided.matchedText)) continue;
    }
    const start = m.index;
    const end = start + decided.matchedText.length;
    if (overlaps(start, end)) continue;
    occupied.push([start, end]);
    hits.push({
      index: start,
      matchedText: decided.matchedText,
      suggestedText: decided.suggestedText,
      kind: decided.kind,
    });
  }

  hits.sort((a, b) => a.index - b.index);
  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 * @param {{ kiwi?: { ready?: () => boolean, analyze: Function } | null }} [opts]
 */
export function findAdnominalDependentNounInPages(pages, opts = {}) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const out = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findAdnominalDependentNounHits(text, opts)) {
      out.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return out;
}
