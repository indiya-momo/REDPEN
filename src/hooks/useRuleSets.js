import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultCautionEnabled,
  CAUTION_SEARCH_RULES,
} from '../lib/cautionRules.js';
import {
  SPELLING_RULES_FP,
  BUILT_IN_RULES,
  countsTowardSpellingQuota,
  builtInEnabledFromSheet,
} from '../lib/builtInRules.js';
import {
  countActiveRules,
  countBuiltInActiveRules,
  countConsistencyActiveRules,
  countSpacingReviewActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
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
const DEFAULT_SET_LABEL = '선택한 맞춤법 /일관성 기준을 저장합니다';

function createDefaultSet() {
  return normalizeRuleSet({
    id: newId(),
    name: DEFAULT_SET_LABEL,
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

  const flushPendingRuleSetsSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    flushRuleSets(ruleSetsRef.current, activeSetIdRef.current);
  }, [flushRuleSets]);

  useEffect(() => {
    let sets = loadRuleSets().map((set) => {
      const normalized = normalizeRuleSet(set);
      if ((normalized.name || '').trim() === '기본 규칙 세트') {
        return normalizeRuleSet({ ...normalized, name: DEFAULT_SET_LABEL });
      }
      return normalized;
    });
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
      flushPendingRuleSetsSave();
    };
  }, [flushPendingRuleSetsSave]);

  useEffect(() => {
    const onPageLeave = () => {
      flushPendingRuleSetsSave();
    };
    window.addEventListener('pagehide', onPageLeave);
    window.addEventListener('beforeunload', onPageLeave);
    return () => {
      window.removeEventListener('pagehide', onPageLeave);
      window.removeEventListener('beforeunload', onPageLeave);
    };
  }, [flushPendingRuleSetsSave]);

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

  /** 현재 기준을 이름 붙여 목록에 저장(동일 이름이면 덮어쓰기) */
  const handleSaveCriteriaPreset = useCallback(
    (rawName) => {
      const sourceId = activeSetIdRef.current;
      const source = ruleSetsRef.current.find((s) => s.id === sourceId);
      if (!source) return false;

      const name = String(rawName ?? '').trim();
      if (!name) {
        alert('기준 이름을 입력해 주세요.');
        return false;
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      const savedAt = new Date().toISOString();
      const config = {
        builtInEnabled: structuredClone(source.builtInEnabled ?? {}),
        cautionEnabled: structuredClone(source.cautionEnabled ?? {}),
        customRules: structuredClone(source.customRules ?? []),
        globalExcludePhrases: [...(source.globalExcludePhrases ?? [])],
        spellingRulesFingerprint: SPELLING_RULES_FP,
        cautionRulesFingerprint: source.cautionRulesFingerprint,
        cautionEnabledPolicyVersion: source.cautionEnabledPolicyVersion,
        compoundMigrateVersion: source.compoundMigrateVersion,
      };

      const existing = ruleSetsRef.current.find(
        (s) => (s.name || '').trim() === name,
      );

      let next;
      let targetId;
      if (existing) {
        targetId = existing.id;
        next = ruleSetsRef.current.map((s) =>
          s.id === existing.id
            ? normalizeRuleSet({
                ...s,
                ...config,
                name,
                savedAt,
              })
            : s,
        );
      } else {
        targetId = newId();
        const created = normalizeRuleSet({
          id: targetId,
          name,
          ...config,
          savedAt,
        });
        next = [...ruleSetsRef.current, created];
      }

      ruleSetsRef.current = next;
      setRuleSets(next);
      flushRuleSets(next, targetId);
      setActiveSetId(targetId);
      activeSetIdRef.current = targetId;

      const saved = next.find((s) => s.id === targetId);
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
      alert('기준이 저장되었습니다.');
      return true;
    },
    [flushRuleSets],
  );

  const handleBuiltInToggle = useCallback(
    (find) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
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
    },
    [updateActiveSet],
  );

  const handleBuiltInSetAll = useCallback(
    (enabled) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
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
    },
    [updateActiveSet],
  );

  const handleCautionToggle = useCallback(
    (id) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
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
    },
    [updateActiveSet],
  );

  const handleCautionSetAll = useCallback(
    (enabled) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
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
    },
    [updateActiveSet],
  );

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
    handleSaveCriteriaPreset,
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
  };
}
