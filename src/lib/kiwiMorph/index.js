/**
 * Kiwi 형태소 경계 센서 — 표기통일 조사 strip 보조 (P1).
 * 규범 엔진·typo 교정 아님. 브라우저 기본 OFF·미로드 시 heuristic.
 *
 * @see project-docs/kiwi-morph-boundary-plan-2026-08-02.md
 *
 * Node 로드: `import { loadKiwiNode } from './kiwiMorph/loadNode.js'`
 */
export {
  getKiwiInstance,
  setKiwiInstance,
  clearKiwiInstance,
  isKiwiReady,
} from './runtime.js';
export { analyzeLine, KIWI_MATCH_ALL } from './analyze.js';
export {
  stripTrailingJosaKiwi,
  stripTrailingJosaFromTokens,
} from './stripTrailingJosa.js';
export { mapRestoredToVisual } from './mapRestoredToVisual.js';
export { KIWI_DEFAULT_USER_WORDS } from './userDict.js';
export {
  isJosaTag,
  isSkippableTrailingTag,
  surfaceMatchesTokens,
  pickPublicTokens,
} from './tokens.js';
