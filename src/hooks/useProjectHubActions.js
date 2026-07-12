import { useCallback } from 'react';
import { returnToWorkspace } from '../lib/returnToWorkspace.js';
import { showAppAlert, showAppConfirm } from '../lib/appDialog.js';
import { formatProjectDialogLabel } from '../lib/projectDialogLabel.js';
import { CRITERIA_PRESET_LIMIT_MESSAGE } from '../lib/criteriaPresetLimit.js';

const SELECT_FAILURE_MESSAGE =
  '프로젝트 선택을 저장하지 못했습니다. 다시 시도해 주세요.';

/**
 * @param {{
 *   selectProject: (id: string) => Promise<{ ok: boolean }>,
 *   renameProject: (id: string, title: string) => Promise<{ ok: boolean, message?: string }>,
 *   duplicateProject: (id: string) => Promise<{ ok: boolean, message?: string }>,
 *   deleteProject: (id: string) => Promise<{ ok: boolean, message?: string }>,
 *   updateProjectMeta: (id: string, patch: object) => Promise<unknown>,
 *   atSlotLimit: boolean,
 * }} deps
 */
export function useProjectHubActions({
  selectProject,
  renameProject,
  duplicateProject,
  deleteProject,
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
        void showAppAlert({
          title: '저장 한도',
          message: CRITERIA_PRESET_LIMIT_MESSAGE,
        });
        return;
      }
      const result = await duplicateProject(cardId);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [atSlotLimit, duplicateProject],
  );

  const handleDelete = useCallback(
    async (cardId, title) => {
      if (
        !(await showAppConfirm({
          title: '삭제',
          message: `${formatProjectDialogLabel(title)} 프로젝트를 삭제할까요?`,
        }))
      ) {
        return;
      }
      const result = await deleteProject(cardId);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [deleteProject],
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
    handleDelete,
    handleUpdateMeta,
    handleStartWork,
  };
}
