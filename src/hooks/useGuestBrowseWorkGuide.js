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
 * 작업 말풍선 훅.
 * - 둘러보기(게스트): 세션 동안 체인
 * - 로그인 회원: uid별 dismiss + 온보딩 노출(하루 1·최대 5회)
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
  const memberUid = String(uid ?? '').trim();
  const guidesActive = guestBrowseActive || Boolean(memberUid);

  useEffect(() => {
    if (!guidesActive) return;
    syncWorkGuideOnAuthChange(uid);
  }, [uid, guidesActive]);

  const storageKey = useCallback(
    (key) => workGuideStorageKey(uid, key),
    [uid],
  );

  const dismiss = useCallback(
    (key) => {
      if (!guidesActive) return;
      if (isWorkGuidePinned()) return;
      dismissTooltipGuide(storageKey(key));
      setDevWorkGuideForceStep(null);
      bump();
    },
    [guidesActive, storageKey, bump],
  );

  const chain = useMemo(() => {
    if (!guidesActive) return EMPTY_GUEST_BROWSE_WORK_GUIDE;
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
      { guestBrowseActive },
    );
  }, [
    guidesActive,
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

  const openGuideStep = guidesActive
    ? devWorkGuideStepFromChain(chain)
    : null;

  useEffect(() => {
    if (!guidesActive || !memberUid) return;
    if (
      openGuideStep == null ||
      isWorkGuidePinned() ||
      getDevWorkGuideForceStep() != null
    ) {
      return;
    }
    const result = commitWorkGuideOnboardingExposureSlot(memberUid);
    if (result.committed) bump();
  }, [guidesActive, memberUid, openGuideStep, bump]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!guidesActive) {
      setDevWorkGuideForceStep(null);
      return;
    }
    setDevWorkGuideForceStep(devWorkGuideStepFromChain(chain));
  }, [guidesActive, chain]);

  if (!guidesActive) {
    return EMPTY_GUEST_BROWSE_WORK_GUIDE;
  }

  return {
    storageKey,
    dismiss,
    ...chain,
  };
}
