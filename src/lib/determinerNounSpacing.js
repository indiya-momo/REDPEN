/**
 * 한글 맞춤법 제2항 — 관형사(이·그·저) + 체언 붙임 오용.
 * 게이트 C: 표준국어대사전 bareKey 등재면 제외 + 수작업 except 보강.
 * 조사를 뗀 전체 어절이 표제어이면 미매칭. 나머지(체언)가 명사 표제어일 때만 제안.
 * ruleEngine 비부착. findHits는 동기 — 검수 전 ensureStdictPosIndexLoaded 필요.
 */

import { hangulOnlyKey } from './unifyStdictPos.js';
import {
  lookupStdictPosHits,
  stdictPosIndexBareKeyCount,
  stdictPosIndexLoadError,
} from './stdictPosIndex.js';

export const DETERMINER_NOUN_CATEGORY = '관형사+체언';
export const DETERMINER_NOUN_LABEL = '관형사+체언';
export const DETERMINER_NOUN_TIP =
  '「한글 맞춤법」 제2항: 관형사(이·그·저)와 체언은 띄어 씀';

const DET = new Set(['그', '이', '저']);

/** 수작업 except — 사전 구멍·외래 두음 보강 (전체 어절 또는 어간) */
export const DETERMINER_NOUN_EXCEPT = new Set([
  '그것',
  '이것',
  '저것',
  '그이',
  '그날',
  '이날',
  '그때',
  '이곳',
  '그곳',
  '저곳',
  '이번',
  '저번',
  '이분',
  '그분',
  '이쪽',
  '그쪽',
  '저쪽',
  '그대로',
  '그러나',
  '그리고',
  '그래서',
  '그렇지만',
  '그런데',
  '그러므로',
  '그뿐',
  '이뿐',
  '이후',
  '이상',
  '이하',
  '이내',
  '이외',
  '이중',
  '그중',
  '이불',
  '그림',
  '이메일',
  '그랜드',
  '그룹',
  '그리스',
  '그늘',
  '이슬',
  '이력',
  '이름',
  '이야기',
  '이론',
  '이념',
  '이익',
  '이전',
  '이제',
  '이미',
  '이런',
  '이런저런',
  '그런',
  '저런',
  '그저',
  '그만',
  '그만큼',
  '이만큼',
  '저만큼',
]);

const JOSA_ALT =
  '을|를|이|가|은|는|의|에|도|만|와|과|로|으로|부터|까지|이나|나|란|랑|께|께서|한테|더러';

/**
 * @param {string} token
 * @returns {string}
 */
export function stripTrailingJosaHeuristic(token) {
  const t = String(token ?? '');
  const m = t.match(new RegExp(`^(.*)(${JOSA_ALT})$`));
  if (!m || !m[1]) return t;
  // 한 음절만 남으면 조사로 보지 않음 (가/이 체언 등)
  if ([...m[1]].length < 1) return t;
  return m[1];
}

/**
 * @param {import('./stdictPosIndex.js').StdictPosHit[]} hits
 */
function hasNounPos(hits) {
  return (hits ?? []).some((h) => {
    const p = String(h?.pos ?? '');
    return p === '명사' || p.startsWith('명사');
  });
}

/**
 * @param {string} surface hangul-only
 */
function isListedLemma(surface) {
  const key = hangulOnlyKey(surface);
  if (!key) return false;
  if (DETERMINER_NOUN_EXCEPT.has(key)) return true;
  return lookupStdictPosHits(key).length > 0;
}

/**
 * @returns {{ ready: boolean, error: string | null }}
 */
export function determinerNounIndexStatus() {
  const error = stdictPosIndexLoadError();
  const count = stdictPosIndexBareKeyCount();
  return { ready: count > 0 && !error, error };
}

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string, kind: string }[]}
 */
export function findDeterminerNounSpacingHits(text) {
  if (!text) return [];
  const { ready } = determinerNounIndexStatus();
  // 사전 미로드·실패 시 열린 스캔은 하지 않음(오탐 방지). 닫힌 표면은 별도 모듈.
  if (!ready) return [];

  /** @type {{ index: number, matchedText: string, suggestedText: string, kind: string }[]} */
  const hits = [];
  const re = /(?<![\uAC00-\uD7A3])(그|이|저)([\uAC00-\uD7A3]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const det = m[1];
    const rest = m[2];
    if (!DET.has(det) || !rest) continue;
    const matchedText = m[0];
    const wholeStem = stripTrailingJosaHeuristic(matchedText);
    if (isListedLemma(matchedText) || isListedLemma(wholeStem)) continue;

    const restStem = stripTrailingJosaHeuristic(rest);
    if (!restStem || restStem.length < 1) continue;
    if (!hasNounPos(lookupStdictPosHits(hangulOnlyKey(restStem)))) continue;

    hits.push({
      index: m.index,
      matchedText,
      suggestedText: `${det} ${rest}`,
      kind: 'determiner-split',
    });
  }
  return hits;
}
