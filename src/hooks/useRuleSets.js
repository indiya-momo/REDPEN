import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultCautionEnabled,
  CAUTION_SEARCH_RULES,
} from '../lib/cautionRules.js';
import {
  SPELLING_RULES_FP,
  BUILT_IN_RULES,
  builtInEnabledKey,
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
  loadDeletedRuleSetIds,
  loadRuleSets,
  newId,
  RULE_SETS_LOCAL_SYNC_EVENT,
  ruleSetsStorageKey,
  saveActiveSetId,
  saveDeletedRuleSetIds,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import {
  criteriaNameForSave,
  LEGACY_DEFAULT_CRITERIA_HINT,
} from '../lib/criteriaName.js';
import { planCriteriaPresetDelete } from '../lib/criteriaPresetDelete.js';
import { planSaveCriteriaPreset } from '../lib/saveCriteriaPresetPlan.js';
import { showAppAlert, showAppConfirm } from '../lib/appDialog.js';
import { formatProjectDialogLabel } from '../lib/projectDialogLabel.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';
import { buildCriteriaCheckpoint } from '../lib/criteriaCheckpoint.js';
import {
  mergeProjectContext,
} from '../lib/projectMeta.js';
import { appendWorkHistoryEntry } from '../lib/projectWorkHistory.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveCloudActiveSetId,
  resolveHydratedActiveSetId,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import {
  canAddCriteriaPreset,
  formatCriteriaPresetLimitMessage,
  getMaxCriteriaPresets,
} from '../lib/criteriaPresetLimit.js';
import { getLocalUserPlan } from '../lib/userProfileStorage.js';
import {
  mergeRuleSetsOnLogin,
  applyCriteriaPresetQuota,
  applyTombstones,
  mergeLocalRuleSetSources,
  mergeRuleSetsOnPersist,
  mergeTombstones,
} from '../lib/ruleSetsMerge.js';

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

/**
 * @param {string} [authUid]
 * @param {string} [authEmail]
 * @param {{ profileSyncDone?: boolean }} [options]
 */
export function useRuleSets(authUid = '', authEmail = '', options = {}) {
  const { profileSyncDone = true } = options;
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
      const disk = loadRuleSets(uid);
      const merged = mergeRuleSetsOnPersist(disk, ruleSetsRef.current);
      ruleSetsRef.current = merged;
      const deletedIds = loadDeletedRuleSetIds(uid);
      await saveRuleSetsCloud(
        uid,
        merged,
        activeSetIdRef.current,
        deletedIds,
      );
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
    (
      sets,
      setId = activeSetIdRef.current,
      uid = authUidRef.current,
      intent = {},
    ) => {
      const disk = loadRuleSets(uid);
      const merged = mergeRuleSetsOnPersist(disk, sets, intent);
      ruleSetsRef.current = merged;
      if (JSON.stringify(merged) !== JSON.stringify(sets)) {
        setRuleSets(merged);
      }
      saveRuleSets(merged, uid);
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
  // plan 동기화 전에는 free=1로 trim하지 않는다.
  useEffect(() => {
    if (!rulesReady || !profileSyncDone) return undefined;

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
              loadDeletedRuleSetIds(prev),
            );
          } catch (e) {
            console.warn('기준 클라우드 저장 실패 (계정 전환)', e);
          }
        }
      }

      if (cancelled) return;

      loadedAuthUidRef.current = uid;
      cloudHydratedUidRef.current = '';

      let sets = normalizeLoadedRuleSets(loadRuleSets(uid));
      if (uid) {
        const tombstoned = applyTombstones(sets, loadDeletedRuleSetIds(uid));
        sets = normalizeLoadedRuleSets(tombstoned.sets);
        saveDeletedRuleSetIds(tombstoned.tombstones, uid);
        sets = applyCriteriaPresetQuota(
          sets,
          uid,
          authEmailRef.current,
          getLocalUserPlan(uid),
        );
      }
      const storedActive = loadActiveSetId(uid);
      const activeId =
        resolveHydratedActiveSetId(sets, storedActive, null) ??
        sets[0]?.id ??
        null;
      if (!activeId) return;

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
  }, [authUid, rulesReady, profileSyncDone]);

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

  useEffect(() => {
    if (!rulesReady) return undefined;

    const uid = String(authUid ?? '').trim();
    const storageKey = ruleSetsStorageKey(uid);

    const reloadFromStorage = () => {
      const diskSets = normalizeLoadedRuleSets(loadRuleSets(uid));
      const memorySets = normalizeLoadedRuleSets(ruleSetsRef.current);
      let sets = mergeLocalRuleSetSources(diskSets, memorySets);
      if (uid) {
        sets = applyCriteriaPresetQuota(
          sets,
          uid,
          authEmailRef.current,
          getLocalUserPlan(uid),
        );
      }
      const storedActive = loadActiveSetId(uid);
      const activeId =
        resolveHydratedActiveSetId(sets, storedActive, activeSetIdRef.current) ??
        sets[0]?.id ??
        null;

      ruleSetsRef.current = sets;
      activeSetIdRef.current = activeId;
      setRuleSets(sets);
      setActiveSetId(activeId);
    };

    const onStorage = (event) => {
      if (event.key !== storageKey || event.newValue == null) return;
      reloadFromStorage();
    };

    const onLocalSync = (event) => {
      const detailUid = String(
        /** @type {CustomEvent<{ uid?: string }>} */ (event).detail?.uid ?? '',
      ).trim();
      if (detailUid !== uid) return;
      reloadFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(RULE_SETS_LOCAL_SYNC_EVENT, onLocalSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RULE_SETS_LOCAL_SYNC_EVENT, onLocalSync);
    };
  }, [authUid, rulesReady]);

  const activeSet = rulesReady
    ? (ruleSets.find((s) => s.id === activeSetId) ?? ruleSets[0] ?? null)
    : null;

  const updateActiveSet = useCallback(
    (patch) => {
      const setId = activeSetIdRef.current;
      if (!setId) return;
      setRuleSets((prev) => {
        const next = prev.map((s) => {
          if (s.id !== setId) return s;
          const touchesCriteria =
            patch.builtInEnabled !== undefined ||
            patch.cautionEnabled !== undefined ||
            patch.customRules !== undefined ||
            patch.consistencyDecisions !== undefined;
          const savedAtBump =
            s.savedAt && touchesCriteria
              ? { savedAt: new Date().toISOString() }
              : {};
          return { ...s, ...patch, ...savedAtBump };
        });
        scheduleRuleSetsSave(next);
        return next;
      });
    },
    [scheduleRuleSetsSave],
  );

  const applyRuleSets = useCallback(
    (next, nextActiveId = activeSetIdRef.current, intent = {}) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      ruleSetsRef.current = next;
      setRuleSets(next);
      setActiveSetId(nextActiveId);
      activeSetIdRef.current = nextActiveId;
      flushRuleSets(next, nextActiveId, authUidRef.current, intent);
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
    if (!isRuleSetsCloudEnabled() || !rulesReady || !profileSyncDone) {
      return undefined;
    }
    if (cloudHydratedUidRef.current === uid) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const cloud = await loadRuleSetsCloud(uid);
        if (cancelled) return;

        if (cloud?.ruleSets?.length) {
          if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
          }
          const diskSets = normalizeLoadedRuleSets(loadRuleSets(uid));
          const memorySets = normalizeLoadedRuleSets(ruleSetsRef.current);
          const localSets = mergeLocalRuleSetSources(diskSets, memorySets);
          const merged = mergeRuleSetsOnLogin(localSets, cloud.ruleSets);
          let tombstones = mergeTombstones(
            loadDeletedRuleSetIds(uid),
            cloud.deletedIds,
          );
          const tombstoned = applyTombstones(merged, tombstones);
          let sets = normalizeLoadedRuleSets(tombstoned.sets);
          tombstones = tombstoned.tombstones;
          saveDeletedRuleSetIds(tombstones, uid);
          sets = applyCriteriaPresetQuota(
            sets,
            authUidRef.current,
            authEmailRef.current,
            getLocalUserPlan(authUidRef.current),
          );
          const activeId = resolveHydratedActiveSetId(
            sets,
            loadActiveSetId(uid),
            cloud.activeSetId,
          );
          if (!activeId) return;
          applyRuleSets(sets, activeId);
        } else {
          let tombstones = loadDeletedRuleSetIds(uid);
          let localSets = normalizeLoadedRuleSets(loadRuleSets(uid));
          const tombstoned = applyTombstones(localSets, tombstones);
          localSets = normalizeLoadedRuleSets(tombstoned.sets);
          saveDeletedRuleSetIds(tombstoned.tombstones, uid);
          localSets = applyCriteriaPresetQuota(
            localSets,
            authUidRef.current,
            authEmailRef.current,
            getLocalUserPlan(authUidRef.current),
          );
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
  }, [authUid, rulesReady, profileSyncDone, applyRuleSets, flushPendingRuleSetsSave]);

  // 초기 로드·계정 전환이 plan 동기화 전에 끝났을 때 슬롯 상한 재적용
  useEffect(() => {
    if (!rulesReady || !profileSyncDone) return;
    const uid = String(authUid ?? '').trim();
    if (!uid) return;
    const plan = getLocalUserPlan(uid);
    const next = applyCriteriaPresetQuota(
      normalizeLoadedRuleSets(ruleSetsRef.current),
      uid,
      authEmailRef.current,
      plan,
    );
    const beforeIds = ruleSetsRef.current.map((s) => s.id).join(',');
    const afterIds = next.map((s) => s.id).join(',');
    if (beforeIds === afterIds) return;
    const activeId =
      resolveHydratedActiveSetId(
        next,
        activeSetIdRef.current,
        activeSetIdRef.current,
      ) ?? next[0]?.id;
    if (!activeId) return;
    applyRuleSets(next, activeId);
  }, [rulesReady, profileSyncDone, authUid, applyRuleSets]);

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
    const uid = authUidRef.current;
    const email = authEmailRef.current;
    const plan = getLocalUserPlan(uid);
    if (!canAddCriteriaPreset(ruleSetsRef.current, copy.name, uid, email, plan)) {
      void showAppAlert({
        title: '저장 한도',
        message: formatCriteriaPresetLimitMessage(
          getMaxCriteriaPresets(uid, email, plan),
        ),
      });
      return;
    }
    applyRuleSets([...ruleSetsRef.current, copy], copy.id, {
      added: [copy.id],
    });
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

    const uid = String(authUidRef.current ?? '').trim();
    if (current?.savedAt) {
      const tombstones = mergeTombstones(loadDeletedRuleSetIds(uid), [
        { id, deletedAt: new Date().toISOString() },
      ]);
      saveDeletedRuleSetIds(tombstones, uid);
    }
    applyRuleSets(next, nextActive, { removed: [id] });
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
          getLocalUserPlan(authUidRef.current),
        )
      ) {
        await showAppAlert({
          title: '저장 한도',
          message: formatCriteriaPresetLimitMessage(
            getMaxCriteriaPresets(
              authUidRef.current,
              authEmailRef.current,
              getLocalUserPlan(authUidRef.current),
            ),
          ),
        });
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
        consistencyDecisions: structuredClone(
          sourceAfterFlush.consistencyDecisions ?? [],
        ),
        spellingRulesFingerprint: SPELLING_RULES_FP,
        cautionRulesFingerprint: sourceAfterFlush.cautionRulesFingerprint,
        cautionEnabledPolicyVersion: sourceAfterFlush.cautionEnabledPolicyVersion,
        compoundMigrateVersion: sourceAfterFlush.compoundMigrateVersion,
      };
      const criteriaCheckpoint = buildCriteriaCheckpoint(config);

      // 저장 대상은 "지금 작업 중인 프로젝트(sourceId)" 기준으로 정한다.
      // 이름이 다른 프로젝트와 겹치면 덮어쓰지 않고 막아 원본을 보호한다.
      const plan = planSaveCriteriaPreset(ruleSetsRef.current, {
        sourceId,
        name,
        config,
        savedAt,
        criteriaCheckpoint,
        projectContextSnapshot: saveOptions.projectContextSnapshot ?? null,
      });
      if (!plan.ok) {
        if (plan.reason === 'duplicate_name') {
          await showAppAlert({
            title: '저장',
            message: '같은 이름의 프로젝트가 이미 있습니다.',
          });
        }
        return false;
      }
      const { next, targetId } = plan;
      const persistIntent = plan.intent;

      ruleSetsRef.current = next;
      applyRuleSets(next, targetId, persistIntent);
      await flushCloudRuleSetsImmediate();

      const persisted = ruleSetsRef.current.find((s) => s.id === targetId);
      const persistedName = criteriaNameForSave(persisted?.name);
      if (!persisted?.savedAt || persistedName !== name) {
        console.warn('[rulesets] save vanished after merge', {
          targetId,
          name,
          persistedName: persisted?.name,
        });
        alert(
          '프로젝트 저장에 실패했습니다. 잠시 후 다시 저장해 주세요.',
        );
        return false;
      }

      trackRulesetSaved({
        builtinCount: countBuiltInActiveRules({
          builtInEnabled: persisted.builtInEnabled,
        }),
        spacingCount: countSpacingReviewActiveRules({
          cautionEnabled: persisted.cautionEnabled,
        }),
        consistencyCount: countConsistencyActiveRules(persisted.customRules),
      });
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

      const lastWorkedAt = patch.lastWorkedAt ?? new Date().toISOString();
      const projectContext = mergeProjectContext(source.projectContext, {
        ...patch,
        lastWorkedAt,
      });
      // 검수 1회 커밋일 때만 이력 장부에 한 줄 기입 (debounce 갱신은 메타만)
      // spelling = 맞춤법 규칙만, loanword = 외래어 표기법 (합산하지 않음)
      const workHistory = patch.commitWorkHistory
        ? appendWorkHistoryEntry(
            source.workHistory,
            {
              editorReview: patch.lastEditorReviewFindingCount,
              spelling:
                patch.lastBuiltinSpellingFindingCount ??
                patch.lastSpellingFindingCount,
              loanword: patch.lastLoanwordFindingCount,
              consistencyFind: patch.lastConsistencyFindCount,
              consistencyUnify: patch.lastConsistencyUnifyCount,
              consistencyCommonString: patch.lastConsistencyCommonStringCount,
              consistency: patch.lastConsistencyFindingCount,
              bonBojo: patch.lastBonBojoFindingCount,
            },
            lastWorkedAt,
          )
        : source.workHistory;
      const next = sets.map((s, i) =>
        i === index
          ? normalizeRuleSet({ ...s, projectContext, workHistory })
          : s,
      );
      ruleSetsRef.current = next;
      setRuleSets(next);
      // 검수 1회 커밋은 마이페이지 창이 storage 이벤트로 바로 읽도록 즉시 flush
      if (patch.commitWorkHistory) {
        flushPendingRuleSetsSave();
      } else {
        scheduleRuleSetsSave(next);
      }
    },
    [flushPendingRuleSetsSave, scheduleRuleSetsSave],
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

      const uid = String(authUidRef.current ?? '').trim();
      const tombstones = mergeTombstones(loadDeletedRuleSetIds(uid), [
        { id: targetId, deletedAt: new Date().toISOString() },
      ]);
      saveDeletedRuleSetIds(tombstones, uid);
      applyRuleSets(next, nextActiveId, { removed: [targetId] });
      return true;
    },
    [applyRuleSets],
  );

  const handleBuiltInToggle = useCallback(
    (enabledKey) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
      const prev = activeSet.builtInEnabled ?? builtInEnabledFromSheet();
      const on = prev[enabledKey] === true;
      const nextBuiltIn = { ...prev, [enabledKey]: !on };
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
    /**
     * @param {boolean} enabled
     * @param {import('../lib/ruleTypes.js').Rule[]} [targetRules]
     *   패널별 부분 선택(맞춤법 규칙 / 외래어 표기법). 없으면 전체.
     */
    (enabled, targetRules) => {
      const activeSet = ruleSetsRef.current.find(
        (s) => s.id === activeSetIdRef.current,
      );
      if (!activeSet) return;
      const prev = activeSet.builtInEnabled ?? builtInEnabledFromSheet();
      const nextBuiltIn = { ...prev };
      for (const r of targetRules ?? BUILT_IN_RULES) {
        if (countsTowardSpellingQuota(r)) {
          nextBuiltIn[builtInEnabledKey(r)] = enabled;
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
