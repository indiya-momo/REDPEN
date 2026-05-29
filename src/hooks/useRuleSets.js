import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultCautionEnabled } from '../lib/cautionRules.js';
import {
  SPELLING_RULES_FP,
  builtInEnabledFromSheet,
} from '../lib/builtInRules.js';
import {
  countBuiltInActiveRules,
  countConsistencyActiveRules,
  countSpacingReviewActiveRules,
} from '../lib/activeRuleCount.js';
import { trackRulesetSaved } from '../lib/analytics.js';
import {
  duplicateRuleSet,
  loadActiveSetId,
  loadRuleSets,
  newId,
  saveActiveSetId,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';

const RULE_SET_AUTOSAVE_MS = 400;

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

export function useRuleSets() {
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

  // 시트 sync 후 지문이 안 맞는 저장분만 1회 보정. ruleSets는 deps에 넣지 않음
  // (applyRuleSets → setRuleSets 재실행이 effect를 다시 깨우는 패턴 방지).
  useEffect(() => {
    if (!rulesReady) return;

    const current = ruleSetsRef.current;
    if (!current.length) return;
    if (
      !current.some((s) => s.spellingRulesFingerprint !== SPELLING_RULES_FP)
    ) {
      return;
    }

    const next = current.map(normalizeRuleSet);
    const nextActive =
      activeSetIdRef.current && next.some((s) => s.id === activeSetIdRef.current)
        ? activeSetIdRef.current
        : next[0]?.id;
    if (!nextActive) return;

    applyRuleSets(next, nextActive);
  }, [rulesReady, applyRuleSets]);

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

  const handleSaveRules = useCallback(() => {
    const setId = activeSetIdRef.current;
    if (!setId) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const savedAt = new Date().toISOString();
    const next = ruleSetsRef.current.map((s) =>
      s.id === setId
        ? { ...s, spellingRulesFingerprint: SPELLING_RULES_FP, savedAt }
        : s,
    );
    ruleSetsRef.current = next;
    setRuleSets(next);
    flushRuleSets(next, setId);
    const saved = next.find((s) => s.id === setId);
    if (saved) {
      trackRulesetSaved({
        builtinCount: countBuiltInActiveRules({
          builtInEnabled: saved.builtInEnabled,
        }),
        spacingCount: countSpacingReviewActiveRules({
          cautionEnabled: saved.cautionEnabled,
        }),
        consistencyCount: countConsistencyActiveRules(saved.customRules),
      });
    }
    alert('규칙 세트가 저장되었습니다.');
  }, [flushRuleSets]);

  return {
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
  };
}
