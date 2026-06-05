import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  devWorkGuideStepFromChain,
  getWorkGuideChainState,
} from '../lib/workGuideChainState.js';
import {
  isWorkGuidePinned,
  setDevWorkGuideForceStep,
  workGuideStorageKey,
} from '../lib/workGuideKeys.js';
import { syncWorkGuideOnAuthChange } from '../lib/workGuideLoginSession.js';
import { dismissTooltipGuide } from '../lib/tooltipGuideStorage.js';

/**
 * 업로드 이후 **1~7번 말풍선** 체인 (uid별 dismiss, 로그인마다 초기화)
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

  /** auth 구독보다 늦게 마운트될 때 로그인 직후 dismiss 초기화 반영 */
  useEffect(() => {
    if (syncWorkGuideOnAuthChange(uid)) bump();
  }, [uid, bump]);

  const storageKey = useCallback(
    (key) => workGuideStorageKey(uid, key),
    [uid],
  );

  const dismiss = useCallback(
    (key) => {
      if (isWorkGuidePinned()) return;
      dismissTooltipGuide(storageKey(key));
      setDevWorkGuideForceStep(null);
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
    setDevWorkGuideForceStep(step);
  }, [chain]);

  return {
    storageKey,
    dismiss,
    ...chain,
  };
}
