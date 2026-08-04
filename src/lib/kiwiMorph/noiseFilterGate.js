/**
 * 표기통일 잡음 — 1차 리스트 전용 / 2차는 별도 진입.
 * 찾기 discover에서는 morph 활성 금지 (동기 analyze 무한 로딩 방지).
 */
import { isUnifyKiwiNoiseFilterEnabled } from '../featureFlags.js';
import { getKiwiInstance } from './runtime.js';

/**
 * 동기 analyze가 가능한 로컬 Kiwi 인스턴스.
 * @returns {boolean}
 */
export function isUnifyKiwiLocalAnalyzeReady() {
  try {
    return Boolean(getKiwiInstance()?.ready?.());
  } catch {
    return false;
  }
}

/**
 * 찾기 1차 핫패스용 — 항상 false (리스트만).
 * 2차 후보 필터는 {@link isUnifyKiwiNoisePhase2Available} 사용.
 * @returns {boolean}
 */
export function isUnifyKiwiNoiseMorphActive() {
  return false;
}

/**
 * 2차: NOISE_FILTER ON 이고 로컬 Kiwi가 이미 ready (boot 시도 없음).
 * @returns {boolean}
 */
export function isUnifyKiwiNoisePhase2Available() {
  return isUnifyKiwiNoiseFilterEnabled() && isUnifyKiwiLocalAnalyzeReady();
}

/**
 * @deprecated 찾기 스캔 latch 제거 — 항상 false 반환
 * @param {{ forceInactive?: boolean }} [opts]
 * @returns {boolean}
 */
export function beginUnifyKiwiNoiseMorphScan(opts = {}) {
  void opts;
  return false;
}

/** @deprecated latch 없음 */
export function endUnifyKiwiNoiseMorphScan() {}

/** @deprecated no-op */
export function setUnifyFindSkipMorph(_on) {
  void _on;
}

/** @deprecated */
export function isUnifyFindSkipMorph() {
  return false;
}

/**
 * @returns {{
 *   enabled: boolean,
 *   ready: boolean,
 *   morphMode: 'kiwi-noise' | 'heuristic-fallback' | 'heuristic-baseline',
 *   phase2Available: boolean,
 * }}
 */
export function getUnifyKiwiNoiseFilterStatus() {
  const enabled = isUnifyKiwiNoiseFilterEnabled();
  const ready = isUnifyKiwiLocalAnalyzeReady();
  const phase2Available = enabled && ready;
  /** @type {'kiwi-noise' | 'heuristic-fallback' | 'heuristic-baseline'} */
  let morphMode = 'heuristic-baseline';
  if (enabled) {
    morphMode = phase2Available ? 'kiwi-noise' : 'heuristic-fallback';
  }
  return { enabled, ready, morphMode, phase2Available };
}
