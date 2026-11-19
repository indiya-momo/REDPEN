/**
 * 맞춤법 탭 「띄어쓰기」 폴더 — 본용언+보조용언(-아/-어 아닌 경우).
 *
 * 설계(2026-11-19 결정, 본조 탭에서 이관):
 * - 보조용언과 붙여 쓸 수 있는 것은 본용언이 -아/-어일 때뿐이다(한글 맞춤법 제47항).
 * - -다(가)·-(으)라·-(으)러·-(으)려·-지·-게·-고·-도록·-었다 같은 다른 연결 뒤에
 *   붙여 쓴 보조용언(먹지마·먹다보니·먹으러갔다·먹고버리다)은 「선택」이 아니라
 *   띄어쓰기 오류라서 본조 탭이 아니라 이 폴더에서 낸다.
 * - 판정은 본조와 같은 코드를 쓴다.
 *   연결형: `auxiliaryConnective.js` `classifyConnectiveBeforeAux`
 *   보조용언 onset: 시트 `bon-bojo-rules.json` 항목(`auxOnsetsForItem`)
 *   사전 한 단어(내다보다·들여다보다): `stdict-verb-forms.json`(`resolveSpaceRequiredLemma`)
 *   형태소: Kiwi(`analyzeLine`) — 본조와 같이 fail-closed
 * - 호출 지점만 다르다: 이 모듈은 페이지 텍스트를 직접 훑는 `findHits(text)`다.
 *   시트 규칙(본조 체크 on/off)과 상관없이 시트의 모든 보조용언 항목을 본다.
 *
 * 동기 `findHits`가 쓰는 사전·형태소는 검사 전에 `prepareNonAeoAuxSpacing`으로 채운다.
 * 사전 추출본이 아직 없으면 hit를 내지 않는다(사전 한 단어 오탐 방지).
 */
import { STEM_TAIL_BOUNDARY } from './compoundPatternCommon.js';
import {
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  getBonBojoGroups,
  isBonBojoGateOnlyItem,
  isBonBojoLogicOnlyItem,
} from './bonBojoRules.js';
import {
  NON_AEO_ALLOW_GLUE_SURFACES,
  auxOnsetsForItem,
} from './auxiliaryNonAeoSpace.js';
import {
  NON_AEO_ENDINGS,
  classifyConnectiveBeforeAux,
} from './auxiliaryConnective.js';
import { auxiliaryBaseForm } from './auxiliaryDictSolid.js';
import {
  ensureStdictVerbFormsLoaded,
  resolveSpaceRequiredLemma,
  stdictVerbFormsLemmaCount,
} from './stdictVerbForms.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { warmAuxiliaryMorphCache } from './auxiliaryMorphFilter.js';

export const NON_AEO_AUX_SPACING_LABEL = '본용언+보조용언(-아/-어 아닌 경우)';
export const NON_AEO_AUX_SPACING_TIP =
  '한글 맞춤법 제47항: 보조용언은 본용언이 -아/-어일 때만 붙여 쓸 수 있습니다. ' +
  '-지·-고·-게·-도록·-다(가)·-(으)러·-(으)라 뒤의 보조용언은 띄어 씁니다(먹지 마, 먹다 보니).';

/**
 * '-다' + '가…'는 연결어미 -다가(먹다가·놀다간)와 겹친다. 보조 가다로 보지 않는다.
 * '놀다갔다'처럼 '가' 뒤에 다른 어미가 붙은 것만 후보로 둔다.
 * @type {ReadonlySet<string>}
 */
const DA_GA_CONNECTIVE_TAILS = new Set(['가', '가는', '간', '가도', '가요']);

const HANGUL_RUN = /[\uAC00-\uD7A3]+/g;
const LATIN_DIGIT = /[A-Za-z0-9]/;

/** @type {{ onset: string, itemId: string }[] | null} */
let onsetIndexCache = null;

/** 테스트·시트 교체 후 */
export function clearNonAeoAuxSpacingCache() {
  onsetIndexCache = null;
}

/**
 * 시트의 보조용언 항목(게이트·로직 전용·3음절 칸 제외) onset → itemId. 긴 onset 우선.
 * 같은 onset이 두 항목에 있으면 먼저 나온 항목을 쓴다(기본형은 사전 질의에만 쓰임).
 */
