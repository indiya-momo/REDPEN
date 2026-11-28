/**
 * 편집자 검토 설명 링크 — 설계안 §12.
 * 항목 이름의 품사와 사전 품사를 맞춰 해당 표제어로 직결한다.
 * 글자 검색으로 대신하지 않는다. (사전 JSON 2026-11-06)
 */

/**
 * 수동 지정에서 번호 대신 쓰는 표시: 이 자리는 표준국어대사전 검색 화면으로 보낸다.
 * 번호를 정하지 못한 말에만 쓴다(2026-11-28 모모집사 지시: 「부치다」).
 */
export const CAUTION_SEARCH = 'search';

/** §12-3 자동 판정: 품사가 하나로 정해진 항 */
export const CAUTION_POS_WORD_NO = {
  대로: { 조사: 78254, 의존명사: 411247 },
  뿐: { 조사: 156866, 의존명사: 443239 },
  만큼: { 조사: 423733, 의존명사: 423733 },
  같이: { 조사: 389853, 부사: 389853 },
  투성이: { 접미사: 343647, 접사: 343647 },
  가지: { 단위명사: 6053, 의존명사: 6053 },
  같은: { 형용사: 391368 },
  것: { 의존명사: 390852 },
};

/**
 * §12-4 수동 지정표 — 자동 판정보다 먼저 쓴다. { item_id: { "설명 속 자리": target_code } }
 * 수동 지정이 있는 항목은 자동 판정을 쓰지 않는다.
 * (가량·쯤은 「접사」 자리에 달지 않고, 설명 속 따옴표 단어 자리에 각각 단다.)
 */
export const CAUTION_MANUAL_WORD_NO = {
  'uinoun-jungdo': { 명사: 479967 },
  'noun-ttae': { 명사: 98401 },
  'jubsa-garyang': { 가량: 387733, 쯤: 321212 },
  'josa-attach-keonyeong': { 보조사: 490407 },
  'josa-attach-bakke': { 보조사: 131192 },
  // §12-10 견본(§12-10-4, 2026-11-27 22:04 결정): 제목과 같은 말이라도 설명에서 처음 나온 자리에 단다.
  'bon-bojo-jalhada': { 잘하다: 475843 },
  'bon-bojo-anda': { '좋게 이루어지지 않다': 219149, '사람이 보기에 가엾다': 222730 },
  'verb-verbi-but': {
    붙이다: 153137,
    부치다: CAUTION_SEARCH,
  },
  // §12-10-2 A·B·C 표 전체(견본 승인 2026-11-27 22:08). 자리 글자는 설명에 적힌 그대로.
  'bon-bojo-eojuda': { 들어주다: 93665 },
  'bon-bojo-gui': { 귀신같다: 42639 },
  'bon-bojo-gigak': { '지각(知覺)없다': 481703 },
  'bon-bojo-meokgo': { 먹고살다: 424129 },
  'eogan-eomi-motd': { 못되다: 423052 },
  'eogan-eomi-mot': { 못하다: 423255 },
  'eogan-eomi-aniyo': { 아니요: 450458, 아니다: 453924, '-오': 241321 },
  'eogan-eomi-doei': { '되-': 90723, '-어': 460564 },
  'noun-noun-angae': { 안갯속: 516469 },
  'noun-noun-gaseum': { 가슴속: 393166 },
  'noun-noun-han': { 한번: 508814 },
  'noun-noun-daum': { 다음날: 74584 },
  'noun-noun-kun': { 큰일: 346354 },
  'noun-noun-kunjip': { 큰집: 334237 },
  'noun-noun-kunso': { 큰소리: 496819 },
  'noun-noun-gyuljae': { '결제(決濟)': 393560, '결재(決裁)': 17721 },
  'noun-noun-gubun': { '구별(區別)': 402573, '구분(區分)': 38408 },
  'noun-noun-gyuldan': { 결단: 392260, 결딴: 19615 },
  'noun-noun-jugi': { 주기周忌: 303084, 주년周年: 309798 },
  'noun-noun-jihy': { '지향(志向)': 314518, '지양(止揚)': 488772 },
  'noun-noun-gae': { '개량(改良)': 10946, '계량(計量)': 16044 },
  'noun-noun-sil': { '실재(實在)': 210258, '실제(實際)': 452498 },
  'noun-noun-ei': { '이의(異議)': 468942, '의의(意義)': 270759 },
  'noun-noun-chul': { '출연(出演)': 331532, '출현(出現)': 496797 },
  'noun-noun-jung': { '중개(仲介)': 486632, '중계(中繼)': 487284 },
  'verb-verb-daeyo': { 대요: 411447, 데요: 511743 },
  'verb-verb-geureoda': { 그러다: 403698, 그리하다: 43472, 그렇다: 401594, 그러하다: 400579 },
  'verb-verb-neal': { 늘이다: 410213, 늘리다: 69749 },
  'verb-verbi-mat': { 맞추다: 112735, 맞히다: 111420 },
  'verb-verb-bara': { 바라다: 428737, 바람: 134732, 색: 428753, 배웅: 133353 },
  'verb-verb-bbaetda': { 뺏다: 441495, 빼앗다: 435776, 빼었다: 441769 },
  'verb-verb-yalda': { 얇다: 457976, 가늘다: 386315 },
  'bon-bojo-notaboda': { 놓아주다: 68231 },
  'bon-bojo-chataboda': { 찾아보다: 321387 },
  'noun-noun-bae': { 뱃속: 431175 },
  'eogan-eomi-eumeuro': { '(-으)므로': 470520, '(-으)로서': 265140, '(-으)로써': 263789 },
  // 「-든지」는 글자 하나에 번호가 둘: 설명의 「조사」→94197, 「-든지」→417515.
  'eomi-eomi-deongi': {
    '-더라': 412877,
    '-던': 416298,
    '-던지': 83003,
    조사: 94197,
    '-든지': 417515,
  },
  'noun-noun-gue': { '개발(開發)': 10324, '계발(啓發)': 392447 },
};

/** @param {string} pos */
export function normalizeCautionPos(pos) {
  return String(pos ?? '').replace(/\s+/g, '');
}

/**
 * @param {string} headword
 * @param {string} pos
 * @returns {number | null}
 */
export function cautionPosWordNo(headword, pos) {
  const table = CAUTION_POS_WORD_NO[String(headword ?? '').trim()];
  if (!table) return null;
  const n = table[normalizeCautionPos(pos)];
  return Number.isFinite(n) ? n : null;
}

/** @param {string | undefined} itemId */
export function cautionManualPlaces(itemId) {
  const table = CAUTION_MANUAL_WORD_NO[String(itemId ?? '').trim()];
  return table ? Object.entries(table) : [];
}

/**
 * @param {{ text?: string, lookup?: string, pos?: string, wordNo?: number }} spec
 * @returns {number | null}
 */
export function resolveCautionTipWordNo(spec) {
  if (!spec) return null;
  if (Number.isFinite(spec.wordNo)) return /** @type {number} */ (spec.wordNo);
  if (!spec.pos) return null;
  return cautionPosWordNo(spec.lookup, spec.pos);
}
