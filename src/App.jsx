import { useEffect, useState } from 'react';
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
import {
  completeGoogleRedirectIfNeeded,
  getCurrentUserSession,
  signInWithGoogle,
  signOutUser,
  subscribeAuthSession,
} from './lib/firebaseAuth.js';
import { consumeReturnToMainWorkspace, markReturnToMainWorkspace } from './lib/returnToWorkspace.js';

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

  useEffect(() => {
    if (!auxWindow && consumeReturnToMainWorkspace()) {
      setScreen('main');
    }
  }, [auxWindow]);

  useEffect(() => {
    const unsubscribe = subscribeAuthSession(setAuthSession);
    completeGoogleRedirectIfNeeded()
      .then(({ session, error }) => {
        if (session) setAuthSession(session);
        if (error) setAuthBootstrapError(error);
      })
      .finally(() => {
        setAuthReady(true);
      });
    return unsubscribe;
  }, []);

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
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
  } = useRuleSets();

  if (auxWindow === 'mypage') {
    return <MyPageWindowScreen />;
  }
  if (auxWindow === 'guide') {
    return <GuideWindowScreen />;
  }

  if (screen === 'room') {
    return <MomoRoomScreen onClose={() => setScreen('welcome')} />;
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
      customRules={activeSet.customRules ?? []}
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
      onCustomRulesChange={(customRules) => updateActiveSet({ customRules })}
      onGlobalExcludePhrasesChange={(globalExcludePhrases) =>
        updateActiveSet({ globalExcludePhrases })
      }
      onTocBodyTextChange={(tocBodyText) => updateActiveSet({ tocBodyText })}
      onTocBodyExcludePagesChange={(tocBodyExcludePages) =>
        updateActiveSet({ tocBodyExcludePages })
      }
      onSaveRules={handleSaveRules}
      onSaveCriteriaPreset={handleSaveCriteriaPreset}
      onOpenWelcome={() => setScreen('welcome')}
      onLogout={async () => {
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
    />
  );
}
