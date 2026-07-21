import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProjectLibraryCard from './ProjectLibraryCard.jsx';

/** 공유 미리보기 — 수신자가 보게 될 설정 구역 안내 (비활성) */
const SHARE_OUTLINE_NAV = [
  { id: 'meta', label: '프로젝트 정보', boxed: true },
  { id: 'spelling', label: '맞춤법', pillar: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillar: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillar: 'auxiliary' },
  { id: 'actions', label: '작업 이력', boxed: true },
];

/** 나의 프로젝트 그리드에 있는 실제 폴더 카드 너비(px) */
function measureLibraryFolderWidth() {
  if (typeof document === 'undefined') return null;
  const sample = document.querySelector(
    '.mypage-proto__grid > .sheet-card:not(.sheet-card--empty-slot):not(.sheet-card--locked-slot)',
  );
  if (!sample) return null;
  const width = sample.getBoundingClientRect().width;
  return width > 0 ? Math.round(width) : null;
}

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   onClose: () => void,
 *   onCreateShareLink?: () => void | Promise<void>,
 * }} props
 */
export default function SharePreviewModal({
  card,
  onClose,
  onCreateShareLink,
}) {
  const [linkBusy, setLinkBusy] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [folderWidthPx, setFolderWidthPx] = useState(null);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    setFolderWidthPx(measureLibraryFolderWidth());
  }, []);

  const handleCreateLink = async () => {
    if (!onCreateShareLink || linkBusy) return;
    setLinkBusy(true);
    try {
      await onCreateShareLink();
    } finally {
      setLinkBusy(false);
    }
  };

  const onDragPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset.x, offset.y],
  );

  const onDragPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }, []);

  const endDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

  const columnStyle = folderWidthPx
    ? { width: folderWidthPx, maxWidth: '100%' }
    : undefined;

  return (
    <div
      className="mypage-proto__modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className={`mypage-proto__modal${dragging ? ' mypage-proto__modal--dragging' : ''}`}
        role="dialog"
        aria-labelledby="share-preview-title"
        aria-modal="true"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="mypage-proto__modal-close"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>

        <div className="mypage-proto__share-column" style={columnStyle}>
          <header
            className="mypage-proto__modal-head mypage-proto__modal-head--drag"
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <h2 id="share-preview-title" className="mypage-proto__modal-title">
              프로젝트 공유 미리보기
            </h2>
          </header>

          <p className="mypage-proto__share-note">
            링크만으로는 미리보기만 가능합니다. 다운로드·기준 적용은 수신자
            로그인이 필요합니다. 원고 PDF는 포함되지 않습니다.
          </p>

          <div className="mypage-proto__share-stack">
            <ProjectLibraryCard card={card} readOnly />

            <nav
              className="mypage-proto__share-outline"
              aria-label="공유에 포함되는 구역"
            >
              <ul className="mypage-proto__share-outline-list">
                {SHARE_OUTLINE_NAV.map((item) => (
                  <li key={item.id}>
                    <div
                      className={[
                        'mypage-proto__share-outline-item',
                        item.boxed
                          ? 'mypage-proto__share-outline-item--boxed'
                          : '',
                        item.pillar
                          ? `mypage-proto__share-outline-item--${item.pillar}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {item.label}
                    </div>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <footer className="mypage-proto__modal-foot">
            <button
              type="button"
              className="sheet-card__btn sheet-card__btn--primary"
              disabled={!onCreateShareLink || linkBusy}
              aria-busy={linkBusy}
              onClick={() => void handleCreateLink()}
            >
              {linkBusy ? '만드는 중…' : '공유 링크 만들기'}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
