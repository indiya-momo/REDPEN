import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../components/my-page.css';
import '../../components/project-hub-settings.css';
import './mypage-prototype.css';
import ProjectHubSettingsPanel from '../../components/ProjectHubSettingsPanel.jsx';
import ProjectHubTagFilters from '../../components/projectHub/ProjectHubTagFilters.jsx';
import { showAppConfirm } from '../../lib/appDialog.js';
import { formatProjectDialogLabel } from '../../lib/projectDialogLabel.js';
import { useProjectTagFilter } from '../../hooks/useProjectTagFilter.js';
import { MOCK_LIBRARY_SLOT_MAX, buildMockLibrarySlots } from '../../lib/mypageProjectDisplay.js';
import {
  MOCK_PROJECT_RULE_SETS,
  MOCK_PROJECT_SEED_VERSION,
  applyMockProjectCriteria,
  applyMockProjectMeta,
  buildMockProjectCards,
  duplicateMockProject,
} from './mockProjectRuleSets.js';
import ProjectLibraryCard from './ProjectLibraryCard.jsx';
import ProjectLibraryEmptySlot from './ProjectLibraryEmptySlot.jsx';
import SharePreviewModal from './SharePreviewModal.jsx';
import WorkbenchBarMock from './WorkbenchBarMock.jsx';

/** @typedef {'library' | 'workbench'} ProtoView */

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

