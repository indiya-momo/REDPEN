import { useCallback, useEffect, useMemo, useState } from 'react';
import { guestBrowseShowsWorkGuideChain } from '../lib/guestBrowsePolicy.js';
import { EMPTY_GUEST_BROWSE_WORK_GUIDE } from '../lib/guestBrowseWorkGuideEmpty.js';
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
 * 둘러보기 전용 작업 말풍선 훅.
 * 일반 로그인 작업에서는 EMPTY만 반환하며 체인·노출·DEV 강제 단계를 돌리지 않는다.
 *
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
export function useGuestBrowseWorkGuide(uid, ctx) {
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
  const guestBrowseActive = guestBrowseShowsWorkGuideChain();

  useEffect(() => {
    if (!guestBrowseActive) return;
    syncWorkGuideOnAuthChange(uid);
  }, [uid, guestBrowseActive]);

  const storageKey = useCallback(
    (key) => workGuideStorageKey(uid, key),
    [uid],
  );

  const dismiss = useCallback(
    (key) => {
      if (!guestBrowseActive) return;
      if (isWorkGuidePinned()) return;
      dismissTooltipGuide(storageKey(key));
      setDevWorkGuideForceStep(null);
      bump();
    },
    [guestBrowseActive, storageKey, bump],
  );

  const chain = useMemo(() => {
    if (!guestBrowseActive) return EMPTY_GUEST_BROWSE_WORK_GUIDE;
    return getWorkGuideChainState(
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
      null,
      { guestBrowseActive: true },
    );
  }, [
    guestBrowseActive,
    uid,
    hasPdf,
    pageTextsReady,
    workTab,
    spellingCheckDone,
    consistencyCheckDone,
    consistencyExportGuideReady,
    storageKey,
    rev,
  ]);

  const openGuideStep = guestBrowseActive
    ? devWorkGuideStepFromChain(chain)
    : null;

  useEffect(() => {
    if (!guestBrowseActive) return;
    if (
      !uid ||
      openGuideStep == null ||
      isWorkGuidePinned() ||
      getDevWorkGuideForceStep() != null
    ) {
      return;
    }
    const result = commitWorkGuideOnboardingExposureSlot(uid);
    if (result.committed) bump();
  }, [guestBrowseActive, uid, openGuideStep, bump]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!guestBrowseActive) {
      setDevWorkGuideForceStep(null);
      return;
    }
    setDevWorkGuideForceStep(devWorkGuideStepFromChain(chain));
  }, [guestBrowseActive, chain]);

  if (!guestBrowseActive) {
    return EMPTY_GUEST_BROWSE_WORK_GUIDE;
  }

  return {
    storageKey,
    dismiss,
    ...chain,
  };
}
