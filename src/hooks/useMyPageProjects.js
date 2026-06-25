import { useCallback, useEffect, useRef, useState } from 'react';
import { LEGACY_DEFAULT_CRITERIA_HINT } from '../lib/criteriaName.js';
import {
  countSavedCriteriaPresets,
  CRITERIA_PRESET_LIMIT_MESSAGE,
  enforceMaxCriteriaPresets,
  isCriteriaPresetLimitExempt,
  MAX_CRITERIA_PRESETS,
} from '../lib/criteriaPresetLimit.js';
import { normalizeRuleSet } from '../lib/ruleSetNormalize.js';
import {
  loadActiveSetId,
  loadRuleSets,
  saveActiveSetId,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  resolveHydratedActiveSetId,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import { mergeRuleSetsOnLogin, dedupeSavedRuleSetsByName } from '../lib/ruleSetsMerge.js';
import { mergeProjectContext } from '../lib/projectMeta.js';
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
  slot_limit: CRITERIA_PRESET_LIMIT_MESSAGE,
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
export function useMyPageProjects(uid = '', email = '') {
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
    async (nextSets, nextActiveId = activeSetIdRef.current) => {
      const trimmedUid = uid.trim();
      loadedSetsRef.current = nextSets;
      saveRuleSets(nextSets, trimmedUid);

      if (nextActiveId) {
        saveActiveSetId(nextActiveId, trimmedUid);
        activeSetIdRef.current = nextActiveId;
        setActiveSetId(nextActiveId);
      }

      syncSavedProjectsState(nextSets, setProjects, setSavedCount);

      if (trimmedUid && isRuleSetsCloudEnabled()) {
        try {
          await saveRuleSetsCloud(trimmedUid, nextSets, nextActiveId);
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
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const trimmedUid = uid.trim();
        const localSets = normalizeLoadedSets(loadRuleSets(trimmedUid));
        let sets = localSets;
        let activeId = loadActiveSetId(trimmedUid);

        if (trimmedUid && isRuleSetsCloudEnabled()) {
          try {
            const cloud = await loadRuleSetsCloud(trimmedUid);
            if (cloud?.ruleSets?.length) {
              const merged = mergeRuleSetsOnLogin(localSets, cloud.ruleSets);
              sets = dedupeSavedRuleSetsByName(
                enforceMaxCriteriaPresets(
                  normalizeLoadedSets(merged),
                  trimmedUid,
                  email,
                ),
              );
              activeId = resolveHydratedActiveSetId(
                sets,
                activeId,
                cloud.activeSetId,
              );
            }
          } catch {
            // 로컬 기준 유지
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
  }, [uid, email]);

  const selectProject = useCallback(
    async (setId) => {
      const id = String(setId ?? '').trim();
      if (!id || !loadedSetsRef.current.some((set) => set.id === id)) {
        return { ok: false, reason: 'not_found' };
      }
      const ok = await persistProjectSets(loadedSetsRef.current, id);
      return ok ? { ok: true } : { ok: false, reason: 'cloud_save_failed' };
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
      const plan = planDuplicateProject(
        loadedSetsRef.current,
        id,
        uid.trim(),
        email,
      );
      if (!plan.ok) {
        return {
          ok: false,
          reason: plan.reason,
          message:
            plan.message ?? DUPLICATE_FAILURE_MESSAGE[plan.reason],
        };
      }

      const ok = await persistProjectSets(plan.next, plan.newSetId);
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

      const ok = await persistProjectSets(plan.next, plan.nextActiveId);
      return ok
        ? { ok: true, label: plan.label }
        : { ok: false, reason: 'cloud_save_failed' };
    },
    [persistProjectSets],
  );

  const updateProjectMeta = useCallback(
    async (setId, patch) => {
      const id = String(setId ?? '').trim();
      if (!id) return false;

      const sets = loadedSetsRef.current;
      const index = sets.findIndex((set) => set.id === id);
      if (index < 0) return false;

      const current = sets[index];
      const nextProjectContext =
        patch.proofRevision !== undefined || patch.formatLabel !== undefined
          ? mergeProjectContext(current.projectContext, {
              ...(patch.proofRevision !== undefined
                ? { proofRevision: patch.proofRevision }
                : {}),
              ...(patch.formatLabel !== undefined
                ? { formatLabel: patch.formatLabel }
                : {}),
            })
          : current.projectContext;
      const nextSet = normalizeRuleSet({
        ...current,
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
        ...(nextProjectContext !== undefined
          ? { projectContext: nextProjectContext }
          : {}),
      });
      const nextSets = sets.map((set, i) => (i === index ? nextSet : set));
      const ok = await persistProjectSets(nextSets);
      return ok;
    },
    [persistProjectSets],
  );

  const exempt = isCriteriaPresetLimitExempt(uid, email);
  const maxSlots = exempt ? null : MAX_CRITERIA_PRESETS;
  const emptySlotCount = exempt
    ? 0
    : Math.max(0, MAX_CRITERIA_PRESETS - savedCount);

  return {
    projects,
    activeSetId,
    loading,
    selectProject,
    renameProject,
    duplicateProject,
    deleteProject,
    updateProjectMeta,
    savedCount,
    maxSlots,
    exempt,
    emptySlotCount,
    atSlotLimit: !exempt && savedCount >= MAX_CRITERIA_PRESETS,
  };
}
