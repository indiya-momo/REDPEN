/**
 * 표기 통일 「찾기」단계별 소요·결정성 진단.
 * 켜짐: DEV 항상, 또는 localStorage.unifyFindBench === '1'
 *
 * 콘솔: `[unify-find-bench]` + console.table(stages)
 * 확인: `__UNIFY_FIND_BENCH__` → { enabled, snapshot, clearKiwiCache }
 */

import { isSpellingKiwiBoundaryEnabled, isUnifyKiwiJosaEnabled } from './featureFlags.js';
import { getUnifyKiwiNoiseFilterStatus } from './kiwiMorph/noiseFilterGate.js';

export function isUnifyFindBenchEnabled() {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem('unifyFindBench') === '1';
  } catch {
    return false;
  }
}

/**
 * SLM/stdict·Kiwi ready·캐시 — 콜드/웜·설정 차이 가르기용.
 * @returns {Promise<{
 *   kiwiReady: boolean,
 *   kiwiServerMode: boolean,
 *   remoteCacheSize: number,
 *   spellingKiwiBoundary: boolean,
 *   unifyKiwiJosa: boolean,
 *   noiseFilterEnabled: boolean,
 *   morphMode: 'kiwi-noise' | 'heuristic-fallback' | 'heuristic-baseline' | 'kiwi',
 * }>}
 */
export async function snapshotUnifyFindDiag() {
  let kiwiReady = false;
  let kiwiServerMode = false;
  let remoteCacheSize = 0;
  try {
    const { isKiwiReady, isKiwiServerMode } = await import(
      './kiwiMorph/runtime.js'
    );
    kiwiReady = Boolean(isKiwiReady());
    kiwiServerMode = Boolean(isKiwiServerMode());
  } catch {
    /* ignore */
  }
  try {
    const { remoteAnalyzeCacheSize } = await import('./kiwiMorph/remoteCache.js');
    remoteCacheSize = remoteAnalyzeCacheSize();
  } catch {
    /* ignore */
  }
  const noise = getUnifyKiwiNoiseFilterStatus();
  /** @type {'kiwi-noise' | 'heuristic-fallback' | 'heuristic-baseline' | 'kiwi'} */
  let morphMode = noise.morphMode;
  // 잡음 필터 OFF여도 JOSA/BOUNDARY만 켜져 Kiwi를 쓰는 경우
  if (
    morphMode === 'heuristic-baseline' &&
    kiwiReady &&
    (isSpellingKiwiBoundaryEnabled() || isUnifyKiwiJosaEnabled())
  ) {
    morphMode = 'kiwi';
  }
  return {
    kiwiReady,
    kiwiServerMode,
    remoteCacheSize,
    spellingKiwiBoundary: isSpellingKiwiBoundaryEnabled(),
    unifyKiwiJosa: isUnifyKiwiJosaEnabled(),
    noiseFilterEnabled: noise.enabled,
    /** 잡음 morph용 — 로컬 인스턴스 ready (서버 모드만은 false일 수 있음) */
    ready: noise.ready,
    morphMode,
  };
}

async function probe() {
  if (typeof window === 'undefined') return;
  /** @type {Record<string, unknown>} */
  const api = {
    enabled: isUnifyFindBenchEnabled(),
    tip: '찾기 후 [unify-find-bench] done의 kiwiReady·occTotal·slm* 를 비교하세요.',
    snapshot: snapshotUnifyFindDiag,
    async clearKiwiCache() {
      const { clearRemoteAnalyzeCache } = await import(
        './kiwiMorph/remoteCache.js'
      );
      clearRemoteAnalyzeCache();
      return snapshotUnifyFindDiag();
    },
  };
  window.__UNIFY_FIND_BENCH__ = api;
}

void probe();

/**
 * @param {Record<string, unknown>} [meta]
 * @returns {{
 *   mark: (name: string) => void,
 *   done: (extra?: Record<string, unknown>) => void,
 *   armListMemo: () => void,
 *   maybeLogListMemo: (ms: number) => void,
 * }}
 */
export function createUnifyFindBench(meta = {}) {
  if (!isUnifyFindBenchEnabled()) {
    return {
      mark() {},
      done() {},
      armListMemo() {},
      maybeLogListMemo() {},
    };
  }
  const t0 = performance.now();
  let last = t0;
  /** @type {Record<string, number>} */
  const stages = {};
  let listMemoArmed = false;

  console.log('[unify-find-bench] start', meta);

  return {
    mark(name) {
      const now = performance.now();
      stages[name] = Math.round((now - last) * 10) / 10;
      last = now;
    },
    done(extra = {}) {
      stages.totalUntilAlert = Math.round((performance.now() - t0) * 10) / 10;
      console.log('[unify-find-bench] done', { ...meta, ...extra, stages });
      console.table(stages);
    },
    armListMemo() {
      listMemoArmed = true;
    },
    maybeLogListMemo(ms) {
      if (!listMemoArmed) return;
      listMemoArmed = false;
      stages.listMemo_enrich = Math.round(ms * 10) / 10;
      console.log(
        `[unify-find-bench] listMemo.enrich (render): ${stages.listMemo_enrich}ms`,
      );
    },
  };
}
