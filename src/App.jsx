/**
 * 앱 최상위: screen(welcome/main/room)과 보조 창(?window=mypage|guide) 분기.
 * Firebase auth 부트스트랩·subscribeAuthSession·PostHog syncPostHogIdentity.
 * useRuleSets 로드 후 MainScreen에 props 주입; 로그인 필수인데 uid 없으면 welcome 복귀.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import MomoRoomScreen from './components/MomoRoomScreen.jsx';
import GuideWindowScreen from './components/GuideWindowScreen.jsx';
import MyPageWindowScreen from './components/MyPageWindowScreen.jsx';
import MyPagePrototypeScreen from './mock/mypagePrototype/MyPagePrototypeScreen.jsx';
import WorkHistoryPrototypeScreen from './mock/workHistoryPrototype/WorkHistoryPrototypeScreen.jsx';
import ConsistencyPrototypeScreen from './mock/consistencyPrototype/ConsistencyPrototypeScreen.jsx';
import {
  defaultCautionEnabled,
} from './lib/cautionRules.js';
import {
  builtInEnabledFromSheet,
} from './lib/builtInRules.js';
import { useRuleSets } from './hooks/useRuleSets.js';
import { useBonBojoDevRefresh } from './hooks/useBonBojoDevRefresh.js';
import { ensureDefaultAuxiliaryVerbs } from './lib/defaultAuxiliaryVerbs.js';
import {
  BON_BOJO_RULES_FP,
  bonBojoRulesFingerprint,
  replaceBonBojoRulesData,
} from './lib/bonBojoRules.js';
import {
  completeGoogleRedirectIfNeeded,
  getCurrentUserSession,
  signInWithGoogle,
  signOutUser,
  subscribeAuthSession,
  waitForAuthInitialization,
} from './lib/firebaseAuth.js';
import { isLoginRequiredForChecks } from './lib/checkAuthGate.js';
import {
  beginGuestBrowse,
  endGuestBrowse,
  guestBrowseAllowsWorkspaceStay,
} from './lib/guestBrowsePolicy.js';
import { isOnboardingComplete } from './lib/userProfileStorage.js';
import {
  identifyAnalyticsUser,
  resetAnalyticsUser,
  waitForAnalyticsReady,
} from './lib/analytics.js';
import { resolveQuotaAuthEmail } from './lib/betaDailyQuota.js';
import {
  hasValidFeedbackFormSubmitPending,
  resolveFeedbackThankYouOnLoad,
} from './lib/feedbackFormSubmitReturn.js';
import { WORK_GUIDE_KEYS, workGuideStorageKey } from './lib/workGuideKeys.js';
import {
  consumeReturnToMainWorkspace,
  markReturnToMainWorkspace,
  RETURN_TO_MAIN_STORAGE_KEY,
  shouldReopenMainWorkspace,
} from './lib/returnToWorkspace.js';
import { clearTabSessionMarker, clearWorkSession } from './lib/sessionStore.js';
import { clearTooltipGuideDismissed } from './lib/tooltipGuideStorage.js';
import { shouldAutoEnterMainFromWelcome } from './lib/welcomeViewport.js';
import AppDialogHost from './components/AppDialogHost.jsx';
import EventRewardLayer from './components/EventRewardLayer.jsx';

export default function App() {
  const auxWindow =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('window')
      : '';
  const [authSession, setAuthSession] = useState(() => getCurrentUserSession());
  const [authReady, setAuthReady] = useState(false);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [screen, setScreen] = useState(() => {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('devPdf')
    ) {
      return 'main';
    }
    if (shouldReopenMainWorkspace() && shouldAutoEnterMainFromWelcome()) {
      return 'main';
    }
    return 'welcome';
  });
  const [mainWorkTab, setMainWorkTab] = useState('spelling');
  const [feedbackThankYouOpen, setFeedbackThankYouOpen] = useState(false);
  const [eventRewardTick, setEventRewardTick] = useState(0);
  const [rewardNoticeTick, setRewardNoticeTick] = useState(0);
  /** 집 아이콘 등 사용자가 명시적으로 대문으로 돌아온 경우 welcome→main 자동 전환 억제 */
  const welcomeManualReturnRef = useRef(false);

  const applyFeedbackThankYouUi = useCallback((uid) => {
    const id = uid.trim();
    if (!id) return;
    clearTooltipGuideDismissed(
      workGuideStorageKey(id, WORK_GUIDE_KEYS.FEEDBACK_QUOTA_THANK),
    );
    setFeedbackThankYouOpen(true);
    setRewardNoticeTick((tick) => tick + 1);
    if (isLoginRequiredForChecks() && shouldAutoEnterMainFromWelcome()) {
      setScreen('main');
    }
  }, []);

  useEffect(() => {
    if (!authReady || auxWindow || !authSession?.uid) return;
    void resolveFeedbackThankYouOnLoad(
      authSession.uid,
      resolveQuotaAuthEmail(authSession),
    ).then((result) => {
      if (!result.handled) return;
      if (!result.granted && !result.showThankYou) return;
      if (result.showThankYou) {
        applyFeedbackThankYouUi(authSession.uid);
        return;
      }
      if (result.showEventReward) {
        setEventRewardTick((tick) => tick + 1);
      }
      if (isLoginRequiredForChecks() && shouldAutoEnterMainFromWelcome()) {
        setScreen('main');
      }
    });
  }, [authReady, auxWindow, authSession, applyFeedbackThankYouUi]);

  const applyReturnToMainWorkspace = useCallback(() => {
    if (!consumeReturnToMainWorkspace()) return;
    if (!shouldAutoEnterMainFromWelcome()) return;
    if (!isLoginRequiredForChecks() || authSession?.uid) {
      setScreen('main');
    }
  }, [authSession]);

  useEffect(() => {
    if (!authReady || auxWindow) return;
    applyReturnToMainWorkspace();
  }, [authReady, auxWindow, applyReturnToMainWorkspace]);

  useEffect(() => {
    if (auxWindow) return;
    const onStorage = (event) => {
      if (event.key !== RETURN_TO_MAIN_STORAGE_KEY || event.newValue == null) return;
      applyReturnToMainWorkspace();
    };
    const onFocus = () => {
      if (!shouldReopenMainWorkspace()) return;
      applyReturnToMainWorkspace();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [auxWindow, applyReturnToMainWorkspace]);

  useEffect(() => {
    if (!authReady || auxWindow) return;
    if (screen !== 'main') return;
    if (!isLoginRequiredForChecks()) return;
    if (authSession?.uid) {
      endGuestBrowse();
      return;
    }
    if (guestBrowseAllowsWorkspaceStay()) return;
    void clearWorkSession();
    setScreen('welcome');
  }, [authReady, auxWindow, screen, authSession]);

  const syncPostHogIdentity = useCallback((session) => {
    void waitForAnalyticsReady().then(() => {
      if (session?.uid) {
        identifyAnalyticsUser(
          session.uid,
          resolveQuotaAuthEmail(session),
        );
        return;
      }
      resetAnalyticsUser();
    });
  }, []);

  useEffect(() => {
    if (auxWindow) return;
    return subscribeAuthSession((session) => {
      setAuthSession(session);
      syncPostHogIdentity(session);
    });
  }, [auxWindow, syncPostHogIdentity]);

  useEffect(() => {
    if (!authReady || auxWindow) return;
    syncPostHogIdentity(authSession);
  }, [authReady, auxWindow, authSession, syncPostHogIdentity]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { session, error } = await completeGoogleRedirectIfNeeded();
        if (cancelled) return;
        if (session) setAuthSession(session);
        if (error) setAuthBootstrapError(error);

        const initializedSession = await waitForAuthInitialization();
        if (cancelled) return;
        if (initializedSession) setAuthSession(initializedSession);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen === 'main') {
      welcomeManualReturnRef.current = false;
    }
  }, [screen]);

  useEffect(() => {
    if (!authReady || auxWindow || screen !== 'welcome') return;
    if (welcomeManualReturnRef.current) return;
    if (!shouldAutoEnterMainFromWelcome()) return;
    const uid = authSession?.uid?.trim();
    if (!uid || !isOnboardingComplete(uid)) return;
    setMainWorkTab('spelling');
    setScreen('main');
  }, [authReady, auxWindow, screen, authSession?.uid]);

  const {
    rulesReady,
    activeSet,
    ruleSets,
    activeSetId,
    updateActiveSet,
    handleSelectRuleSet,
    handleCreateRuleSet,
    handleDuplicateRuleSet,
    handleDeleteRuleSet,
    handleSaveRules,
    handleSaveCriteriaPreset,
    handleDeleteCriteriaPreset,
    touchActiveProjectContext,
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
    flushPendingRuleSetsSave,
    flushPendingRuleSetsSaveAsync,
  } = useRuleSets(
    authSession?.uid ?? '',
    resolveQuotaAuthEmail(authSession),
  );

  const handleSwitchSavedProject = useCallback(
    async (setId) => {
      if (!setId || setId === activeSetId) return;
      await flushPendingRuleSetsSaveAsync();
      handleSelectRuleSet(setId);
      await flushPendingRuleSetsSaveAsync();
      markReturnToMainWorkspace();
      clearTabSessionMarker();
      await clearWorkSession();
      window.location.reload();
    },
    [activeSetId, flushPendingRuleSetsSaveAsync, handleSelectRuleSet],
  );

  const applyBonBojoSheetRefresh = useCallback(
    async (data, remoteFp) => {
      replaceBonBojoRulesData(data);
      const fp = remoteFp ?? bonBojoRulesFingerprint(data);
      const rules = activeSet?.customRules ?? [];
      updateActiveSet({
        customRules: ensureDefaultAuxiliaryVerbs(rules),
        bonBojoRulesFingerprint: fp,
      });
    },
    [activeSet?.customRules, updateActiveSet],
  );

  useBonBojoDevRefresh({
    enabled: import.meta.env.DEV && screen === 'main',
    ready: rulesReady && Boolean(activeSet),
    appliedFingerprint:
      activeSet?.bonBojoRulesFingerprint ?? BON_BOJO_RULES_FP,
    onApply: applyBonBojoSheetRefresh,
  });

  const resolvedCustomRules = useMemo(
    () => ensureDefaultAuxiliaryVerbs(activeSet?.customRules ?? []),
    [activeSet?.customRules],
  );

  useEffect(() => {
    if (screen !== 'main' || !rulesReady || !activeSet) return;
    const prev = activeSet.customRules ?? [];
    const odaPrev = prev.some(
      (r) =>
        r.patternKind === 'auxiliary-verb' &&
        r.bonBojoItemId === 'verb-oda' &&
        r.tailWord === '해 왔',
    );
    if (
      odaPrev &&
      resolvedCustomRules.length === prev.length &&
      resolvedCustomRules.filter((r) => r.patternKind === 'auxiliary-verb')
        .length === prev.filter((r) => r.patternKind === 'auxiliary-verb').length
    ) {
      return;
    }
    updateActiveSet({ customRules: resolvedCustomRules });
  }, [
    screen,
    rulesReady,
    activeSetId,
    resolvedCustomRules,
    updateActiveSet,
    activeSet,
  ]);

  if (import.meta.env.DEV && auxWindow === 'mypage-mock') {
    return (
      <>
        <MyPagePrototypeScreen />
        <AppDialogHost />
      </>
    );
  }

  if (import.meta.env.DEV && auxWindow === 'consistency-mock') {
    return (
      <>
        <ConsistencyPrototypeScreen />
        <AppDialogHost />
      </>
    );
  }

  if (import.meta.env.DEV && auxWindow === 'work-history-mock') {
    return <WorkHistoryPrototypeScreen />;
  }

  if (auxWindow === 'mypage') {
    return (
      <>
        <MyPageWindowScreen authSession={authSession} authReady={authReady} />
        <EventRewardLayer
          authUid={authSession?.uid}
          checkTick={eventRewardTick}
        />
        <AppDialogHost />
      </>
    );
  }
  if (auxWindow === 'guide') {
    return (
      <>
        <GuideWindowScreen />
        <AppDialogHost />
      </>
    );
  }

  if (screen === 'room') {
    return (
      <>
        <MomoRoomScreen
          onClose={() => setScreen('welcome')}
          authUid={authSession?.uid ?? ''}
        />
        <AppDialogHost />
      </>
    );
  }

  if (screen === 'welcome') {
    return (
      <>
      <WelcomeScreen
        authSession={authSession}
        authReady={authReady}
        authBootstrapError={authBootstrapError}
        onGoogleSignIn={async () => {
          await signInWithGoogle();
          syncPostHogIdentity(getCurrentUserSession());
        }}
        onLogout={async () => {
          welcomeManualReturnRef.current = false;
          await flushPendingRuleSetsSaveAsync();
          await signOutUser();
        }}
        onStart={() => {
          endGuestBrowse();
          setMainWorkTab('spelling');
          setScreen('main');
        }}
        onBrowse={() => {
          beginGuestBrowse();
          setMainWorkTab('spelling');
          setScreen('main');
        }}
        onOpenRoom={() => setScreen('room')}
      />
      <AppDialogHost />
      </>
    );
  }

  if (!rulesReady || !activeSet) {
    return (
      <>
      <div className="app-loading" role="status" aria-live="polite">
        <p>규칙 불러오는 중…</p>
      </div>
      <AppDialogHost />
      </>
    );
  }

  // MainScreen dead props: ruleSets·CRUD·onSaveRules 등 9개 — UI 미배선, 제거 금지.
  // 계약 문서: project-docs/app-mainscreen-contract.md
  return (
    <>
    <MainScreen
      ruleSets={ruleSets.map((s) => ({
        id: s.id,
        name: s.name,
        savedAt: s.savedAt,
      }))}
      activeSetId={activeSetId}
      onSelectRuleSet={handleSwitchSavedProject}
      onCreateRuleSet={handleCreateRuleSet}
      onDuplicateRuleSet={handleDuplicateRuleSet}
      onDeleteRuleSet={handleDeleteRuleSet}
      ruleSetSavedAt={activeSet.savedAt}
      builtInEnabled={
        activeSet.builtInEnabled ?? builtInEnabledFromSheet()
      }
      customRules={resolvedCustomRules}
      globalExcludePhrases={activeSet.globalExcludePhrases ?? []}
      tocBodyText={activeSet.tocBodyText ?? ''}
      tocBodyStartPage={activeSet.tocBodyStartPage ?? null}
      tocBodyExcludePages={activeSet.tocBodyExcludePages ?? ''}
      onRuleSetNameChange={(name) => updateActiveSet({ name })}
      cautionEnabled={
        activeSet.cautionEnabled ?? defaultCautionEnabled()
      }
      onBuiltInToggle={handleBuiltInToggle}
      onBuiltInSetAll={handleBuiltInSetAll}
      onCautionToggle={handleCautionToggle}
      onCautionSetAll={handleCautionSetAll}
      onCustomRulesChange={(customRules) =>
        updateActiveSet({ customRules: ensureDefaultAuxiliaryVerbs(customRules) })
      }
      onGlobalExcludePhrasesChange={(globalExcludePhrases) =>
        updateActiveSet({ globalExcludePhrases })
      }
      onTocBodyTextChange={(tocBodyText) => updateActiveSet({ tocBodyText })}
      onTocBodyExcludePagesChange={(tocBodyExcludePages) =>
        updateActiveSet({ tocBodyExcludePages })
      }
      onSaveRules={handleSaveRules}
      onSaveCriteriaPreset={handleSaveCriteriaPreset}
      onDeleteCriteriaPreset={handleDeleteCriteriaPreset}
      onTouchActiveProjectContext={touchActiveProjectContext}
      onOpenWelcome={() => {
        welcomeManualReturnRef.current = true;
        endGuestBrowse();
        flushPendingRuleSetsSave();
        void clearWorkSession();
        setMainWorkTab('spelling');
        setScreen('welcome');
      }}
      onLogout={async () => {
        welcomeManualReturnRef.current = false;
        endGuestBrowse();
        await flushPendingRuleSetsSaveAsync();
        await clearWorkSession();
        await signOutUser();
        setMainWorkTab('spelling');
        setScreen('welcome');
      }}
      onOpenMyPageWindow={() => {
        const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
        url.searchParams.set('window', 'mypage');
        const existing = window.open('', 'indiya-mypage');
        if (existing && !existing.closed) {
          existing.location.replace(url.toString());
          existing.focus();
          return;
        }
        window.open(url.toString(), 'indiya-mypage');
      }}
      onOpenGuideWindow={() => {
        const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
        url.searchParams.set('window', 'guide');
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
      }}
      initialWorkTab={mainWorkTab}
      feedbackThankYouOpen={feedbackThankYouOpen}
      onFeedbackThankYouDismiss={() => setFeedbackThankYouOpen(false)}
      rewardNoticeTick={rewardNoticeTick}
    />
    <EventRewardLayer
      authUid={authSession?.uid}
      checkTick={eventRewardTick}
    />
    <AppDialogHost />
    </>
  );
}
