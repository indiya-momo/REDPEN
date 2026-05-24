import { useCallback, useEffect, useRef, useState } from 'react';
import MainScreen from './components/MainScreen.jsx';
import WelcomeScreen from './components/WelcomeScreen.jsx';
import {
  defaultCautionEnabled,
  migrateCautionEnabled,
  CAUTION_SEARCH_RULES,
} from './lib/cautionRules.js';
import {
  BUILT_IN_RULES,
  SPELLING_RULES_FP,
  builtInEnabledFromSheet,
  migrateBuiltInEnabled,
} from './lib/builtInRules.js';
import { applyCompoundRuleMigrations } from './lib/migrateCompoundRules.js';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from './lib/activeRuleCount.js';
import {
  duplicateRuleSet,
  loadActiveSetId,
  loadRuleSets,
  newId,
  saveActiveSetId,
  saveRuleSets,
} from './lib/ruleSetsStorage.js';

const RULE_SET_AUTOSAVE_MS = 400;

function normalizeRuleSet(set) {
  const { rules: customRules, version: compoundMigrateVersion } =
    applyCompoundRuleMigrations(
      set.customRules ?? [],
      set.compoundMigrateVersion,
    );
  return {
    ...set,
    builtInEnabled: migrateBuiltInEnabled(
      set.builtInEnabled,
      set.spellingRulesFingerprint,
    ),
    spellingRulesFingerprint: SPELLING_RULES_FP,
    customRules,
    compoundMigrateVersion,
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
  const [ruleSets, setRuleSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(null);
  const [rulesReady, setRulesReady] = useState(false);

  const activeSetIdRef = useRef(activeSetId);
  const ruleSetsRef = useRef(ruleSets);
  const autosaveTimerRef = useRef(null);

  activeSetIdRef.current = activeSetId;
  ruleSetsRef.current = ruleSets;

  const flushRuleSets = useCallback((sets, setId = activeSetIdRef.current) => {
    saveRuleSets(sets);
    if (setId) saveActiveSetId(setId);
  }, []);

  const scheduleRuleSetsSave = useCallback(
    (sets) => {
      ruleSetsRef.current = sets;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        flushRuleSets(sets, activeSetIdRef.current);
      }, RULE_SET_AUTOSAVE_MS);
    },
    [flushRuleSets],
  );

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
    setRulesReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
        flushRuleSets(ruleSetsRef.current, activeSetIdRef.current);
      }
    };
  }, [flushRuleSets]);

  const activeSet = rulesReady
    ? (ruleSets.find((s) => s.id === activeSetId) ?? ruleSets[0] ?? null)
    : null;

  const updateActiveSet = useCallback(
    (patch) => {
      const setId = activeSetIdRef.current;
      if (!setId) return;
      setRuleSets((prev) => {
        const next = prev.map((s) => (s.id === setId ? { ...s, ...patch } : s));
        scheduleRuleSetsSave(next);
        return next;
      });
    },
    [scheduleRuleSetsSave],
  );

  const flushPendingRuleSetsSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    flushRuleSets(ruleSetsRef.current, activeSetIdRef.current);
  }, [flushRuleSets]);

  const applyRuleSets = useCallback(
    (next, nextActiveId = activeSetIdRef.current) => {
      flushPendingRuleSetsSave();
      ruleSetsRef.current = next;
      setRuleSets(next);
      setActiveSetId(nextActiveId);
      activeSetIdRef.current = nextActiveId;
      flushRuleSets(next, nextActiveId);
    },
    [flushPendingRuleSetsSave, flushRuleSets],
  );

  const handleSelectRuleSet = useCallback(
    (id) => {
      if (!id || id === activeSetIdRef.current) return;
      if (!ruleSetsRef.current.some((s) => s.id === id)) return;
      flushPendingRuleSetsSave();
      setActiveSetId(id);
      activeSetIdRef.current = id;
      saveActiveSetId(id);
    },
    [flushPendingRuleSetsSave],
  );

  const handleCreateRuleSet = useCallback(() => {
    const newSet = normalizeRuleSet({
      id: newId(),
      name: '',
      builtInEnabled: builtInEnabledFromSheet(),
      customRules: [],
      globalExcludePhrases: [],
      cautionEnabled: defaultCautionEnabled(),
    });
    applyRuleSets([...ruleSetsRef.current, newSet], newSet.id);
  }, [applyRuleSets]);

  const handleDuplicateRuleSet = useCallback(() => {
    const source = ruleSetsRef.current.find(
      (s) => s.id === activeSetIdRef.current,
    );
    if (!source) return;
    const copy = normalizeRuleSet(duplicateRuleSet(source));
    applyRuleSets([...ruleSetsRef.current, copy], copy.id);
  }, [applyRuleSets]);

  const handleDeleteRuleSet = useCallback(() => {
    const sets = ruleSetsRef.current;
    if (sets.length <= 1) {
      alert('마지막 규칙 세트는 삭제할 수 없습니다.');
      return;
    }
    const id = activeSetIdRef.current;
    const current = sets.find((s) => s.id === id);
    const label = (current?.name || '규칙 세트').trim() || '규칙 세트';
    if (!window.confirm(`「${label}」 규칙 세트를 삭제할까요?`)) return;

    const next = sets.filter((s) => s.id !== id);
    const nextActive = next[0]?.id;
    if (!nextActive) return;
    applyRuleSets(next, nextActive);
  }, [applyRuleSets]);

  function handleSaveRules() {
    const setId = activeSetIdRef.current;
    if (!setId) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const savedAt = new Date().toISOString();
    const next = ruleSets.map((s) =>
      s.id === setId
        ? { ...s, spellingRulesFingerprint: SPELLING_RULES_FP, savedAt }
        : s,
    );
    setRuleSets(next);
    flushRuleSets(next, setId);
    alert('규칙 세트가 저장되었습니다.');
  }

  if (screen === 'welcome') {
    return (
      <WelcomeScreen
        onStart={() => {
          setMainWorkTab('spelling');
          setScreen('main');
        }}
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

  return (
    <MainScreen
      ruleSets={ruleSets.map((s) => ({ id: s.id, name: s.name }))}
      activeSetId={activeSetId}
      onSelectRuleSet={handleSelectRuleSet}
      onCreateRuleSet={handleCreateRuleSet}
      onDuplicateRuleSet={handleDuplicateRuleSet}
      onDeleteRuleSet={handleDeleteRuleSet}
      ruleSetName={activeSet.name}
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
        const nextBuiltIn = Object.fromEntries(
          BUILT_IN_RULES.map((r) => [r.find, enabled]),
        );
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
