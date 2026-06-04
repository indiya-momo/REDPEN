import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { getWorkGuideChainState } from '../lib/workGuideChainState.js';
import {
  clearAllWorkGuideDismissals,
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

  /** 이 화면에 들어올 때마다 1번부터 말풍선 재표시 (일단 임시 동작) */
  useLayoutEffect(() => {
    clearAllWorkGuideDismissals(uid);
    setRev((n) => n + 1);
  }, [uid]);

  const storageKey = useCallback(
    (key) => workGuideStorageKey(uid, key),
    [uid],
  );

  const dismiss = useCallback(
    (key) => {
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

  return {
    storageKey,
    dismiss,
    ...chain,
  };
}
