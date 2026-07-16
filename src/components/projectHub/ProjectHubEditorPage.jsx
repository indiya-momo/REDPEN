/**
 * 마이페이지 「나의 프로젝트」 메뉴 — 공통 그리드 + 하단 편집 패널.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProjectHubActions } from '../../hooks/useProjectHubActions.js';
import { useProjectHubLibrary } from '../../hooks/useProjectHubLibrary.js';
import { useProjectTagFilter } from '../../hooks/useProjectTagFilter.js';
import SharePreviewModal from './SharePreviewModal.jsx';
import './project-library.css';
import ProjectHubSettingsPanel from '../ProjectHubSettingsPanel.jsx';
import ProjectHubLibraryPanel from './ProjectHubLibraryPanel.jsx';
import '../project-hub-settings.css';

/**
 * @param {{
 *   uid: string,
 *   email: string,
 *   entryCardId?: string | null,
 *   onEntryApplied?: () => void,
 *   library?: ReturnType<typeof useProjectHubLibrary>,
 *   onStartWork?: (cardId: string) => void | Promise<void>,
 *   profileSyncDone?: boolean,
 * }} props
 */
export default function ProjectHubEditorPage({
  uid,
  email,
  entryCardId = null,
  onEntryApplied,
  library: libraryProp,
  onStartWork: onStartWorkOverride,
  profileSyncDone = true,
}) {
  const libraryInternal = useProjectHubLibrary(uid, email, {
    profileSyncDone,
  });
  const library = libraryProp ?? libraryInternal;
  const tagFilter = useProjectTagFilter(library.previewCards);
  const actionsInternal = useProjectHubActions(library);
  const actions = useMemo(
    () =>
      onStartWorkOverride
        ? { ...actionsInternal, handleStartWork: onStartWorkOverride }
        : actionsInternal,
    [actionsInternal, onStartWorkOverride],
  );
  const {
    previewCards,
    loading,
    activeSetId,
    updateProjectMeta,
    updateProjectCriteria,
  } = library;
  const { filteredCards } = tagFilter;

  const [selectedCardId, setSelectedCardId] = useState(
    /** @type {string | null} */ (null),
  );
  const [metaSavePending, setMetaSavePending] = useState(false);
  const [criteriaSavePending, setCriteriaSavePending] = useState(false);
  const [sharePreviewCardId, setSharePreviewCardId] = useState(
    /** @type {string | null} */ (null),
  );

  useEffect(() => {
    if (loading) return;

    if (filteredCards.length === 0) {
      setSelectedCardId(null);
      return;
    }

    if (entryCardId) {
      if (filteredCards.some((card) => card.id === entryCardId)) {
        setSelectedCardId(entryCardId);
      }
      onEntryApplied?.();
      return;
    }

    if (
      selectedCardId &&
      filteredCards.some((card) => card.id === selectedCardId)
    ) {
      return;
    }

    const preferredId =
      activeSetId && filteredCards.some((card) => card.id === activeSetId)
        ? activeSetId
        : filteredCards[0].id;
    setSelectedCardId(preferredId);
  }, [
    loading,
    filteredCards,
    activeSetId,
    selectedCardId,
    entryCardId,
    onEntryApplied,
  ]);

  const selectedCard = useMemo(
    () => previewCards.find((card) => card.id === selectedCardId) ?? null,
    [previewCards, selectedCardId],
  );

  const selectedRuleSet = useMemo(
    () => library.projects.find((set) => set.id === selectedCardId) ?? null,
    [library.projects, selectedCardId],
  );

  const sharePreviewCard = useMemo(
    () => previewCards.find((card) => card.id === sharePreviewCardId) ?? null,
    [previewCards, sharePreviewCardId],
  );

  const handleCriteriaChange = useCallback(
    async (patch) => {
      if (!selectedCard) return;
      setCriteriaSavePending(true);
      try {
        await updateProjectCriteria(selectedCard.id, patch);
      } finally {
        setCriteriaSavePending(false);
      }
    },
    [selectedCard, updateProjectCriteria],
  );

  const handleSaveMeta = useCallback(
    async (payload, cardId) => {
      const id = cardId ?? selectedCard?.id;
      if (!id) return { ok: false, reason: 'not_found' };
      setMetaSavePending(true);
      try {
        const result = await updateProjectMeta(id, payload);
        if (!result.ok && result.message) {
          window.alert(result.message);
        }
        return result;
      } finally {
        setMetaSavePending(false);
      }
    },
    [selectedCard, updateProjectMeta],
  );

  return (
    <>
      <div className="mypage__projects-layout">
        <ProjectHubLibraryPanel
          uid={uid}
          email={email}
          library={library}
          tagFilter={tagFilter}
          actions={actions}
          selectedCardId={selectedCardId}
          onSelectCard={setSelectedCardId}
          sharePreviewCardId={sharePreviewCardId}
          onSharePreviewCardIdChange={setSharePreviewCardId}
        />

        {!loading && selectedCard ? (
          <ProjectHubSettingsPanel
            card={selectedCard}
            ruleSet={selectedRuleSet}
            uid={uid}
            pdfFileName={selectedRuleSet?.projectContext?.pdfFileName}
            pdfPageCount={selectedRuleSet?.projectContext?.pdfPageCount}
            lastWorkedAt={selectedRuleSet?.projectContext?.lastWorkedAt}
            saving={metaSavePending}
            criteriaSaving={criteriaSavePending}
            onSave={handleSaveMeta}
            onCriteriaChange={handleCriteriaChange}
            onStartWork={() => void actions.handleStartWork(selectedCard.id)}
            onDuplicate={() => void actions.handleDuplicate(selectedCard.id)}
            onDelete={() =>
              void actions.handleDelete(selectedCard.id, selectedCard.title)
            }
            onSharePreview={() => setSharePreviewCardId(selectedCard.id)}
          />
        ) : null}
      </div>

      {sharePreviewCard ? (
        <SharePreviewModal
          card={sharePreviewCard}
          onClose={() => setSharePreviewCardId(null)}
        />
      ) : null}
    </>
  );
}
