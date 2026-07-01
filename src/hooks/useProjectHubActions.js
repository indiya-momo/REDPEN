import { useCallback } from 'react';
import { returnToWorkspace } from '../lib/returnToWorkspace.js';

const SLOT_LIMIT_MESSAGE =
  '프로젝트 슬롯이 가득 찼습니다. 추가 슬롯은 회원 등급으로 제공됩니다. (준비 중)';

const SELECT_FAILURE_MESSAGE =
  '프로젝트 선택을 저장하지 못했습니다. 다시 시도해 주세요.';

/**
 * @param {{
 *   selectProject: (id: string) => Promise<{ ok: boolean }>,
 *   renameProject: (id: string, title: string) => Promise<{ ok: boolean, message?: string }>,
 *   duplicateProject: (id: string) => Promise<{ ok: boolean, message?: string }>,
 *   updateProjectMeta: (id: string, patch: object) => Promise<unknown>,
 *   atSlotLimit: boolean,
 * }} deps
 */
export function useProjectHubActions({
  selectProject,
  renameProject,
  duplicateProject,
  updateProjectMeta,
  atSlotLimit,
}) {
  const handleRename = useCallback(
    async (cardId, title) => {
      const result = await renameProject(cardId, title);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [renameProject],
  );

  const handleDuplicate = useCallback(
    async (cardId) => {
      if (atSlotLimit) {
        window.alert(SLOT_LIMIT_MESSAGE);
        return;
      }
      const result = await duplicateProject(cardId);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [atSlotLimit, duplicateProject],
  );

  const handleUpdateMeta = useCallback(
    async (cardId, patch) => {
      await updateProjectMeta(cardId, patch);
    },
    [updateProjectMeta],
  );

  const handleStartWork = useCallback(
    async (cardId) => {
      const result = await selectProject(cardId);
      if (!result.ok) {
        window.alert(SELECT_FAILURE_MESSAGE);
        return;
      }
      returnToWorkspace();
    },
    [selectProject],
  );

  return {
    handleRename,
    handleDuplicate,
    handleUpdateMeta,
    handleStartWork,
  };
}
