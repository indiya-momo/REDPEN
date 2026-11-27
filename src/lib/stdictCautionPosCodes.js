/**
 * 편집자 검토 설명 링크 — 설계안 §12.
 * 항목 이름의 품사와 사전 품사를 맞춰 해당 표제어로 직결한다.
 * 글자 검색으로 대신하지 않는다. (사전 JSON 2026-11-06)
 */

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
