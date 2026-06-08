import { useCallback, useEffect, useMemo, useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import MomoRoomScreen from './components/MomoRoomScreen.jsx';
import GuideWindowScreen from './components/GuideWindowScreen.jsx';
import MyPageWindowScreen from './components/MyPageWindowScreen.jsx';
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
import { isOnboardingComplete } from './lib/userProfileStorage.js';
import { resolveQuotaAuthEmail } from './lib/betaDailyQuota.js';
import { resolveFeedbackThankYouOnLoad } from './lib/feedbackFormSubmitReturn.js';
import {
  FEEDBACK_THANK_SIGNAL_KEY,
  takeFeedbackThankYouSignal,
} from './lib/feedbackThankYouSignal.js';
import { WORK_GUIDE_KEYS, workGuideStorageKey } from './lib/workGuideKeys.js';
import { consumeReturnToMainWorkspace, markReturnToMainWorkspace } from './lib/returnToWorkspace.js';
import { clearWorkSession } from './lib/sessionStore.js';
import { clearTooltipGuideDismissed } from './lib/tooltipGuideStorage.js';
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
    return 'welcome';
  });
  const [mainWorkTab, setMainWorkTab] = useState('spelling');
  const [feedbackThankYouOpen, setFeedbackThankYouOpen] = useState(false);
  const [eventRewardTick, setEventRewardTick] = useState(0);
  const [rewardNoticeTick, setRewardNoticeTick] = useState(0);

  const applyFeedbackThankYouUi = useCallback((uid) => {
    const id = uid.trim();
    if (!id) return;
    clearTooltipGuideDismissed(
      workGuideStorageKey(id, WORK_GUIDE_KEYS.FEEDBACK_QUOTA_THANK),
    );
    setFeedbackThankYouOpen(true);
    setRewardNoticeTick((tick) => tick + 1);
    if (isLoginRequiredForChecks()) {
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
      if (isLoginRequiredForChecks()) {
        setScreen('main');
      }
    });
  }, [authReady, auxWindow, authSession, applyFeedbackThankYouUi]);

  useEffect(() => {
    const uid = authSession?.uid?.trim() ?? '';
    if (!uid || auxWindow) return undefined;

    const syncFromSignal = () => {
      const signal = takeFeedbackThankYouSignal(uid);
      if (signal) applyFeedbackThankYouUi(signal.uid);
    };

    const onStorage = (event) => {
      if (event.key === FEEDBACK_THANK_SIGNAL_KEY) syncFromSignal();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncFromSignal();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncFromSignal);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncFromSignal);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authSession?.uid, auxWindow, applyFeedbackThankYouUi]);

  useEffect(() => {
    if (!authReady || auxWindow) return;
    if (!consumeReturnToMainWorkspace()) return;
    if (!isLoginRequiredForChecks() || authSession?.uid) {
      setScreen('main');
    }
  }, [authReady, auxWindow, authSession]);

  useEffect(() => {
    if (!authReady || auxWindow) return;
    if (screen !== 'main') return;
    if (!isLoginRequiredForChecks()) return;
    if (!authSession?.uid) {
      void clearWorkSession();
      setScreen('welcome');
    }
  }, [authReady, auxWindow, screen, authSession]);

  useEffect(() => subscribeAuthSession(setAuthSession), []);

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
    if (!authReady || auxWindow || screen !== 'welcome') return;
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
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
  } = useRuleSets(
    authSession?.uid ?? '',
    resolveQuotaAuthEmail(authSession),
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

  if (auxWindow === 'mypage') {
    return (
      <>
        <MyPageWindowScreen authSession={authSession} authReady={authReady} />
        <EventRewardLayer
          authUid={authSession?.uid}
          checkTick={eventRewardTick}
        />
      </>
    );
  }
  if (auxWindow === 'guide') {
    return <GuideWindowScreen />;
  }

  if (screen === 'room') {
    return (
      <MomoRoomScreen
        onClose={() => setScreen('welcome')}
        authUid={authSession?.uid ?? ''}
      />
    );
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        authSession={authSession}
        authReady={authReady}
        authBootstrapError={authBootstrapError}
        onGoogleSignIn={async () => {
          await signInWithGoogle();
        }}
        onLogout={async () => {
          await signOutUser();
        }}
        onStart={() => {
          setMainWorkTab('spelling');
          setScreen('main');
        }}
        onOpenRoom={() => setScreen('room')}
      />
    );
  }

  if (!rulesReady || !activeSet) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <p>규칙 불러오는 중…</p>
      </div>
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
      onSelectRuleSet={handleSelectRuleSet}
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
      onOpenWelcome={() => {
        void clearWorkSession();
        setMainWorkTab('spelling');
        setScreen('welcome');
      }}
      onLogout={async () => {
        await clearWorkSession();
        await signOutUser();
        setMainWorkTab('spelling');
        setScreen('welcome');
      }}
      onOpenMyPageWindow={() => {
        markReturnToMainWorkspace();
        const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
        url.searchParams.set('window', 'mypage');
        window.open(url.toString(), '_blank', 'noopener');
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
    </>
  );
}
