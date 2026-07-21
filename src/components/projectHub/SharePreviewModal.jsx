import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listCheckResultsCloud } from '../../lib/checkResultsCloud.js';
import ProjectLibraryCard from './ProjectLibraryCard.jsx';
import SharePackageReadPanel from '../SharePackageReadPanel.jsx';

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
 *   ruleSet?: import('../../lib/ruleSetsStorage.js').RuleSet | null,
 *   uid?: string,
 *   onClose: () => void,
 *   onCreateShareLink?: () => void | Promise<void>,
 * }} props
 */
export default function SharePreviewModal({
  card,
  ruleSet = null,
  uid = '',
  onClose,
  onCreateShareLink,
}) {
  const [linkBusy, setLinkBusy] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [folderWidthPx, setFolderWidthPx] = useState(null);
  const [checkResults, setCheckResults] = useState(
    /** @type {Array<Record<string, unknown>>} */ ([]),
  );
  const [checkResultsLoading, setCheckResultsLoading] = useState(false);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    setFolderWidthPx(measureLibraryFolderWidth());
  }, []);

  useEffect(() => {
    const projectId = String(ruleSet?.id ?? card?.id ?? '').trim();
    const ownerUid = String(uid ?? '').trim();
    if (!projectId || !ownerUid) {
      setCheckResults([]);
      setCheckResultsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCheckResultsLoading(true);
    void (async () => {
      try {
        const rows = await listCheckResultsCloud({
          uid: ownerUid,
          projectId,
        });
        if (!cancelled) setCheckResults(rows);
      } catch (err) {
        console.error('공유 미리보기 검수 이력 로드 실패:', err);
        if (!cancelled) setCheckResults([]);
      } finally {
        if (!cancelled) setCheckResultsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, ruleSet?.id, card?.id]);

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

  const folderStyle = folderWidthPx
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
        className={`mypage-proto__modal mypage-proto__modal--share${dragging ? ' mypage-proto__modal--dragging' : ''}`}
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

        <div className="mypage-proto__share-body">
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
            공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있습니다. 인디야
            유료회원은 프로젝트를 적용하여 작업할 수 있습니다. 원고 PDF는
            포함되지 않습니다.
          </p>

          <div className="mypage-proto__share-folder" style={folderStyle}>
            <ProjectLibraryCard card={card} readOnly />
          </div>

          {ruleSet ? (
            <SharePackageReadPanel
              card={card}
              ruleSet={ruleSet}
              checkResults={checkResults}
              checkResultsLoading={checkResultsLoading}
              navAriaLabel="공유에 포함되는 구역"
            />
          ) : (
            <p className="mypage-proto__share-note" role="status">
              프로젝트 기준을 불러올 수 없습니다.
            </p>
          )}

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
