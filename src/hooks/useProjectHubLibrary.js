import { useMemo } from 'react';
import { useMyPageProjects } from './useMyPageProjects.js';
import { buildSortedProjectCards } from '../lib/projectHubCards.js';
import {
  formatLibrarySlotGauge,
  planMyPageProjectSlots,
} from '../lib/mypageProjectDisplay.js';

/**
 * 마이페이지 프로젝트 허브 공통 데이터.
 * UI는 ProjectHubOverviewPanel / ProjectHubEditorPage 에서 각각 소비한다.
 *
 * @param {string} uid
 * @param {string} email
 * @param {{ profileSyncDone?: boolean }} [options]
 */
export function useProjectHubLibrary(uid, email, options = {}) {
  const projectState = useMyPageProjects(uid, email, options);
  const {
    projects,
    activeSetId,
    savedCount,
    maxSlots,
    exempt,
  } = projectState;

  const previewCards = useMemo(
    () => buildSortedProjectCards(projects, activeSetId),
    [projects, activeSetId],
  );

  const slotPlan = useMemo(
    () =>
      planMyPageProjectSlots(projects, {
        exempt,
        savedCount,
        maxSlots: maxSlots ?? undefined,
      }),
    [projects, exempt, savedCount, maxSlots],
  );

  const folderCards = useMemo(
    () => buildSortedProjectCards(slotPlan.visibleProjects, activeSetId),
    [slotPlan.visibleProjects, activeSetId],
  );

  const slotLabel =
    maxSlots == null
      ? String(savedCount)
      : formatLibrarySlotGauge(savedCount, maxSlots);

  return {
    ...projectState,
    previewCards,
    folderCards,
    slotPlan,
    slotLabel,
  };
}