export function listNonAeoAuxOnsets() {
  if (onsetIndexCache) return onsetIndexCache;
  /** @type {Map<string, string>} */
  const byOnset = new Map();
  for (const group of getBonBojoGroups()) {
    for (const item of group.items ?? []) {
      const id = String(item?.id ?? '').trim();
      if (
        !id ||
        isBonBojoGateOnlyItem(id) ||
        isBonBojoLogicOnlyItem(id) ||
        id === BON_BOJO_LONG_COMPOUND_SPLIT_ID
      ) {
        continue;
      }
      for (const onset of auxOnsetsForItem(id)) {
        if (onset && !byOnset.has(onset)) byOnset.set(onset, id);
      }
    }
  }
  onsetIndexCache = [...byOnset.entries()]
    .map(([onset, itemId]) => ({ onset, itemId }))
    .sort(
      (a, b) =>
        b.onset.length - a.onset.length || a.onset.localeCompare(b.onset, 'ko'),
    );
  return onsetIndexCache;
}

/**
 * 본용언 어절이 명시적 비아/어 연결어미로 끝나는가.
 * `classifyConnectiveBeforeAux`가 non-aeo여도 연결어미 꼴이 없으면(학교·사고) 후보가 아니다.
 * @param {string} head
 */
export function hasExplicitNonAeoConnective(head) {
  const h = String(head ?? '');
  if (h.length < 2) return false;
  if (classifyConnectiveBeforeAux(h) !== 'non-aeo') return false;
  if (h.endsWith('라') || h.endsWith('러')) return true;
  return NON_AEO_ENDINGS.some((ending) => h.endsWith(ending));
}

/** @param {string} surface */
function isAllowGlueSurface(surface) {
  return NON_AEO_ALLOW_GLUE_SURFACES.some((key) => surface.includes(key));
}

/**
 * @param {string} text
 * @param {number} end
 */
function isTailBoundary(text, end) {
  const re = new RegExp(STEM_TAIL_BOUNDARY, 'y');
  re.lastIndex = end;
  return re.test(text);
}

/**
 * 형태소 확인 — 본용언 어미(E*)가 head 끝에서 끝나고, 그 자리에서 용언(VV/VX)이 시작해야 한다.
 * 먹지가(지/EC 가/JX)·바다보다(보다/JKB)·했다나(다나/EF)·다가가다(다가가/VV) 같은 것은 떨어진다.
 * 분석이 없으면 false(fail-closed, 본조 `pruneAuxiliaryFalseMorph`와 같음).
 * @param {{ tokens?: { str?: string, tag?: string, position?: number, length?: number }[] } | null | undefined} analyzed
 * @param {number} headLength
 */
export function isConfirmedNonAeoAuxMorph(analyzed, headLength) {
  const tokens = analyzed?.tokens ?? [];
  if (!tokens.length) return false;
  let endingEndsAtHead = false;
  for (const t of tokens) {
    const tag = String(t?.tag ?? '');
    const pos = Number(t?.position);
    const len = Number(t?.length);
    if (!Number.isFinite(pos)) continue;
    if (tag.startsWith('E') && pos + (Number.isFinite(len) ? len : 0) === headLength) {
      endingEndsAtHead = true;
      continue;
    }
    if (pos === headLength && endingEndsAtHead) {
      const base = tag.split('-')[0];
      if (base === 'VV' || base === 'VX') return true;
    }
  }
  return false;
}

/**
 * 붙여 쓴 비아/어 + 보조용언 후보(형태소·사전 확인 전).
 * 한 어절에서 여러 자리가 걸리면 긴 본용언부터 둔다(먹다가보니 → 먹다가|보니 먼저).
 * @param {string} text
 * @returns {{ index: number, end: number, matchedText: string, suggestedText: string, head: string, itemId: string }[]}
 */
