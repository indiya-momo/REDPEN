import { useCallback, useMemo, useState } from 'react';
import '../../components/my-page.css';
import './mypage-prototype.css';
import {
  collectProjectTags,
  filterProjectsByTag,
} from '../../presentation/projectCardViewModel.js';
import { MOCK_PROJECT_CARDS } from './mockProjectCards.js';
import ProjectLibraryCard from './ProjectLibraryCard.jsx';
import SharePreviewModal from './SharePreviewModal.jsx';
import WorkbenchBarMock from './WorkbenchBarMock.jsx';

/** @typedef {'library' | 'workbench'} ProtoView */

function duplicateCard(source, index) {
  return {
    ...source,
    id: `proj-dup-${Date.now()}-${index}`,
    title: `${source.title} (복제)`,
    isActive: false,
    dirty: false,
    savedDate: '오늘',
  };
}

export default function MyPagePrototypeScreen() {
  const [view, setView] = useState(/** @type {ProtoView} */ ('library'));
  const [cards, setCards] = useState(MOCK_PROJECT_CARDS);
  const [activeId, setActiveId] = useState('proj-1');
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(['proj-1']),
  );
  const [tagFilter, setTagFilter] = useState(/** @type {string | null} */ (null));
  const [sharePreviewId, setSharePreviewId] = useState(
    /** @type {string | null} */ (null),
  );

  const allTags = useMemo(() => collectProjectTags(cards), [cards]);
  const visibleCards = useMemo(
    () => filterProjectsByTag(cards, tagFilter),
    [cards, tagFilter],
  );

  const activeCard = cards.find((c) => c.id === activeId) ?? cards[0];
  const shareCard = cards.find((c) => c.id === sharePreviewId) ?? null;

  const updateCard = useCallback((id, patch) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const handleStartWork = useCallback((id) => {
    setActiveId(id);
    setCards((prev) =>
      prev.map((c) => ({ ...c, isActive: c.id === id })),
    );
    setView('workbench');
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (view === 'workbench' && activeCard) {
    return (
      <div className="mypage-proto">
        <div className="mypage-proto__dev-banner" role="status">
          DEV 목업 ·{' '}
          <code>?window=mypage-mock</code> · 저장 없음
        </div>
        <WorkbenchBarMock
          card={activeCard}
          onBackToLibrary={() => setView('library')}
        />
      </div>
    );
  }

  return (
    <div className="mypage mypage-proto">
      <div className="mypage-proto__dev-banner" role="status">
        DEV 목업 · <code>?window=mypage-mock</code> ·{' '}
        <a href="/?window=mypage">실제 마이페이지</a>
      </div>

      <aside className="mypage__sidebar mypage-proto__sidebar">
        <div className="mypage__sidebar-head">
          <p className="mypage__eyebrow">PROTOTYPE</p>
          <h1 className="mypage-proto__sidebar-title">프로젝트 라이브러리</h1>
        </div>
        <p className="mypage-proto__sidebar-desc">
          카드 · 작업대 · 공유 미리보기 UX 검증용. 클릭으로 흐름을 확인하세요.
        </p>
      </aside>

      <main className="mypage__main mypage-proto__main">
        <section
          className="mypage__card mypage__project-hub"
          aria-labelledby="proto-project-hub-title"
        >
          <div className="mypage__project-hub-head">
            <div>
              <h1 id="proto-project-hub-title" className="mypage__page-title">
                나의 프로젝트
              </h1>
              <p className="mypage-proto__hub-lead">
                명함+목차 카드 · 메타는 라이브러리 · 규칙은 작업대
              </p>
            </div>
            <p className="mypage__project-slot-gauge">
              슬롯 <strong>{cards.length}/3</strong>
            </p>
          </div>

          <div
            className="mypage-proto__filters"
            role="group"
            aria-label="태그 필터"
          >
            <button
              type="button"
              className={`mypage-proto__filter${tagFilter === null ? ' mypage-proto__filter--on' : ''}`}
              onClick={() => setTagFilter(null)}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`mypage-proto__filter${tagFilter === tag ? ' mypage-proto__filter--on' : ''}`}
                onClick={() => setTagFilter(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="mypage-proto__grid">
            {visibleCards.map((card) => (
              <ProjectLibraryCard
                key={card.id}
                card={card}
                expanded={expandedIds.has(card.id)}
                onToggleExpand={() => toggleExpand(card.id)}
                onRename={(title) => updateCard(card.id, { title })}
                onUpdateMeta={(patch) => updateCard(card.id, patch)}
                onStartWork={() => handleStartWork(card.id)}
                onDuplicate={() => {
                  setCards((prev) => [...prev, duplicateCard(card, prev.length)]);
                }}
                onSharePreview={() => setSharePreviewId(card.id)}
              />
            ))}

            {cards.length < 3 ? (
              <div className="mypage__project-slot mypage-proto__empty-slot">
                <p className="mypage__project-slot-label">빈 슬롯</p>
                <p className="mypage__project-slot-desc">
                  복제하거나 검수 화면에서 새 기준을 저장하면 채워집니다.
                </p>
              </div>
            ) : (
              <div className="mypage__project-slot mypage-proto__slot-limit">
                <p className="mypage__project-slot-label">슬롯 가득 참</p>
                <p className="mypage__project-slot-desc">
                  Pro에서 슬롯을 늘릴 수 있습니다. (placeholder)
                </p>
              </div>
            )}
          </div>
        </section>
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
