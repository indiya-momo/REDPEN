import { useEffect, useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import MomoRoomScreen from './components/MomoRoomScreen.jsx';
import {
  defaultCautionEnabled,
} from './lib/cautionRules.js';
import {
  builtInEnabledFromSheet,
} from './lib/builtInRules.js';
import { useRuleSets } from './hooks/useRuleSets.js';
import {
  getCurrentUserSession,
  signInWithGooglePopup,
  signOutUser,
  subscribeAuthSession,
} from './lib/firebaseAuth.js';

export default function App() {
  const [authSession, setAuthSession] = useState(() => getCurrentUserSession());
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

  useEffect(() => subscribeAuthSession(setAuthSession), []);

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
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
  } = useRuleSets();

  if (screen === 'room') {
    return <MomoRoomScreen onClose={() => setScreen('welcome')} />;
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        authSession={authSession}
        onGoogleSignIn={async () => {
          await signInWithGooglePopup();
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
      ruleSets={ruleSets.map((s) => ({ id: s.id, name: s.name }))}
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
      onSaveRules={handleSaveRules}
      onOpenWelcome={() => setScreen('welcome')}
      initialWorkTab={mainWorkTab}
    />
  );
}