export function collectNonAeoAuxCandidates(text) {
  const t = String(text ?? '');
  /** @type {{ index: number, end: number, matchedText: string, suggestedText: string, head: string, itemId: string }[]} */
  const out = [];
  if (!t) return out;
  const onsets = listNonAeoAuxOnsets();
  if (!onsets.length) return out;

  HANGUL_RUN.lastIndex = 0;
  let m;
  while ((m = HANGUL_RUN.exec(t)) !== null) {
    const word = m[0];
    const start = m.index;
    const end = start + word.length;
    if (word.length < 3) continue;
    if (start > 0 && LATIN_DIGIT.test(t[start - 1])) continue;
    if (!isTailBoundary(t, end)) continue;
    if (isAllowGlueSurface(word)) continue;

    for (let cut = word.length - 1; cut >= 2; cut -= 1) {
      const head = word.slice(0, cut);
      const tail = word.slice(cut);
      if (!hasExplicitNonAeoConnective(head)) continue;
      const hit = onsets.find(({ onset }) => tail.startsWith(onset));
      if (!hit) continue;
      if (head.endsWith('다') && DA_GA_CONNECTIVE_TAILS.has(tail)) continue;
      out.push({
        index: start,
        end,
        matchedText: word,
        suggestedText: `${head} ${tail}`,
        head,
        itemId: hit.itemId,
      });
    }
  }
  return out;
}

/**
 * 붙인 전체가 사전 한 단어인가(본조 `reclassifyNonAeoAuxInstances`와 같은 질의).
 * @param {string} head
 * @param {string} itemId
 * @param {string} surface
 */
export function isNonAeoAuxDictionaryWord(head, itemId, surface) {
  const aux = auxiliaryBaseForm(itemId);
  const lemma = head && aux ? `${head}${aux}` : '';
  return Boolean(resolveSpaceRequiredLemma(lemma, surface));
}

/**
 * @param {string} text
 * @param {{
 *   analyze?: (text: string) => ({ tokens?: { str?: string, tag?: string, position?: number, length?: number }[] } | null),
 *   requireDictionary?: boolean,
 * }} [opts]
 * @returns {{ index: number, matchedText: string, suggestedText: string }[]}
 */
export function findNonAeoAuxSpacingHits(text, opts = {}) {
  // 사전 추출본이 없으면 내다보다 같은 한 단어를 잘못 띄우라고 할 수 있어 내지 않는다.
  if (opts.requireDictionary !== false && stdictVerbFormsLemmaCount() === 0) {
    return [];
  }
  const analyze = opts.analyze ?? analyzeLine;
  /** @type {{ index: number, matchedText: string, suggestedText: string }[]} */
  const hits = [];
  /** @type {Set<number>} */
  const doneWords = new Set();
  for (const c of collectNonAeoAuxCandidates(text)) {
    if (doneWords.has(c.index)) continue;
    if (isNonAeoAuxDictionaryWord(c.head, c.itemId, c.matchedText)) {
      // 사전 한 단어면 어절 전체를 건너뛴다(본조 탭 solid 처리가 맡음).
      doneWords.add(c.index);
      continue;
    }
    let analyzed = null;
    try {
      analyzed = analyze(c.matchedText);
    } catch {
      analyzed = null;
    }
    if (!isConfirmedNonAeoAuxMorph(analyzed, c.head.length)) continue;
    doneWords.add(c.index);
    hits.push({
      index: c.index,
      matchedText: c.matchedText,
      suggestedText: c.suggestedText,
    });
  }
  return hits;
}

/**
 * 맞춤법 검사 전에 사전 추출본·형태소 캐시를 채운다. 실패해도 throw하지 않는다.
 * @param {readonly { text?: string }[]} pageTexts
 * @param {{
 *   bootKiwi?: () => Promise<unknown>,
 *   fetchImpl?: typeof fetch,
 *   morphPrefetchMaxMs?: number,
 * }} [opts]
 */
export async function prepareNonAeoAuxSpacing(pageTexts, opts = {}) {
  try {
    await ensureStdictVerbFormsLoaded({ fetchImpl: opts.fetchImpl });
  } catch {
    /* findHits가 빈 결과로 처리 */
  }
  try {
    if (opts.bootKiwi) await opts.bootKiwi();
  } catch {
    /* 서버 prefetch로 */
  }
  try {
    const instances = [];
    for (const page of pageTexts ?? []) {
      for (const c of collectNonAeoAuxCandidates(String(page?.text ?? ''))) {
        instances.push({ matchedText: c.matchedText });
      }
    }
    if (instances.length) {
      await warmAuxiliaryMorphCache(
        [{ patternKind: 'auxiliary-verb', instances }],
        { morphPrefetchMaxMs: opts.morphPrefetchMaxMs },
      );
    }
  } catch {
    /* fail-closed */
  }
}
