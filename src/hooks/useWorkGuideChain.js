import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  devWorkGuideStepFromChain,
  getWorkGuideChainState,
} from '../lib/workGuideChainState.js';
import {
  clearAllWorkGuideDismissals,
  isWorkGuidePinned,
  setDevWorkGuideForceStep,
  workGuideStorageKey,
} from '../lib/workGuideKeys.js';
import { dismissTooltipGuide } from '../lib/tooltipGuideStorage.js';

/**
 * 업로드 이후 **1~7번 말풍선** 체인 (uid별 dismiss)
 * @param {string} uid
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 * }} ctx
 */
export function useWorkGuideChain(uid, ctx) {
  const { hasPdf, pageTextsReady, workTab, spellingCheckDone } = ctx;
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((n) => n + 1), []);

  /** 작업 화면 진입 시 1번부터 재표시 — 로컬 dev/HMR에서는 초기화하지 않음(말풍선 튜닝 유지) */
  useLayoutEffect(() => {
    if (import.meta.env.DEV) return;
    clearAllWorkGuideDismissals(uid);
    setRev((n) => n + 1);
  }, [uid]);

  const storageKey = useCallback(
    (key) => workGuideStorageKey(uid, key),
    [uid],
  );

  const dismiss = useCallback(
    (key) => {
      if (isWorkGuidePinned()) return;
      dismissTooltipGuide(storageKey(key));
      bump();
    },
    [storageKey, bump],
  );

  const chain = useMemo(
    () =>
      getWorkGuideChainState(
        uid,
        { hasPdf, pageTextsReady, workTab, spellingCheckDone },
        storageKey,
      ),
    [
      uid,
      hasPdf,
      pageTextsReady,
      workTab,
      spellingCheckDone,
      storageKey,
      rev,
    ],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const step = devWorkGuideStepFromChain(chain);
    if (step != null) setDevWorkGuideForceStep(step);
  }, [chain]);

  return {
    storageKey,
    dismiss,
    ...chain,
  };
}
