/**
 * CMU 발음 사전 로더 (인프라 계층).
 *
 * 사전 데이터(약 3MB)는 무겁기 때문에 기능을 처음 쓸 때만
 * 동적 import로 불러오고, 이후에는 메모리에 캐싱한다.
 * (초기 화면 로딩 속도에 영향을 주지 않기 위한 지연 로드)
 */

let cached = null;
let loading = null;

/** @returns {Promise<Record<string,string>>} word → ARPABET 발음 */
export async function loadCmuDictionary() {
  if (cached) return cached;
  if (!loading) {
    loading = import('cmu-pronouncing-dictionary').then((mod) => {
      cached = mod.dictionary;
      loading = null;
      return cached;
    });
  }
  return loading;
}
