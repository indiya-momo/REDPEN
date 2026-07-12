/**
 * 마이페이지 「나의 프로젝트」 그리드 — 개요·편집 화면 공통 단일 UI.
 * 편집 패널은 ProjectHubEditorPage에서 이 컴포넌트 아래에만 붙인다.
 */
import { useMemo, useState } from 'react';
import {
  buildMockLibrarySlots,
  formatLibrarySlotGauge,
} from '../../lib/mypageProjectDisplay.js';
import { useProjectHubActions } from '../../hooks/useProjectHubActions.js';
import { useProjectHubLibrary } from '../../hooks/useProjectHubLibrary.js';
import { useProjectTagFilter } from '../../hooks/useProjectTagFilter.js';
import ProjectLibraryCard from '../../mock/mypagePrototype/ProjectLibraryCard.jsx';
import ProjectLibraryEmptySlot from '../../mock/mypagePrototype/ProjectLibraryEmptySlot.jsx';
import SharePreviewModal from '../../mock/mypagePrototype/SharePreviewModal.jsx';
import ProjectMetaEditModal from '../ProjectMetaEditModal.jsx';
import ProjectHubTagFilters from './ProjectHubTagFilters.jsx';

/**
 * @param {{
 *   uid: string,
 *   email: string,
 *   selectedCardId?: string | null,
 *   onSelectCard?: (cardId: string) => void,
 *   library?: ReturnType<typeof useProjectHubLibrary>,
 *   tagFilter?: ReturnType<typeof useProjectTagFilter>,
 *   actions?: ReturnType<typeof useProjectHubActions>,
 *   onOpenSection?: () => void,
 *   sharePreviewCardId?: string | null,
 *   onSharePreviewCardIdChange?: (cardId: string | null) => void,
 * }} props
 */
export default function ProjectHubLibraryPanel({
  uid,
  email,
  selectedCardId = null,
  onSelectCard,
  library: libraryProp,
  tagFilter: tagFilterProp,
  actions: actionsProp,
  onOpenSection,
  sharePreviewCardId: sharePreviewCardIdProp,
  onSharePreviewCardIdChange,
}) {
  const libraryInternal = useProjectHubLibrary(uid, email);
  const library = libraryProp ?? libraryInternal;
  const { previewCards, loading } = library;

  const tagFilterInternal = useProjectTagFilter(previewCards);
  const tagFilter = tagFilterProp ?? tagFilterInternal;
  const { tagFilter: activeTag, setTagFilter, tagFilterOptions, filteredCards } =
    tagFilter;

  const actionsInternal = useProjectHubActions(library);
  const actions = actionsProp ?? actionsInternal;

  const [internalSharePreviewCardId, setInternalSharePreviewCardId] = useState(
    /** @type {string | null} */ (null),
  );
  const [metaEditCardId, setMetaEditCardId] = useState(
    /** @type {string | null} */ (null),
  );
  const [metaSaving, setMetaSaving] = useState(false);

  const isSharePreviewControlled = onSharePreviewCardIdChange !== undefined;
  const sharePreviewCardId = isSharePreviewControlled
    ? (sharePreviewCardIdProp ?? null)
    : internalSharePreviewCardId;
  const openSharePreview = (cardId) => {
    if (isSharePreviewControlled) {
      onSharePreviewCardIdChange(cardId);
      return;
    }
    setInternalSharePreviewCardId(cardId);
  };
  const closeSharePreview = () => {
    if (isSharePreviewControlled) {
      onSharePreviewCardIdChange(null);
      return;
    }
    setInternalSharePreviewCardId(null);
  };

  const librarySlots = useMemo(
    () => buildMockLibrarySlots(previewCards),
    [previewCards],
  );

  const sharePreviewCard = useMemo(
    () => previewCards.find((card) => card.id === sharePreviewCardId) ?? null,
    [previewCards, sharePreviewCardId],
  );

  const metaEditCard = useMemo(
    () => previewCards.find((card) => card.id === metaEditCardId) ?? null,
    [previewCards, metaEditCardId],
  );

  /**
   * @param {import('../../presentation/projectCardViewModel.js').ProjectCardViewModel} card
   */
  function renderLibraryCard(card) {
    return (
      <ProjectLibraryCard
        key={card.id}
        card={card}
        nameEditable={false}
        selected={card.id === selectedCardId}
        onSelect={onSelectCard ? () => onSelectCard(card.id) : undefined}
        onEditMeta={() => setMetaEditCardId(card.id)}
        onStartWork={() => void actions.handleStartWork(card.id)}
        onDuplicate={() => void actions.handleDuplicate(card.id)}
        onDelete={() => void actions.handleDelete(card.id, card.title)}
        onSharePreview={() => openSharePreview(card.id)}
      />
    );
  }

  return (
    <>
      <section
        className={`mypage__card mypage__project-hub${onOpenSection ? ' mypage__card--nav-link' : ''}`}
        aria-labelledby="mypage-project-hub-title"
        role={onOpenSection ? 'button' : undefined}
        tabIndex={onOpenSection ? 0 : undefined}
        onClick={onOpenSection}
        onKeyDown={
          onOpenSection
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenSection();
                }
              }
            : undefined
        }
      >
        <div className="mypage__project-hub-head">
          <div>
            <div className="mypage__project-hub-title-row">
              <h1 id="mypage-project-hub-title" className="mypage__page-title">
                나의 프로젝트
              </h1>
            </div>
          </div>
          <p className="mypage__project-slot-gauge" aria-live="polite">
            슬롯 <strong>{formatLibrarySlotGauge(previewCards.length)}</strong>
          </p>
        </div>

        {loading ? (
          <p className="mypage__project-loading" role="status">
            프로젝트를 불러오는 중…
          </p>
        ) : (
          <div
            className="mypage__project-hub-body"
            inert={onOpenSection ? true : undefined}
          >
            <ProjectHubTagFilters
              options={tagFilterOptions}
              value={activeTag}
              onChange={setTagFilter}
            />

            <div
              className={`mypage-proto__grid${activeTag ? '' : ' mypage-proto__grid--triple'}`}
            >
              {activeTag ? (
                <>
                  {filteredCards.map((card) => renderLibraryCard(card))}
                  {filteredCards.length === 0 ? (
                    <p className="mypage__project-filter-empty" role="status">
                      선택한 태그에 해당하는 프로젝트가 없습니다.
                    </p>
                  ) : null}
                </>
              ) : (
                librarySlots.map((card, index) =>
                  card ? (
                    renderLibraryCard(card)
                  ) : (
                    <ProjectLibraryEmptySlot key={`library-empty-slot-${index}`} />
                  ),
                )
              )}
            </div>
          </div>
        )}
      </section>

      {!isSharePreviewControlled && sharePreviewCard ? (
        <SharePreviewModal
          card={sharePreviewCard}
          onClose={closeSharePreview}
        />
      ) : null}

      <ProjectMetaEditModal
        open={Boolean(metaEditCard)}
        projectTitle={metaEditCard?.title ?? ''}
        initialTags={metaEditCard?.tags ?? []}
        initialMemo={metaEditCard?.memo ?? ''}
        initialFormatLabel={metaEditCard?.formatLabel ?? ''}
        saving={metaSaving}
        onClose={() => setMetaEditCardId(null)}
        onSave={async (payload) => {
          if (!metaEditCard) return;
          setMetaSaving(true);
          try {
            await actions.handleUpdateMeta(metaEditCard.id, payload);
            setMetaEditCardId(null);
          } finally {
            setMetaSaving(false);
          }
        }}
      />
    </>
  );
}
