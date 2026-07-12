/**
 * 외래어 표기 변환 검증.
 *
 * 정답지는 외래어 표기법 고시(문화체육관광부 고시 제2017-14호)
 * 제3장 제1절의 보기 단어들이다. CMU 사전(미국식)의 발음이
 * 고시 보기의 발음(영국식)과 일치하는 단어만 기대값 검증에 넣었고,
 * 발음 자체가 달라 결과가 달라지는 단어는 아래 "예상 편차" 블록에
 * 현재 동작을 문서화해 두었다.
 *
 * 실행 전 필요: npm install (cmu-pronouncing-dictionary)
 */

import { describe, it, expect } from 'vitest';
import { dictionary } from 'cmu-pronouncing-dictionary';
import { convertWord, convertPronunciation } from './convertLoanword.js';

const hangulOf = (word) => {
  const r = convertWord(word, dictionary);
  return r.found ? r.results[0].hangul : '(미등재)';
};

describe('외래어 표기법 제3장 제1절 — 고시 보기 단어', () => {
  const cases = [
    // 제1항 무성 파열음
    ['gap', '갭'], ['cat', '캣'], ['book', '북'],
    ['apt', '앱트'], ['setback', '셋백'], ['act', '액트'],
    ['stamp', '스탬프'], ['cape', '케이프'], ['nest', '네스트'], ['part', '파트'],
    ['desk', '데스크'], ['make', '메이크'], ['apple', '애플'],
    ['chipmunk', '치프멍크'],
    // 제2항 유성 파열음
    ['bulb', '벌브'], ['land', '랜드'], ['zigzag', '지그재그'],
    ['kidnap', '키드냅'], ['signal', '시그널'],
    // 제3항 마찰음
    ['jazz', '재즈'], ['graph', '그래프'], ['thrill', '스릴'], ['bathe', '베이드'],
    ['flash', '플래시'], ['shrub', '슈러브'], ['shark', '샤크'], ['shank', '섕크'],
    ['fashion', '패션'], ['shoe', '슈'], ['shim', '심'], ['vision', '비전'],
    ['shopping', '쇼핑'], // 철자 참고 조정(o)으로 고시 보기와 일치
    // 제4항 파찰음
    ['keats', '키츠'], ['odds', '오즈'], ['switch', '스위치'], ['bridge', '브리지'],
    ['pittsburgh', '피츠버그'], ['hitchhike', '히치하이크'], ['chart', '차트'],
    // 제5항 비음
    ['steam', '스팀'], ['corn', '콘'], ['ring', '링'], ['lamp', '램프'],
    ['hint', '힌트'], ['ink', '잉크'], ['hanging', '행잉'], ['longing', '롱잉'],
    // 제6항 유음
    ['hotel', '호텔'], ['pulp', '펄프'], ['slide', '슬라이드'],
    ['film', '필름'], ['helm', '헬름'], ['henley', '헨리'],
    // 제7항 장모음
    ['team', '팀'], ['route', '루트'],
    // 제8항 중모음
    ['time', '타임'], ['house', '하우스'], ['skate', '스케이트'],
    ['oil', '오일'], ['boat', '보트'], ['tower', '타워'],
    // 제9항 반모음
    ['word', '워드'], ['woe', '워'], ['wander', '완더'], ['wag', '왜그'],
    ['west', '웨스트'], ['witch', '위치'], ['wool', '울'],
    ['swing', '스윙'], ['twist', '트위스트'], ['quarter', '쿼터'],
    ['yard', '야드'], ['yank', '얭크'], ['yearn', '연'], ['yellow', '옐로'],
    ['yawn', '욘'], ['you', '유'], ['year', '이어'],
    ['indian', '인디언'], ['battalion', '버탤리언'], ['union', '유니언'],
  ];

  it.each(cases)('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });
});

describe('예상 편차 — CMU(미국식) 발음이 고시 보기(영국식)와 다른 경우 (정책: 규정 적용 결과 그대로 노출)', () => {
  it.each([
    ['sickness', '시크너스'], // 보기: 시크니스 [siknis] — CMU는 N AH0 S ([ə])
  ])('%s → %s (현재 동작 문서화)', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });
});

describe('철자 참고 조정 — 구글 시트 외래어 목록 대조로 추가 (철자 o→[ɔ], 철자 ar→[æ])', () => {
  it.each([
    ['donald', '도널드'],
    ['jonathan', '조너선'],
    ['thomas', '토머스'],
    ['john', '존'],
    ['scott', '스콧'],
    ['body', '보디'],
    ['complex', '콤플렉스'],
    ['contents', '콘텐츠'],
    ['caroline', '캐럴라인'],
    ['parallel', '패럴렐'],
    ['narration', '내레이션'],
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });
});

describe('인명 — 규정 그대로 적용 (관용 표기와 다를 수 있음)', () => {
  it('복수 발음이 있으면 모두 반환한다 (aaronson)', () => {
    const r = convertWord('aaronson', dictionary);
    expect(r.results.length).toBe(2);
    expect(r.results.map((x) => x.hangul)).toEqual(['애런선', '아런선']);
  });

  it.each([
    ['williams', '윌리엄즈'], // 관용: 윌리엄스 (어말 z는 규정상 '즈')
    ['jones', '존즈'], // 관용: 존스
    ['owings', '오잉즈'],
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });

  it('사전에 없는 단어는 found=false', () => {
    const r = convertWord('zzzznotaword', dictionary);
    expect(r.found).toBe(false);
  });
});

describe('정규화 회귀 — 구글 시트 외래어 목록 테스트에서 발견된 버그', () => {
  it.each([
    ['mystery', '미스터리'], // ER 뒤 모음이 오면 r을 복원 (미스터이 ✗)
    ['margaret', '마거릿'],
    ['rachel', '레이철'], // ʧ 뒤 음절성 l의 [ə]는 유지 (레이칠 ✗)
    ['special', '스페셜'], // ʃ 뒤도 동일 (스페슐 ✗)
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });
});

describe('근거(trace) 표시', () => {
  it('gap의 어말 p에는 제1항 1이 적용된다', () => {
    const r = convertPronunciation('G AE1 P');
    expect(r.hangul).toBe('갭');
    const pRule = r.trace.find((e) => e.ph === '[p]');
    expect(pRule.rule.id).toBe('제1항 1');
  });

  it('quarter에는 제9항 2([kw] 한 음절)가 적용된다', () => {
    const r = convertPronunciation('K W AO1 R T ER0');
    expect(r.hangul).toBe('쿼터');
    expect(r.trace.some((e) => e.rule.id === '제9항 2')).toBe(true);
  });
});
