/**
 * 국립국어원 "용례 목록 - 외래어 표기법" 조회 모듈 (인프라 계층).
 *
 * 데이터(yongryeEnglish.json)는 scripts/build-yongrye-data.mjs로
 * 원본 xlsx에서 생성한다. 파일이 자리 표시용 빈 객체({})인 상태라면
 * 조회 결과가 항상 비어 있을 뿐, 앱 동작에는 문제가 없다.
 *
 * 항목 형식: word(소문자) → [{ h: 표기, a?: 이표기[], c?: 구분, m?: 의미 }]
 */

let cached = null;
let loading = null;

/** @returns {Promise<Record<string, Array>>} */
export async function loadYongryeDictionary() {
  if (cached) return cached;
  if (!loading) {
    loading = import('./yongryeEnglish.json').then((mod) => {
      cached = mod.default ?? {};
      loading = null;
      return cached;
    });
  }
  return loading;
}

/**
 * @param {string} word 영어 단어 (여러 단어 지명·복합어도 가능)
 * @param {Record<string, Array>} dictionary
 * @returns {Array<{h:string, a?:string[], c?:string, m?:string}>}
 */
export function lookupYongrye(word, dictionary) {
  const key = String(word).trim().toLowerCase().replace(/\s+/g, ' ');
  return dictionary[key] ?? [];
}
