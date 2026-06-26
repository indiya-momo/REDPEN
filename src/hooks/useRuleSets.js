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
import {
  criteriaNameForSave,
  LEGACY_DEFAULT_CRITERIA_HINT,
} from '../lib/criteriaName.js';
import { planCriteriaPresetDelete } from '../lib/criteriaPresetDelete.js';
import { showAppConfirm } from '../lib/appDialog.js';
import { formatProjectDialogLabel } from '../lib/projectDialogLabel.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';
import {
  mergeProjectContext,
} from '../lib/projectMeta.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveCloudActiveSetId,
  resolveHydratedActiveSetId,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import {
  canAddCriteriaPreset,
  CRITERIA_PRESET_LIMIT_MESSAGE,
  enforceMaxCriteriaPresets,
} from '../lib/criteriaPresetLimit.js';
import { mergeRuleSetsOnLogin, dedupeSavedRuleSetsByName, mergeLocalRuleSetSources } from '../lib/ruleSetsMerge.js';

const RULE_SET_AUTOSAVE_MS = 400;
const RULE_SET_CLOUD_SYNC_MS = 800;

function createDefaultSet() {
  return normalizeRuleSet({
    id: newId(),
    name: '',
    builtInEnabled: builtInEnabledFromSheet(),
    customRules: [],
    globalExcludePhrases: [],
    cautionEnabled: defaultCautionEnabled(),
  });
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet[]} rawSets */
function normalizeLoadedRuleSets(rawSets) {
  let sets = (rawSets ?? []).map((set) => {
    const normalized = normalizeRuleSet(set);
    const trimmedName = (normalized.name || '').trim();
    if (
      trimmedName === '기본 규칙 세트' ||
      trimmedName === LEGACY_DEFAULT_CRITERIA_HINT
    ) {
      return normalizeRuleSet({ ...normalized, name: '' });
    }
    return normalized;
  });
  if (!sets.length) {
    sets = [createDefaultSet()];
  }
  return sets;
}

