import { useCallback, useEffect, useRef, useState } from 'react';
import { LEGACY_DEFAULT_CRITERIA_HINT } from '../lib/criteriaName.js';
import {
  countSavedCriteriaPresets,
  formatCriteriaPresetLimitMessage,
  getMaxCriteriaPresets,
  MAX_CRITERIA_PRESETS_FREE,
} from '../lib/criteriaPresetLimit.js';
import { getLocalUserPlan } from '../lib/userProfileStorage.js';
import { ensureLocalPlanFromCloud } from '../lib/userProfileCloud.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';
import { buildCriteriaCheckpoint } from '../lib/criteriaCheckpoint.js';
import {
  loadActiveSetId,
  loadDeletedRuleSetIds,
  loadRuleSets,
  ruleSetsStorageKey,
  RULE_SETS_LOCAL_SYNC_EVENT,
  saveActiveSetId,
  saveDeletedRuleSetIds,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveHydratedActiveSetId,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import {
  mergeRuleSetsOnLogin,
  applyCriteriaPresetQuota,
  applyTombstones,
  mergeRuleSetsOnPersist,
  mergeTombstones,
  mergeLocalRuleSetSources,
} from '../lib/ruleSetsMerge.js';
import { mergeProjectContext } from '../lib/projectMeta.js';
import { planProjectCriteriaUpdate } from '../lib/projectCriteriaUpdate.js';
import { planProjectCustomRulesUpdate } from '../lib/projectCustomRulesUpdate.js';
import {
  planDeleteProject,
  planDuplicateProject,
  planRenameProject,
} from '../lib/mypageProjectMutations.js';

/** @param {import('../lib/ruleSetsStorage.js').RuleSet[]} sets */
function syncSavedProjectsState(sets, setProjects, setSavedCount) {
  const saved = sets.filter((set) => Boolean(set.savedAt));
  setProjects(saved);
  setSavedCount(countSavedCriteriaPresets(sets));
}

const RENAME_FAILURE_MESSAGE = {
  empty_name: '프로젝트 이름을 입력해 주세요.',
  duplicate_name: '같은 이름의 프로젝트가 이미 있습니다.',
  not_found: '프로젝트를 찾을 수 없습니다.',
  not_saved: '저장된 프로젝트만 수정할 수 있습니다.',
};

const DUPLICATE_FAILURE_MESSAGE = {
  not_found: '프로젝트를 찾을 수 없습니다.',
  not_saved: '저장된 프로젝트만 복제할 수 있습니다.',
  slot_limit: formatCriteriaPresetLimitMessage(MAX_CRITERIA_PRESETS_FREE),
};

const DELETE_FAILURE_MESSAGE = {
  not_found: '프로젝트를 찾을 수 없습니다.',
  not_saved: '저장된 프로젝트만 삭제할 수 있습니다.',
};

/** @param {import('../lib/ruleSetsStorage.js').RuleSet[]} rawSets */
function normalizeLoadedSets(rawSets) {
  return (rawSets ?? []).map((set) => {
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
}

/**
 * 마이페이지용 저장 프로젝트(기준 프리셋) 읽기 전용 로드
 * @param {string} [uid]
 * @param {string} [email]
 */
/**
 * @param {string} [uid]
 * @param {string} [email]
 * @param {{ profileSyncDone?: boolean }} [options]
 */
export function useMyPageProjects(uid = '', email = '', options = {}) {
  const { profileSyncDone = true } = options;
  const [projects, setProjects] = useState(
    /** @type {import('../lib/ruleSetsStorage.js').RuleSet[]} */ ([]),
  );
  const [activeSetId, setActiveSetId] = useState(
    /** @type {string | null} */ (null),
  );
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadedSetsRef = useRef(
    /** @type {import('../lib/ruleSetsStorage.js').RuleSet[]} */ ([]),
  );
  const activeSetIdRef = useRef(/** @type {string | null} */ (null));

  activeSetIdRef.current = activeSetId;

  const persistProjectSets = useCallback(
    async (
      nextSets,
      nextActiveId = activeSetIdRef.current,
      intent = {},
      tombstones = null,
    ) => {
      const trimmedUid = uid.trim();
      const disk = loadRuleSets(trimmedUid);
      const merged = mergeRuleSetsOnPersist(disk, nextSets, intent);
      loadedSetsRef.current = merged;
      saveRuleSets(merged, trimmedUid);

      if (Array.isArray(tombstones)) {
        saveDeletedRuleSetIds(tombstones, trimmedUid);
      }

      if (nextActiveId) {
        saveActiveSetId(nextActiveId, trimmedUid);
        activeSetIdRef.current = nextActiveId;
        setActiveSetId(nextActiveId);
      }

      syncSavedProjectsState(merged, setProjects, setSavedCount);

      if (trimmedUid && isRuleSetsCloudEnabled()) {
        try {
          await saveRuleSetsCloud(
            trimmedUid,
            merged,
            nextActiveId,
            Array.isArray(tombstones) ? tombstones : undefined,
          );
        } catch (e) {
          console.warn('기준 클라우드 저장 실패 (마이페이지)', e);
          return false;
        }
      }
      return true;
    },
    [uid],
  );

  useEffect(() => {
    if (!profileSyncDone) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const trimmedUid = uid.trim();
        const localSets = normalizeLoadedSets(loadRuleSets(trimmedUid));
        let sets = localSets;
        let activeId = loadActiveSetId(trimmedUid);
        let cloudActiveId = null;
        let tombstones = loadDeletedRuleSetIds(trimmedUid);

        if (trimmedUid && isRuleSetsCloudEnabled()) {
          try {
            const cloud = await loadRuleSetsCloud(trimmedUid);
            if (cloud?.ruleSets?.length) {
              sets = normalizeLoadedSets(
                mergeRuleSetsOnLogin(localSets, cloud.ruleSets),
              );
              cloudActiveId = cloud.activeSetId;
              tombstones = mergeTombstones(tombstones, cloud.deletedIds);
            }
          } catch {
            // 로컬 기준 유지
          }
        }

        // 삭제 기록(툼스톤) 적용 — 삭제된 프로젝트가 클라우드에서 되살아나지 않게 한다.
        sets = applyTombstones(sets, tombstones).sets;

        const userPlan = await ensureLocalPlanFromCloud(trimmedUid);
        const beforeIds = sets.map((set) => set.id).join(',');
        sets = applyCriteriaPresetQuota(
          sets,
          trimmedUid,
          email,
          userPlan,
        );
        activeId = resolveHydratedActiveSetId(sets, activeId, cloudActiveId);
        const quotaTrimmed = beforeIds !== sets.map((set) => set.id).join(',');

        if (quotaTrimmed) {
          saveRuleSets(sets, trimmedUid);
          if (activeId) saveActiveSetId(activeId, trimmedUid);
          if (trimmedUid && isRuleSetsCloudEnabled()) {
            try {
              await saveRuleSetsCloud(trimmedUid, sets, activeId);
            } catch (e) {
              console.warn('프로젝트 슬롯 상한 적용 후 클라우드 저장 실패', e);
            }
          }
        }

        loadedSetsRef.current = sets;
        activeSetIdRef.current = activeId;
        const saved = sets.filter((s) => Boolean(s.savedAt));
        if (!cancelled) {
          setProjects(saved);
          setActiveSetId(activeId);
          setSavedCount(countSavedCriteriaPresets(sets));
        }
      } catch (e) {
        console.warn('마이페이지 프로젝트 로드 실패', e);
        if (!cancelled) {
          loadedSetsRef.current = [];
          activeSetIdRef.current = null;
          setProjects([]);
          setActiveSetId(null);
          setSavedCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, email, profileSyncDone]);

  useEffect(() => {
    const trimmedUid = uid.trim();
    const storageKey = ruleSetsStorageKey(trimmedUid);

    const reloadFromStorage = () => {
      try {
        const diskSets = normalizeLoadedSets(loadRuleSets(trimmedUid));
        let sets = mergeLocalRuleSetSources(
          diskSets,
          loadedSetsRef.current,
        );
        const beforeIds = sets.map((set) => set.id).join(',');
        sets = applyCriteriaPresetQuota(
          sets,
          trimmedUid,
          email,
          getLocalUserPlan(trimmedUid),
        );
        const activeId = resolveHydratedActiveSetId(
          sets,
          loadActiveSetId(trimmedUid),
          activeSetIdRef.current,
        );

        loadedSetsRef.current = sets;
        activeSetIdRef.current = activeId;
        const saved = sets.filter((s) => Boolean(s.savedAt));
        setProjects(saved);
        setActiveSetId(activeId);
        setSavedCount(countSavedCriteriaPresets(sets));

        if (beforeIds !== sets.map((set) => set.id).join(',')) {
          saveRuleSets(sets, trimmedUid);
          if (activeId) saveActiveSetId(activeId, trimmedUid);
        }
      } catch (e) {
        console.warn('마이페이지 프로젝트 storage 동기화 실패', e);
      }
    };

    const onStorage = (event) => {
      if (event.key !== storageKey || event.newValue == null) return;
      reloadFromStorage();
    };

    const onLocalSync = (event) => {
      const detailUid = String(
        /** @type {CustomEvent<{ uid?: string }>} */ (event).detail?.uid ?? '',
      ).trim();
      if (detailUid !== trimmedUid) return;
      reloadFromStorage();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(RULE_SETS_LOCAL_SYNC_EVENT, onLocalSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(RULE_SETS_LOCAL_SYNC_EVENT, onLocalSync);
    };
  }, [uid, email]);

  const selectProject = useCallback(
    async (setId) => {
      const id = String(setId ?? '').trim();
      if (!id || !loadedSetsRef.current.some((set) => set.id === id)) {
        return { ok: false, reason: 'not_found' };
      }
      const ok = await persistProjectSets(loadedSetsRef.current, id);
      if (ok) return { ok: true };
      // persistProjectSets는 로컬 activeSetId·ruleSets를 먼저 저장한다.
      // 클라우드만 실패해도 검수 화면 전환은 막지 않는다(useRuleSets와 동일).
      if (activeSetIdRef.current === id) {
        return { ok: true, reason: 'cloud_save_failed' };
      }
      return { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets],
  );

  const renameProject = useCallback(
    async (setId, rawName) => {
      const id = String(setId ?? '').trim();
      const plan = planRenameProject(loadedSetsRef.current, id, rawName);
      if (!plan.ok) {
        return {
          ok: false,
          reason: plan.reason,
          message: RENAME_FAILURE_MESSAGE[plan.reason],
        };
      }
      if (plan.unchanged) return { ok: true };

      const ok = await persistProjectSets(plan.next);
      return ok
        ? { ok: true, label: plan.label }
        : { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets],
  );

  const duplicateProject = useCallback(
    async (setId) => {
      const id = String(setId ?? '').trim();
      const trimmedUid = uid.trim();
      const userPlan = trimmedUid
        ? await ensureLocalPlanFromCloud(trimmedUid)
        : 'free';
      const plan = planDuplicateProject(
        loadedSetsRef.current,
        id,
        trimmedUid,
        email,
        userPlan,
      );
      if (!plan.ok) {
        return {
          ok: false,
          reason: plan.reason,
          message:
            plan.message ?? DUPLICATE_FAILURE_MESSAGE[plan.reason],
        };
      }

      const ok = await persistProjectSets(plan.next, plan.newSetId, {
        added: [plan.newSetId],
      });
      return ok
        ? { ok: true, newSetId: plan.newSetId, label: plan.label }
        : { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets, uid, email],
  );

  const deleteProject = useCallback(
    async (setId) => {
      const id = String(setId ?? '').trim();
      const plan = planDeleteProject(
        loadedSetsRef.current,
        activeSetIdRef.current,
        id,
      );
      if (!plan.ok) {
        return {
          ok: false,
          reason: plan.reason,
          message: DELETE_FAILURE_MESSAGE[plan.reason],
        };
      }

      // 삭제 기록(툼스톤) — 나갔다 들어와도 클라우드에서 되살아나지 않게 한다.
      const tombstones = mergeTombstones(loadDeletedRuleSetIds(uid.trim()), [
        { id, deletedAt: new Date().toISOString() },
      ]);
      const ok = await persistProjectSets(
        plan.next,
        plan.nextActiveId,
        { removed: [id] },
        tombstones,
      );
      return ok
        ? { ok: true, label: plan.label }
        : { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets, uid],
  );

  const updateProjectCustomRules = useCallback(
    async (setId, nextCustomRules) => {
      const id = String(setId ?? '').trim();
      if (!id) return false;

      const sets = loadedSetsRef.current;
      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return false;

      const current = sets[index];
      const plan = planProjectCustomRulesUpdate(current, nextCustomRules);
      if (!plan.ok) {
        return false;
      }

      const nextSet = normalizeRuleSet({
        ...current,
        customRules: plan.nextCustomRules,
        ...(current.savedAt ? { savedAt: new Date().toISOString() } : {}),
      });
      const nextSets = sets.map((set, i) => (i === index ? nextSet : set));
      return persistProjectSets(nextSets);
    },
    [persistProjectSets],
  );

  const updateProjectCriteria = useCallback(
    async (setId, patch) => {
      const id = String(setId ?? '').trim();
      if (!id) return false;

      const sets = loadedSetsRef.current;
      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return false;

      const current = sets[index];
      const plan = planProjectCriteriaUpdate(current, patch);
      if (!plan.ok) {
        return false;
      }

      const nextSet = normalizeRuleSet({
        ...current,
        ...plan.patch,
        ...(current.savedAt ? { savedAt: new Date().toISOString() } : {}),
      });
      const withCheckpoint = normalizeRuleSet({
        ...nextSet,
        criteriaCheckpoint: buildCriteriaCheckpoint(nextSet),
      });
      const nextSets = sets.map((set, i) =>
        i === index ? withCheckpoint : set,
      );
      return persistProjectSets(nextSets);
    },
    [persistProjectSets],
  );

  const updateProjectMeta = useCallback(
    async (setId, patch) => {
      const id = String(setId ?? '').trim();
      if (!id) return { ok: false, reason: 'not_found' };

      let sets = loadedSetsRef.current;

      if (patch.name !== undefined) {
        const renamePlan = planRenameProject(sets, id, patch.name);
        if (!renamePlan.ok) {
          return {
            ok: false,
            reason: renamePlan.reason,
            message: RENAME_FAILURE_MESSAGE[renamePlan.reason],
          };
        }
        sets = renamePlan.next;
      }

      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return { ok: false, reason: 'not_found' };

      const current = sets[index];
      const nextProjectContext =
        patch.formatLabel !== undefined
          ? mergeProjectContext(current.projectContext, {
              formatLabel: patch.formatLabel,
            })
          : current.projectContext;
      const touchesMeta =
        patch.tags !== undefined ||
        patch.memo !== undefined ||
        patch.pillarMemos !== undefined ||
        patch.formatLabel !== undefined;
      const nextSet = normalizeRuleSet({
        ...current,
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
        ...(patch.pillarMemos !== undefined
          ? { pillarMemos: patch.pillarMemos }
          : {}),
        ...(nextProjectContext !== undefined
          ? { projectContext: nextProjectContext }
          : {}),
        ...(touchesMeta
          ? { metaUpdatedAt: new Date().toISOString() }
          : {}),
      });
      const nextSets = sets.map((set, i) => (i === index ? nextSet : set));
      const ok = await persistProjectSets(nextSets);
      return ok ? { ok: true } : { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets],
  );

  const userPlan = getLocalUserPlan(uid);
  const maxSlots = getMaxCriteriaPresets(uid, email, userPlan);
  const exempt = maxSlots == null;
  const emptySlotCount = exempt
    ? 0
    : Math.max(0, maxSlots - savedCount);

  return {
    projects,
    activeSetId,
    loading,
    selectProject,
    renameProject,
    duplicateProject,
    deleteProject,
    updateProjectMeta,
    updateProjectCustomRules,
    updateProjectCriteria,
    savedCount,
    maxSlots,
    exempt,
    emptySlotCount,
    atSlotLimit: !exempt && savedCount >= maxSlots,
    userPlan,
  };
}
