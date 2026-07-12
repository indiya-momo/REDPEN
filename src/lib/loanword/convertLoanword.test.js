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
import { convertWord, convertPhrase, convertPronunciation } from './convertLoanword.js';
import { loadYongryeDictionary } from './yongryeDictionary.js';

const yongrye = await loadYongryeDictionary();
const hasYongrye = Object.keys(yongrye).length > 0;

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
    expect(r.results.map((x) => x.hangul)).toEqual(['애런슨', '아런슨']);
  });

  it.each([
    ['williams', '윌리엄즈'], // 관용: 윌리엄스 (어말 z는 규정상 '즈')
    ['jones', '존즈'], // 관용: 존스
    ['owings', '오잉즈'],
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });
});

describe('관용 조정 — 어말 철자 a → 아, 어말 -son → 슨 (용례집 대조로 승인된 범위)', () => {
  it.each([
    ['sofa', '소파'],
    ['dora', '도라'],
    ['saga', '사가'],
    ['obama', '오바마'],
    ['drama', '드라마'],
    ['jefferson', '제퍼슨'],
    ['johnson', '존슨'],
    ['wilson', '윌슨'],
    ['towson', '토슨'],
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });

});

describe('정규화 회귀 — [w] 앞의 r 처리와 [hw] 한 음절 합치기', () => {
  it.each([
    ['barwick', '바윅'], // r이 [w] 앞에서도 자음 앞처럼 탈락
    ['farwell', '파웰'],
    ['fairway', '페어웨이'],
  ])('%s → %s', (word, expected) => {
    expect(hangulOf(word)).toBe(expected);
  });

  it('white의 [hw] 발음은 화이트로 합쳐 적는다 (제9항 2, whistle 휘슬형)', () => {
    const r = convertWord('white', dictionary);
    expect(r.results.map((x) => x.hangul)).toContain('화이트');
  });

  it('whitfield → 휫필드 포함', () => {
    const r = convertWord('whitfield', dictionary);
    expect(r.results.map((x) => x.hangul)).toContain('휫필드');
  });
});

describe('발음 추정(G2P) 폴백 — 사전에 없어도 결과가 반드시 나온다', () => {
  it('사전 미등재 단어도 철자 추정으로 변환된다 (brixworth)', () => {
    const r = convertWord('brixworth', dictionary);
    expect(r.found).toBe(true);
    expect(r.estimated).toBe(true);
    expect(r.results[0].hangul).toBe('브릭스워스');
  });

  it('사전에 있는 단어는 추정 표시가 없다', () => {
    const r = convertWord('towson', dictionary);
    expect(r.found).toBe(true);
    expect(r.estimated).toBe(false);
  });
});

describe('여러 단어 변환 (제10항 2: 띄어 쓴 대로)', () => {
  it('stephen king → 단어별 변환 후 이어 붙임', () => {
    const r = convertPhrase('stephen king', dictionary);
    expect(r.found).toBe(true);
    expect(r.hangul).toBe('스티번 킹');
    expect(r.words.length).toBe(2);
  });

  it('하이픈도 단어 경계로 처리한다', () => {
    const r = convertPhrase('west-york', dictionary);
    expect(r.words.length).toBe(2);
  });
});

describe.skipIf(!hasYongrye)('여러 단어 캐스케이드 — 단어별 용례집 우선 (kings club 사례)', () => {
  it('kings club → 킹스 클럽 (두 단어 모두 용례집 표기 사용)', () => {
    const r = convertPhrase('kings club', dictionary, yongrye);
    expect(r.hangul).toBe('킹스 클럽');
    expect(r.words.map((w) => w.source)).toEqual(['yongrye', 'yongrye']);
  });

  it('stephen king → 스티븐 킹', () => {
    const r = convertPhrase('stephen king', dictionary, yongrye);
    expect(r.hangul).toBe('스티븐 킹');
  });

  it('용례집에 없는 단어만 규정 엔진·추정으로 채운다', () => {
    const r = convertPhrase('brixworth club', dictionary, yongrye);
    expect(r.words[0].source).toBe('g2p');
    expect(r.words[1].source).toBe('yongrye');
    expect(r.hangul).toBe('브릭스워스 클럽');
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
