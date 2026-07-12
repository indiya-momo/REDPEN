/**
 * 국립국어원 외래어 표기법 — 표 1 "국제 음성 기호와 한글 대조표" (영어 표기용 부분)
 * 출처: 문화체육관광부 고시 제2017-14호(2017.3.28.) 원문에서 추출.
 *
 * 조판에 비유하면 이 파일은 "활자 견본집"이다.
 * 어떤 발음 기호가 어떤 한글 활자로 바뀌는지의 원본 데이터만 담고,
 * 실제 조판 규칙(언제 받침으로, 언제 '으'를 붙여 적는지)은
 * transcriptionRules.js가 담당한다.
 */

/**
 * 자음 대조표.
 * onset: 모음 앞에 올 때의 자모(초성)
 * coda:  받침으로 적을 때의 자모(종성) — 규정상 받침 표기가 있는 자음만
 * alone: 자음 앞·어말에서 '으'를 붙여 적는 음절
 */
export const CONSONANTS = {
  p: { onset: 'ㅍ', coda: 'ㅂ', alone: '프' },
  b: { onset: 'ㅂ', alone: '브' },
  t: { onset: 'ㅌ', coda: 'ㅅ', alone: '트' },
  d: { onset: 'ㄷ', alone: '드' },
  k: { onset: 'ㅋ', coda: 'ㄱ', alone: '크' },
  g: { onset: 'ㄱ', alone: '그' },
  f: { onset: 'ㅍ', alone: '프' },
  v: { onset: 'ㅂ', alone: '브' },
  θ: { onset: 'ㅅ', alone: '스' },
  ð: { onset: 'ㄷ', alone: '드' },
  s: { onset: 'ㅅ', alone: '스' },
  z: { onset: 'ㅈ', alone: '즈' },
  ʃ: { onset: 'ㅅ', alone: '슈' }, // 세부 규칙은 제3항 2 (transcriptionRules에서 처리)
  ʒ: { onset: 'ㅈ', alone: '지' },
  ʦ: { onset: 'ㅊ', alone: '츠' },
  ʣ: { onset: 'ㅈ', alone: '즈' },
  ʧ: { onset: 'ㅊ', alone: '치' },
  ʤ: { onset: 'ㅈ', alone: '지' },
  m: { onset: 'ㅁ', coda: 'ㅁ' },
  n: { onset: 'ㄴ', coda: 'ㄴ' },
  ŋ: { coda: 'ㅇ' },
  l: { onset: 'ㄹ', coda: 'ㄹ' },
  r: { onset: 'ㄹ', alone: '르' },
  h: { onset: 'ㅎ', alone: '흐' },
};

/** 모음 대조표: IPA → 한글 중성 자모 */
export const VOWELS = {
  i: 'ㅣ',
  e: 'ㅔ',
  ɛ: 'ㅔ',
  æ: 'ㅐ',
  a: 'ㅏ',
  ɑ: 'ㅏ',
  ʌ: 'ㅓ',
  ɔ: 'ㅗ',
  o: 'ㅗ',
  u: 'ㅜ',
  ə: 'ㅓ',
};

/**
 * 제3장 제1절 제3항 2 — 모음 앞 [ʃ]: 샤·섀·셔·셰·쇼·슈·시
 * (초성 ㅅ에 결합할 중성 자모로 표현)
 */
export const SH_MEDIAL = {
  a: 'ㅑ',
  ɑ: 'ㅑ',
  æ: 'ㅒ',
  ə: 'ㅕ',
  ʌ: 'ㅕ',
  e: 'ㅖ',
  ɛ: 'ㅖ',
  ɔ: 'ㅛ',
  o: 'ㅛ',
  u: 'ㅠ',
  i: 'ㅣ',
};

/** 제9항 1 — [w] + 모음: 워·와·왜·웨·위·우 (중성 자모) */
export const W_MEDIAL = {
  ə: 'ㅝ',
  ʌ: 'ㅝ',
  ɔ: 'ㅝ',
  o: 'ㅝ',
  ɑ: 'ㅘ',
  a: 'ㅘ',
  æ: 'ㅙ',
  e: 'ㅞ',
  ɛ: 'ㅞ',
  i: 'ㅟ',
  u: 'ㅜ',
};

/** 제9항 3 — [j] + 모음: 야·얘·여·예·요·유·이 (중성 자모) */
export const J_MEDIAL = {
  a: 'ㅑ',
  ɑ: 'ㅑ',
  æ: 'ㅒ',
  ə: 'ㅕ',
  ʌ: 'ㅕ',
  e: 'ㅖ',
  ɛ: 'ㅖ',
  ɔ: 'ㅛ',
  o: 'ㅛ',
  u: 'ㅠ',
  i: 'ㅣ',
};

/** 이중모음의 첫 요소 (제8항: 각 단모음의 음가를 살려서 적는다) */
export const DIPH_FIRST = {
  ai: 'a',
  au: 'a',
  ei: 'e',
  ɔi: 'ɔ',
  ou: 'ou', // [ou]는 '오' 단독 표기
  auə: 'a',
};

/** 이중모음의 나머지 요소를 적는 음절(들) */
export const DIPH_REST = {
  ai: '이',
  au: '우',
  ei: '이',
  ɔi: '이',
  ou: '',
  auə: '워', // [auə]는 '아워'
};
