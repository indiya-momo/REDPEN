/**
 * eSpeak-NG 발음 추정기 (인프라 계층).
 *
 * 발음 사전(CMU)에 없는 단어의 발음을 eSpeak-NG(오픈소스 음성합성 엔진,
 * WASM 빌드, 영국식 en-gb)로 추정한다. 자체 철자 규칙(graphemeToArpabet)보다
 * 정확도가 높다 (용례집 미등재 벤치마크 34.5% → 49.9%).
 *
 * WASM(약 18MB)은 앱 자산으로 함께 배포되며:
 *  - preloadEspeak(): 앱이 뜬 뒤 유휴 시간에 미리 내려받아 캐싱
 *  - 로드 실패(오프라인 첫 방문 등) 시 null을 반환 → 호출부가
 *    자체 철자 추정으로 폴백한다 (기능은 항상 동작)
 */

import wasmUrl from 'espeak-ng/dist/espeak-ng.wasm?url';

let modulePromise = null;

function loadFactory() {
  if (!modulePromise) {
    modulePromise = import('espeak-ng')
      .then((mod) => mod.default ?? mod)
      .catch(() => null);
  }
  return modulePromise;
}

/** 앱 초기 화면을 그린 뒤 백그라운드에서 미리 받아 둔다 (실패해도 무해) */
export function preloadEspeak() {
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 2000));
  idle(() => {
    loadFactory();
    // wasm 본체도 미리 받아 브라우저 캐시에 올려 둔다
    fetch(wasmUrl).catch(() => {});
  });
}

/**
 * 영어 단어 → IPA 발음 추정 (영국식).
 * @param {string} word
 * @returns {Promise<string|null>} IPA 문자열, 실패 시 null
 */
export async function espeakToIpa(word) {
  const factory = await loadFactory();
  if (!factory) return null;
  try {
    const espeak = await factory({
      arguments: ['--phonout', 'out.txt', '--sep=', '-q', '-b=1', '--ipa', '-v', 'en-gb', String(word)],
      locateFile: (file) => (file.endsWith('.wasm') ? wasmUrl : file),
    });
    const out = espeak.FS.readFile('out.txt', { encoding: 'utf8' }).trim();
    return out || null;
  } catch {
    return null;
  }
}
