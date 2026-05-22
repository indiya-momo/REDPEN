import { useCallback, useEffect, useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen, { shouldShowWelcome } from './components/WelcomeScreen.jsx';
import {
  defaultCautionEnabled,
  migrateCautionEnabled,
} from './lib/cautionRules.js';
import {
  SPELLING_RULES_FP,
  builtInEnabledFromSheet,
  migrateBuiltInEnabled,
} from './lib/builtInRules.js';
import {
  loadActiveSetId,
  loadRuleSets,
  newId,
  saveActiveSetId,
  saveRuleSets,
} from './lib/ruleSetsStorage.js';

function normalizeRuleSet(set) {
  return {
    ...set,
    builtInEnabled: migrateBuiltInEnabled(
      set.builtInEnabled,
      set.spellingRulesFingerprint,
    ),
    spellingRulesFingerprint: SPELLING_RULES_FP,
    customRules: set.customRules ?? [],
    globalExcludePhrases: set.globalExcludePhrases ?? [],
    cautionEnabled: migrateCautionEnabled(set.cautionEnabled),
  };
}

function createDefaultSet() {
  return normalizeRuleSet({
    id: newId(),
    name: '기본 규칙 세트',
    builtInEnabled: builtInEnabledFromSheet(),
    customRules: [],
    globalExcludePhrases: [],
    cautionEnabled: defaultCautionEnabled(),
  });
}

export default function App() {
  const [screen, setScreen] = useState(() =>
    shouldShowWelcome() ? 'welcome' : 'main',
  );
  const [mainWorkTab, setMainWorkTab] = useState('spelling');
  const [ruleSets, setRuleSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(null);

  useEffect(() => {
    let sets = loadRuleSets().map(normalizeRuleSet);
    if (!sets.length) {
      sets = [createDefaultSet()];
    }
    saveRuleSets(sets);
    if (!loadActiveSetId() || !sets.some((s) => s.id === loadActiveSetId())) {
      saveActiveSetId(sets[0].id);
    }
    const savedActive = loadActiveSetId();
    setRuleSets(sets);
    setActiveSetId(
      savedActive && sets.some((s) => s.id === savedActive)
        ? savedActive
        : sets[0].id,
    );
  }, []);

  const activeSet =
    ruleSets.find((s) => s.id === activeSetId) ?? ruleSets[0] ?? createDefaultSet();

  const updateActiveSet = useCallback(
    (patch) => {
      setRuleSets((prev) => {
        const next = prev.map((s) =>
          s.id === activeSet.id ? { ...s, ...patch } : s,
        );
        return next;
      });
    },
    [activeSet.id],
  );

  function persistSets(nextSets, nextActiveId = activeSetId) {
    saveRuleSets(nextSets);
    if (nextActiveId) saveActiveSetId(nextActiveId);
  }

  function handleSaveRules() {
    const next = ruleSets.map((s) =>
      s.id === activeSet.id
        ? { ...s, spellingRulesFingerprint: SPELLING_RULES_FP }
        : s,
    );
    setRuleSets(next);
    persistSets(next, activeSetId);
    alert('규칙 세트가 저장되었습니다.');
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onStart={() => {
          setMainWorkTab('spelling');
          setScreen('main');
        }}
        onOpenSettings={() => {
          setMainWorkTab('consistency');
          setScreen('main');
        }}
      />
    );
  }

  return (
    <MainScreen
      ruleSetName={activeSet.name}
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
        const on = prev[find] !== false;
        updateActiveSet({
          builtInEnabled: { ...prev, [find]: !on },
        });
      }}
      onCautionToggle={(id) => {
        const prev = activeSet.cautionEnabled ?? defaultCautionEnabled();
        const on = prev[id] === true;
        updateActiveSet({
          cautionEnabled: { ...prev, [id]: !on },
        });
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