/** @param {string} [authUid] @param {string} [authEmail] */
export function useRuleSets(authUid = '', authEmail = '') {
  const [ruleSets, setRuleSets] = useState([]);
  const [activeSetId, setActiveSetId] = useState(null);
  const [rulesReady, setRulesReady] = useState(false);

  const activeSetIdRef = useRef(activeSetId);
  const ruleSetsRef = useRef(ruleSets);
  const authUidRef = useRef(authUid);
  const authEmailRef = useRef(authEmail);
  const autosaveTimerRef = useRef(null);
  const cloudSyncTimerRef = useRef(null);
  const cloudHydratedUidRef = useRef('');
  const loadedAuthUidRef = useRef('');

  activeSetIdRef.current = activeSetId;
  ruleSetsRef.current = ruleSets;
  authUidRef.current = authUid;
  authEmailRef.current = authEmail;

  const flushCloudRuleSetsImmediate = useCallback(async () => {
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = null;
    }
    const uid = String(authUidRef.current ?? '').trim();
    if (!uid || !isRuleSetsCloudEnabled()) return;
    try {
      await saveRuleSetsCloud(uid, ruleSetsRef.current, activeSetIdRef.current);
    } catch (e) {
      console.warn('기준 클라우드 저장 실패', e);
    }
  }, []);

  const scheduleCloudRuleSetsSync = useCallback(() => {
    const uid = String(authUidRef.current ?? '').trim();
    if (!uid || !isRuleSetsCloudEnabled()) return;
    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }
    cloudSyncTimerRef.current = setTimeout(() => {
      cloudSyncTimerRef.current = null;
      void flushCloudRuleSetsImmediate();
    }, RULE_SET_CLOUD_SYNC_MS);
  }, [flushCloudRuleSetsImmediate]);

  const flushRuleSets = useCallback(
    (sets, setId = activeSetIdRef.current, uid = authUidRef.current) => {
      saveRuleSets(sets, uid);
      if (setId) saveActiveSetId(setId, uid);
      scheduleCloudRuleSetsSync();
    },
    [scheduleCloudRuleSetsSync],
  );

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
    void flushCloudRuleSetsImmediate();
  }, [flushRuleSets, flushCloudRuleSetsImmediate]);

  const flushPendingRuleSetsSaveAsync = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    flushRuleSets(ruleSetsRef.current, activeSetIdRef.current);
    await flushCloudRuleSetsImmediate();
  }, [flushRuleSets, flushCloudRuleSetsImmediate]);

  const applyProjectSwitch = useCallback(
    (setId, { reloadFromDisk = false } = {}) => {
      const id = String(setId ?? '').trim();
      if (!id) return;

      let sets = ruleSetsRef.current;
      if (reloadFromDisk || !sets.some((set) => set.id === id)) {
        sets = normalizeLoadedRuleSets(loadRuleSets(authUidRef.current));
      }
      if (!sets.some((set) => set.id === id)) return;

      const activeChanged = id !== activeSetIdRef.current;
      const setsChanged = sets !== ruleSetsRef.current;
      if (!activeChanged && !setsChanged) return;

      if (activeChanged) {
        flushPendingRuleSetsSave();
      }
      ruleSetsRef.current = sets;
      setRuleSets(sets);
      setActiveSetId(id);
      activeSetIdRef.current = id;
      saveActiveSetId(id, authUidRef.current);
      scheduleCloudRuleSetsSync();
    },
    [flushPendingRuleSetsSave, scheduleCloudRuleSetsSync],
  );

  useEffect(() => {
    const uid = String(authUidRef.current ?? '').trim();
    try {
      const sets = normalizeLoadedRuleSets(loadRuleSets(uid));
      const storedActive = loadActiveSetId(uid);
      const activeId =
        storedActive && sets.some((s) => s.id === storedActive)
          ? storedActive
          : sets[0]?.id;
      if (!activeId || !sets.length) {
        setRulesReady(true);
        return;
      }
      ruleSetsRef.current = sets;
      activeSetIdRef.current = activeId;
      loadedAuthUidRef.current = uid;
      saveRuleSets(sets, uid);
      saveActiveSetId(activeId, uid);
      setRuleSets(sets);
      setActiveSetId(activeId);
    } catch (e) {
      console.warn('규칙 세트 초기 로드 실패', e);
      const fallback = normalizeLoadedRuleSets([createDefaultSet()]);
      ruleSetsRef.current = fallback;
      activeSetIdRef.current = fallback[0].id;
      setRuleSets(fallback);
      setActiveSetId(fallback[0].id);
    } finally {
      setRulesReady(true);
    }
  }, []);

  // 로그인·로그아웃·계정 전환 — 이전 uid 데이터 저장 후 새 uid 네임스페이스 로드
  useEffect(() => {
    if (!rulesReady) return undefined;

    const uid = String(authUid ?? '').trim();
    const prev = loadedAuthUidRef.current;
    if (prev === uid) return undefined;

    let cancelled = false;

    (async () => {
      if (prev && ruleSetsRef.current.length) {
        saveRuleSets(ruleSetsRef.current, prev);
        if (activeSetIdRef.current) {
          saveActiveSetId(activeSetIdRef.current, prev);
        }
        if (isRuleSetsCloudEnabled()) {
          try {
            await saveRuleSetsCloud(
              prev,
              ruleSetsRef.current,
              activeSetIdRef.current,
            );
          } catch (e) {
            console.warn('기준 클라우드 저장 실패 (계정 전환)', e);
          }
        }
      }

      if (cancelled) return;

      loadedAuthUidRef.current = uid;
      cloudHydratedUidRef.current = '';

      const sets = normalizeLoadedRuleSets(loadRuleSets(uid));
      const storedActive = loadActiveSetId(uid);
      const activeId =
        storedActive && sets.some((s) => s.id === storedActive)
          ? storedActive
          : sets[0].id;

      ruleSetsRef.current = sets;
      activeSetIdRef.current = activeId;
      setRuleSets(sets);
      setActiveSetId(activeId);
      saveRuleSets(sets, uid);
      saveActiveSetId(activeId, uid);
    })();

    return () => {
      cancelled = true;
    };
  }, [authUid, rulesReady]);

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
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      ruleSetsRef.current = next;
      setRuleSets(next);
      setActiveSetId(nextActiveId);
      activeSetIdRef.current = nextActiveId;
      flushRuleSets(next, nextActiveId);
      void flushCloudRuleSetsImmediate();
    },
    [flushRuleSets, flushCloudRuleSetsImmediate],
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

  useEffect(() => {
    const uid = String(authUid ?? '').trim();
    if (!uid) {
      cloudHydratedUidRef.current = '';
      return undefined;
    }
    if (!isRuleSetsCloudEnabled() || !rulesReady) return undefined;
    if (cloudHydratedUidRef.current === uid) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const cloud = await loadRuleSetsCloud(uid);
        if (cancelled) return;

        if (cloud?.ruleSets?.length) {
          flushPendingRuleSetsSave();
          const diskSets = normalizeLoadedRuleSets(loadRuleSets(uid));
          const memorySets = normalizeLoadedRuleSets(ruleSetsRef.current);
          const localSets = mergeLocalRuleSetSources(diskSets, memorySets);
          const merged = mergeRuleSetsOnLogin(localSets, cloud.ruleSets);
          let sets = normalizeLoadedRuleSets(merged);
          sets = dedupeSavedRuleSetsByName(sets);
          sets = enforceMaxCriteriaPresets(
            sets,
            authUidRef.current,
            authEmailRef.current,
          );
          const activeId = resolveHydratedActiveSetId(
            sets,
            loadActiveSetId(uid),
            cloud.activeSetId,
          );
          if (!activeId) return;
          applyRuleSets(sets, activeId);
        } else {
          const localSets = normalizeLoadedRuleSets(loadRuleSets(uid));
          const activeId =
            resolveHydratedActiveSetId(localSets, loadActiveSetId(uid), null) ??
            localSets[0]?.id ??
            null;
          if (!activeId) return;
          applyRuleSets(localSets, activeId);
        }
        cloudHydratedUidRef.current = uid;
      } catch (e) {
        console.warn('기준 클라우드 불러오기 실패', e);
        cloudHydratedUidRef.current = uid;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUid, rulesReady, applyRuleSets, flushPendingRuleSetsSave]);

  const handleSelectRuleSet = useCallback(
    (id) => {
      if (!id || id === activeSetIdRef.current) return;
      if (!ruleSetsRef.current.some((s) => s.id === id)) return;
      applyProjectSwitch(id);
    },
    [applyProjectSwitch],
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

  const handleDeleteRuleSet = useCallback(async () => {
    const sets = ruleSetsRef.current;
    if (sets.length <= 1) {
      alert('마지막 규칙 세트는 삭제할 수 없습니다.');
      return;
    }
    const id = activeSetIdRef.current;
    const current = sets.find((s) => s.id === id);
    const label = (current?.name || '규칙 세트').trim() || '규칙 세트';
    if (
      !(await showAppConfirm({
        title: '삭제',
        message: `「${label}」 규칙 세트를 삭제할까요?`,
      }))
    ) {
      return;
    }

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
    async (rawName, saveOptions = {}) => {
      const sourceId = activeSetIdRef.current;
      const source = ruleSetsRef.current.find((s) => s.id === sourceId);
      if (!source) return false;

      const name = criteriaNameForSave(rawName);
      if (!name) {
        alert('프로젝트 이름을 입력해 주세요.');
        return false;
      }

      if (
        !canAddCriteriaPreset(
          ruleSetsRef.current,
          name,
          authUidRef.current,
          authEmailRef.current,
        )
      ) {
        alert(CRITERIA_PRESET_LIMIT_MESSAGE);
        return false;
      }

      flushPendingRuleSetsSave();

      const savedAt = new Date().toISOString();
      const sourceAfterFlush = ruleSetsRef.current.find((s) => s.id === sourceId);
      if (!sourceAfterFlush) return false;

      const config = {
        builtInEnabled: structuredClone(sourceAfterFlush.builtInEnabled ?? {}),
        cautionEnabled: structuredClone(sourceAfterFlush.cautionEnabled ?? {}),
        customRules: structuredClone(sourceAfterFlush.customRules ?? []),
        globalExcludePhrases: [...(sourceAfterFlush.globalExcludePhrases ?? [])],
        spellingRulesFingerprint: SPELLING_RULES_FP,
        cautionRulesFingerprint: sourceAfterFlush.cautionRulesFingerprint,
        cautionEnabledPolicyVersion: sourceAfterFlush.cautionEnabledPolicyVersion,
        compoundMigrateVersion: sourceAfterFlush.compoundMigrateVersion,
      };

      const existing = ruleSetsRef.current.find(
        (s) => (s.name || '').trim() === name,
      );

      const snapshot = saveOptions.projectContextSnapshot;
      const contextBase =
        existing?.projectContext ?? sourceAfterFlush.projectContext;
      const projectContext = snapshot
        ? mergeProjectContext(contextBase, snapshot)
        : contextBase;

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
                projectContext,
              })
            : s,
        );
      } else {
        const soleDraft =
          ruleSetsRef.current.length === 1 &&
          !ruleSetsRef.current[0]?.savedAt;
        if (soleDraft) {
          targetId = ruleSetsRef.current[0].id;
          next = ruleSetsRef.current.map((s) =>
            s.id === targetId
              ? normalizeRuleSet({
                  id: targetId,
                  name,
                  ...config,
                  savedAt,
                  projectContext,
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
            projectContext,
          });
          next = [...ruleSetsRef.current, created];
        }
      }

      ruleSetsRef.current = next;
      applyRuleSets(next, targetId);
      await flushCloudRuleSetsImmediate();

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
      return name;
    },
    [applyRuleSets, flushPendingRuleSetsSave, flushCloudRuleSetsImmediate],
  );

  /** active 저장 프로젝트의 PDF·작업 메타만 갱신 (검수 완료 debounce용) */
  const touchActiveProjectContext = useCallback(
    (patch) => {
      if (!patch || typeof patch !== 'object') return;
      const sourceId = activeSetIdRef.current;
      const sets = ruleSetsRef.current;
      const index = sets.findIndex((s) => s.id === sourceId);
      if (index < 0) return;
      const source = sets[index];
      if (!source.savedAt) return;

      const projectContext = mergeProjectContext(source.projectContext, {
        ...patch,
        lastWorkedAt: patch.lastWorkedAt ?? new Date().toISOString(),
      });
      const next = sets.map((s, i) =>
        i === index ? normalizeRuleSet({ ...s, projectContext }) : s,
      );
      ruleSetsRef.current = next;
      setRuleSets(next);
      scheduleRuleSetsSave(next);
    },
    [scheduleRuleSetsSave],
  );

  /** 저장한 기준 프리셋 삭제(목록·localStorage) */
  const handleDeleteCriteriaPreset = useCallback(
    async (targetId) => {
      const sets = ruleSetsRef.current;
      const plan = planCriteriaPresetDelete(
        sets,
        activeSetIdRef.current,
        targetId,
      );
      if (!plan.ok) {
        if (plan.reason === 'not_saved') {
          alert('저장된 기준만 삭제할 수 있습니다.');
        }
        return false;
      }

      if (
        !(await showAppConfirm({
          title: '삭제',
          message: `${formatProjectDialogLabel(plan.label)} 프로젝트를 삭제할까요?`,
        }))
      ) {
        return false;
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      let next = plan.next;
      let nextActiveId = plan.nextActiveId;
      if (plan.needsDefault) {
        const fresh = createDefaultSet();
        next = [fresh];
        nextActiveId = fresh.id;
      }

      applyRuleSets(next, nextActiveId);
      return true;
    },
    [applyRuleSets],
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
    handleDeleteCriteriaPreset,
    touchActiveProjectContext,
    handleBuiltInToggle,
    handleBuiltInSetAll,
    handleCautionToggle,
    handleCautionSetAll,
    flushPendingRuleSetsSave,
    flushPendingRuleSetsSaveAsync,
  };
}
