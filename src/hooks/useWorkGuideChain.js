import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  devWorkGuideStepFromChain,
  getWorkGuideChainState,
} from '../lib/workGuideChainState.js';
import {
  getDevWorkGuideForceStep,
  isWorkGuidePinned,
  setDevWorkGuideForceStep,
  workGuideStorageKey,
} from '../lib/workGuideKeys.js';
import { syncWorkGuideOnAuthChange } from '../lib/workGuideLoginSession.js';
import { commitWorkGuideOnboardingExposureSlot } from '../lib/workGuideOnboardingExposure.js';
import { dismissTooltipGuide } from '../lib/tooltipGuideStorage.js';

/**
 * 업로드 이후 **1~7번 말풍선** 체인 (uid별 dismiss, 인당 5회·하루 1회 노출)
 * @param {string} uid
 * @param {{
 *   hasPdf: boolean,
 *   pageTextsReady: boolean,
 *   workTab: 'spelling' | 'consistency',
 *   spellingCheckDone: boolean,
 *   consistencyCheckDone?: boolean,
 *   consistencyExportGuideReady?: boolean,
 * }} ctx
 */
export function useWorkGuideChain(uid, ctx) {
  const {
    hasPdf,
    pageTextsReady,
    workTab,
    spellingCheckDone,
    consistencyCheckDone = false,
    consistencyExportGuideReady = true,
  } = ctx;
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((n) => n + 1), []);

  useEffect(() => {
    syncWorkGuideOnAuthChange(uid);
  }, [uid]);

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
        {
          hasPdf,
          pageTextsReady,
          workTab,
          spellingCheckDone,
          consistencyCheckDone,
          consistencyExportGuideReady,
        },
        storageKey,
      ),
    [
      uid,
      hasPdf,
      pageTextsReady,
      workTab,
      spellingCheckDone,
      consistencyCheckDone,
      consistencyExportGuideReady,
      storageKey,
      rev,
    ],
  );

  const openGuideStep = devWorkGuideStepFromChain(chain);

  useEffect(() => {
    if (
      !uid ||
      openGuideStep == null ||
      isWorkGuidePinned() ||
      getDevWorkGuideForceStep() != null
    ) {
      return;
    }
    const result = commitWorkGuideOnboardingExposureSlot(uid);
    if (result.committed) {
      bump();
    }
  }, [uid, openGuideStep, bump]);

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
