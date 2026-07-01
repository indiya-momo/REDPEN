/**
 * 마이페이지 「나의 프로젝트」 그리드 — 개요·편집 화면 공통 단일 UI.
 * 편집 패널은 ProjectHubEditorPage에서 이 컴포넌트 아래에만 붙인다.
 */
import { useMemo, useState } from 'react';
import {
  buildMockLibrarySlots,
  MOCK_LIBRARY_SLOT_MAX,
} from '../../lib/mypageProjectDisplay.js';
import { useProjectHubActions } from '../../hooks/useProjectHubActions.js';
import { useProjectHubLibrary } from '../../hooks/useProjectHubLibrary.js';
import { useProjectTagFilter } from '../../hooks/useProjectTagFilter.js';
import ProjectLibraryCard from '../../mock/mypagePrototype/ProjectLibraryCard.jsx';
import ProjectLibraryEmptySlot from '../../mock/mypagePrototype/ProjectLibraryEmptySlot.jsx';
import SharePreviewModal from '../../mock/mypagePrototype/SharePreviewModal.jsx';
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

  const [sharePreviewCardId, setSharePreviewCardId] = useState(
    /** @type {string | null} */ (null),
  );

  const librarySlots = useMemo(
    () => buildMockLibrarySlots(previewCards),
    [previewCards],
  );

  const sharePreviewCard = useMemo(
    () => previewCards.find((card) => card.id === sharePreviewCardId) ?? null,
    [previewCards, sharePreviewCardId],
  );

  const stopSectionNav = (event) => {
    event.stopPropagation();
  };

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
            슬롯{' '}
            <strong>
              {previewCards.length}/{MOCK_LIBRARY_SLOT_MAX}
            </strong>
          </p>
        </div>

        {loading ? (
          <p className="mypage__project-loading" role="status">
            프로젝트를 불러오는 중…
          </p>
        ) : (
          <div
            className="mypage__project-hub-body"
            onClick={onOpenSection ? stopSectionNav : undefined}
            onKeyDown={onOpenSection ? stopSectionNav : undefined}
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
                  {filteredCards.map((card) => (
                    <ProjectLibraryCard
                      key={card.id}
                      card={card}
                      selected={card.id === selectedCardId}
                      onSelect={
                        onSelectCard
                          ? () => onSelectCard(card.id)
                          : undefined
                      }
                      onRename={(title) => void actions.handleRename(card.id, title)}
                      onUpdateMeta={(patch) =>
                        void actions.handleUpdateMeta(card.id, patch)
                      }
                      onStartWork={() => void actions.handleStartWork(card.id)}
                      onDuplicate={() => void actions.handleDuplicate(card.id)}
                      onSharePreview={() => setSharePreviewCardId(card.id)}
                    />
                  ))}
                  {filteredCards.length === 0 ? (
                    <p className="mypage__project-filter-empty" role="status">
                      선택한 태그에 해당하는 프로젝트가 없습니다.
                    </p>
                  ) : null}
                </>
              ) : (
                librarySlots.map((card, index) =>
                  card ? (
                    <ProjectLibraryCard
                      key={card.id}
                      card={card}
                      selected={card.id === selectedCardId}
                      onSelect={
                        onSelectCard
                          ? () => onSelectCard(card.id)
                          : undefined
                      }
                      onRename={(title) => void actions.handleRename(card.id, title)}
                      onUpdateMeta={(patch) =>
                        void actions.handleUpdateMeta(card.id, patch)
                      }
                      onStartWork={() => void actions.handleStartWork(card.id)}
                      onDuplicate={() => void actions.handleDuplicate(card.id)}
                      onSharePreview={() => setSharePreviewCardId(card.id)}
                    />
                  ) : (
                    <ProjectLibraryEmptySlot key={`library-empty-slot-${index}`} />
                  ),
                )
              )}
            </div>
          </div>
        )}
      </section>

      {sharePreviewCard ? (
        <SharePreviewModal
          card={sharePreviewCard}
          onClose={() => setSharePreviewCardId(null)}
        />
      ) : null}
    </>
  );
}
