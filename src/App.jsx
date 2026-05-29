import { useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import MomoRoomScreen from './components/MomoRoomScreen.jsx';
import {
  defaultCautionEnabled,
  CAUTION_SEARCH_RULES,
} from './lib/cautionRules.js';
import {
  BUILT_IN_RULES,
  countsTowardSpellingQuota,
  builtInEnabledFromSheet,
} from './lib/builtInRules.js';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from './lib/activeRuleCount.js';
import { useRuleSets } from './hooks/useRuleSets.js';

export default function App() {
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
  } = useRuleSets();

  if (screen === 'room') {
    return <MomoRoomScreen onClose={() => setScreen('welcome')} />;
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
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
      onBuiltInToggle={(find) => {
        const prev = activeSet.builtInEnabled ?? builtInEnabledFromSheet();
        const on = prev[find] === true;
        const nextBuiltIn = { ...prev, [find]: !on };
        if (
          !on &&
          isOverMaxRules(
            countActiveRules({
              builtInEnabled: nextBuiltIn,
              cautionEnabled: activeSet.cautionEnabled,
              customRules: activeSet.customRules,
            }),
          )
        ) {
          alert(maxRulesExceededMessage());
          return;
        }
        updateActiveSet({ builtInEnabled: nextBuiltIn });
      }}
      onBuiltInSetAll={(enabled) => {
        const prev = activeSet.builtInEnabled ?? builtInEnabledFromSheet();
        const nextBuiltIn = { ...prev };
        for (const r of BUILT_IN_RULES) {
          if (countsTowardSpellingQuota(r)) {
            nextBuiltIn[r.find] = enabled;
          }
        }
        if (
          enabled &&
          isOverMaxRules(
            countActiveRules({
              builtInEnabled: nextBuiltIn,
              cautionEnabled: activeSet.cautionEnabled,
              customRules: activeSet.customRules,
            }),
          )
        ) {
          alert(maxRulesExceededMessage());
          return;
        }
        updateActiveSet({ builtInEnabled: nextBuiltIn });
      }}
      onCautionToggle={(id) => {
        const prev = activeSet.cautionEnabled ?? defaultCautionEnabled();
        const on = prev[id] === true;
        const nextCaution = { ...prev, [id]: !on };
        if (
          !on &&
          isOverMaxRules(
            countActiveRules({
              builtInEnabled: activeSet.builtInEnabled,
              cautionEnabled: nextCaution,
              customRules: activeSet.customRules,
            }),
          )
        ) {
          alert(maxRulesExceededMessage());
          return;
        }
        updateActiveSet({ cautionEnabled: nextCaution });
      }}
      onCautionSetAll={(enabled) => {
        const prev = activeSet.cautionEnabled ?? defaultCautionEnabled();
        const nextCaution = { ...prev };
        for (const rule of CAUTION_SEARCH_RULES) {
          nextCaution[rule.id] = enabled;
        }
        if (
          enabled &&
          isOverMaxRules(
            countActiveRules({
              builtInEnabled: activeSet.builtInEnabled,
              cautionEnabled: nextCaution,
              customRules: activeSet.customRules,
            }),
          )
        ) {
          alert(maxRulesExceededMessage());
          return;
        }
        updateActiveSet({ cautionEnabled: nextCaution });
      }}
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
