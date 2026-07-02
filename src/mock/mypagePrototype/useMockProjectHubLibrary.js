import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MOCK_LIBRARY_SLOT_MAX,
  planMyPageProjectSlots,
} from '../../lib/mypageProjectDisplay.js';
import { buildSortedProjectCards } from '../../lib/projectHubCards.js';
import {
  MOCK_PROJECT_RULE_SETS,
  MOCK_PROJECT_SEED_VERSION,
  applyMockProjectCriteria,
  applyMockProjectMeta,
  buildMockProjectCards,
  duplicateMockProject,
} from './mockProjectRuleSets.js';

const MOCK_PROJECTS_STORAGE_KEY = `mypage-mock:projects:${MOCK_PROJECT_SEED_VERSION}`;

/** @returns {import('../../lib/ruleSetsStorage.js').RuleSet[] | null} */
function readMockProjectsFromSession() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MOCK_PROJECTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 목업 RuleSet state — `useProjectHubLibrary`와 동일한 반환 형태.
 */
export function useMockProjectHubLibrary() {
  const [projects, setProjects] = useState(
    () => readMockProjectsFromSession() ?? MOCK_PROJECT_RULE_SETS,
  );
  const [activeSetId, setActiveSetId] = useState('proj-1');
  const [dirtyIds, setDirtyIds] = useState(
    () => new Set(/** @type {string[]} */ (['proj-1'])),
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(MOCK_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // private browsing 등
    }
  }, [projects]);

  const previewCards = useMemo(
    () =>
      buildMockProjectCards(projects, {
        activeId: activeSetId,
        dirtyIds,
      }),
    [projects, activeSetId, dirtyIds],
  );

  const savedCount = projects.length;
  const slotPlan = useMemo(
    () =>
      planMyPageProjectSlots(projects, {
        exempt: false,
        savedCount,
        maxSlots: MOCK_LIBRARY_SLOT_MAX,
      }),
    [projects, savedCount],
  );

  const folderCards = useMemo(
    () => buildSortedProjectCards(slotPlan.visibleProjects, activeSetId),
    [slotPlan.visibleProjects, activeSetId],
  );

  const markDirty = useCallback((setId) => {
    setDirtyIds((prev) => new Set(prev).add(setId));
  }, []);

  const selectProject = useCallback(async (setId) => {
    const id = String(setId ?? '').trim();
    if (!id || !projects.some((set) => set.id === id)) {
      return { ok: false, reason: 'not_found' };
    }
    setActiveSetId(id);
    return { ok: true };
  }, [projects]);

  const renameProject = useCallback(
    async (setId, rawName) => {
      const id = String(setId ?? '').trim();
      const next = applyMockProjectMeta(projects, id, { name: rawName });
      if (next === projects) {
        return { ok: false, reason: 'not_found' };
      }
      setProjects(next);
      markDirty(id);
      return { ok: true };
    },
    [projects, markDirty],
  );

  const duplicateProject = useCallback(async (setId) => {
    const id = String(setId ?? '').trim();
    const next = duplicateMockProject(projects, id);
    if (next.length === projects.length) {
      return { ok: false, reason: 'not_found' };
    }
    const copy = next.find((set) => !projects.some((row) => row.id === set.id));
    setProjects(next);
    if (copy) {
      setActiveSetId(copy.id);
      markDirty(copy.id);
    }
    return { ok: true, newSetId: copy?.id };
  }, [projects, markDirty]);

  const deleteProject = useCallback(
    async (setId) => {
      const id = String(setId ?? '').trim();
      if (!projects.some((set) => set.id === id)) {
        return { ok: false, reason: 'not_found' };
      }

      setProjects((prev) => prev.filter((set) => set.id !== id));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (activeSetId === id) {
        setActiveSetId(null);
      }
      return { ok: true };
    },
    [projects, activeSetId],
  );

  const updateProjectMeta = useCallback(
    async (setId, patch) => {
      const id = String(setId ?? '').trim();
      const next = applyMockProjectMeta(projects, id, patch);
      if (next === projects) return { ok: false, reason: 'not_found' };
      setProjects(next);
      markDirty(id);
      return { ok: true };
    },
    [projects, markDirty],
  );

  const updateProjectCriteria = useCallback(
    async (setId, patch) => {
      const id = String(setId ?? '').trim();
      const next = applyMockProjectCriteria(projects, id, patch);
      if (next === projects) return false;
      setProjects(next);
      markDirty(id);
      return true;
    },
    [projects, markDirty],
  );

  return {
    projects,
    activeSetId,
    loading: false,
    selectProject,
    renameProject,
    duplicateProject,
    deleteProject,
    updateProjectMeta,
    updateProjectCustomRules: updateProjectCriteria,
    updateProjectCriteria,
    savedCount,
    maxSlots: MOCK_LIBRARY_SLOT_MAX,
    exempt: false,
    emptySlotCount: Math.max(0, MOCK_LIBRARY_SLOT_MAX - savedCount),
    atSlotLimit: savedCount >= MOCK_LIBRARY_SLOT_MAX,
    previewCards,
    folderCards,
    slotPlan,
    slotLabel: `${savedCount}/${MOCK_LIBRARY_SLOT_MAX}`,
  };
}