export default function MyPagePrototypeScreen() {
  const [view, setView] = useState(/** @type {ProtoView} */ ('library'));
  const [projects, setProjects] = useState(
    () => readMockProjectsFromSession() ?? MOCK_PROJECT_RULE_SETS,
  );
  const [activeId, setActiveId] = useState('proj-1');
  const [dirtyIds, setDirtyIds] = useState(
    () => new Set(/** @type {string[]} */ (['proj-1'])),
  );
  const [selectedCardId, setSelectedCardId] = useState('proj-1');
  const [sharePreviewId, setSharePreviewId] = useState(
    /** @type {string | null} */ (null),
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(MOCK_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // private browsing 등
    }
  }, [projects]);

  const cards = useMemo(
    () =>
      buildMockProjectCards(projects, {
        activeId,
        dirtyIds,
      }),
    [projects, activeId, dirtyIds],
  );

  const {
    tagFilter,
    setTagFilter,
    tagFilterOptions,
    filteredCards: visibleCards,
  } = useProjectTagFilter(cards);

  const workbenchCard =
    cards.find((c) => c.id === activeId) ?? cards[0] ?? null;
  const shareCard = cards.find((c) => c.id === sharePreviewId) ?? null;

  const librarySlots = useMemo(
    () => buildMockLibrarySlots(cards),
    [cards],
  );

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const selectedRuleSet = useMemo(
    () => projects.find((set) => set.id === selectedCardId) ?? null,
    [projects, selectedCardId],
  );

  useEffect(() => {
    if (visibleCards.length === 0) {
      setSelectedCardId(null);
      return;
    }
    if (
      selectedCardId &&
      visibleCards.some((card) => card.id === selectedCardId)
    ) {
      return;
    }
    setSelectedCardId(visibleCards[0].id);
  }, [visibleCards, selectedCardId]);

  const handleDeleteCard = useCallback(
    async (id, title) => {
      if (
        !(await showAppConfirm({
          title: '삭제',
          message: `${formatProjectDialogLabel(title)} 프로젝트를 삭제할까요?`,
        }))
      ) {
        return;
      }
      setProjects((prev) => prev.filter((set) => set.id !== id));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (activeId === id) {
        setActiveId(null);
      }
    },
    [activeId],
  );

  const handleStartWork = useCallback((id) => {
    setActiveId(id);
    setSelectedCardId(id);
    setView('workbench');
  }, []);

  const handleSaveMeta = useCallback(
    async (payload) => {
      if (!selectedCard) return;
      setProjects((prev) =>
        applyMockProjectMeta(prev, selectedCard.id, {
          name: payload.name,
          tags: payload.tags,
          memo: payload.memo,
          proofRevision: payload.proofRevision,
          formatLabel: payload.formatLabel,
        }),
      );
      setDirtyIds((prev) => new Set(prev).add(selectedCard.id));
    },
    [selectedCard],
  );

  const handleCriteriaChange = useCallback(
    async (patch) => {
      if (!selectedCard) return;
      setProjects((prev) =>
        applyMockProjectCriteria(prev, selectedCard.id, patch),
      );
      setDirtyIds((prev) => new Set(prev).add(selectedCard.id));
    },
    [selectedCard],
  );

  const handleDuplicate = useCallback(
    (sourceId) => {
      setProjects((prev) => {
        const next = duplicateMockProject(prev, sourceId);
        const copy = next.find(
          (set) => !prev.some((row) => row.id === set.id),
        );
        if (copy) {
          setSelectedCardId(copy.id);
        }
        return next;
      });
    },
    [],
  );

  if (view === 'workbench' && workbenchCard) {
    return (
      <div className="mypage-proto">
        <WorkbenchBarMock
          card={workbenchCard}
          onBackToLibrary={() => setView('library')}
        />
      </div>
    );
  }

  return (
    <div className="mypage mypage-proto">
      <main className="mypage__main mypage-proto__main mypage-proto__main--editor">
        <div className="mypage__main-inner mypage__main-inner--section mypage__overview--projects">
          <div className="mypage__projects-layout">
            <section
              className="mypage__card mypage__project-hub"
              aria-labelledby="proto-project-hub-title"
            >
              <div className="mypage__project-hub-head">
                <div>
                  <h1 id="proto-project-hub-title" className="mypage__page-title">
                    나의 프로젝트
                  </h1>
                </div>
                <p className="mypage__project-slot-gauge" aria-live="polite">
                  슬롯{' '}
                  <strong>
                    {cards.length}/{MOCK_LIBRARY_SLOT_MAX}
                  </strong>
                </p>
              </div>

              <div className="mypage__project-hub-body">
                <ProjectHubTagFilters
                  options={tagFilterOptions}
                  value={tagFilter}
                  onChange={setTagFilter}
                />

                <div
                  className={`mypage-proto__grid${tagFilter ? '' : ' mypage-proto__grid--triple'}`}
                >
                  {tagFilter ? (
                    <>
                      {visibleCards.map((card) => (
                        <ProjectLibraryCard
                          key={card.id}
                          card={card}
                          nameEditable={false}
                          selected={card.id === selectedCardId}
                          onSelect={() => setSelectedCardId(card.id)}
                          onStartWork={() => handleStartWork(card.id)}
                          onDuplicate={() => handleDuplicate(card.id)}
                          onDelete={() =>
                            void handleDeleteCard(card.id, card.title)
                          }
                          onSharePreview={() => setSharePreviewId(card.id)}
                        />
                      ))}
                      {visibleCards.length === 0 ? (
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
                          nameEditable={false}
                          selected={card.id === selectedCardId}
                          onSelect={() => setSelectedCardId(card.id)}
                          onStartWork={() => handleStartWork(card.id)}
                          onDuplicate={() => handleDuplicate(card.id)}
                          onDelete={() =>
                            void handleDeleteCard(card.id, card.title)
                          }
                          onSharePreview={() => setSharePreviewId(card.id)}
                        />
                      ) : (
                        <ProjectLibraryEmptySlot key={`library-empty-slot-${index}`} />
                      ),
                    )
                  )}
                </div>
              </div>
            </section>

            {selectedCard ? (
              <ProjectHubSettingsPanel
                card={selectedCard}
                ruleSet={selectedRuleSet}
                onSave={handleSaveMeta}
                onCriteriaChange={handleCriteriaChange}
                onStartWork={() => handleStartWork(selectedCard.id)}
                onDuplicate={() => handleDuplicate(selectedCard.id)}
                onDelete={() =>
                  void handleDeleteCard(selectedCard.id, selectedCard.title)
                }
                onSharePreview={() => setSharePreviewId(selectedCard.id)}
              />
            ) : null}
          </div>
        </div>
      </main>

      {shareCard ? (
        <SharePreviewModal
          card={shareCard}
          onClose={() => setSharePreviewId(null)}
        />
      ) : null}
    </div>
  );
}
