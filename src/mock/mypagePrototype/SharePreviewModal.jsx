import ProjectLibraryCard from './ProjectLibraryCard.jsx';

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   onClose: () => void,
 * }} props
 */
export default function SharePreviewModal({ card, onClose }) {
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
        className="mypage-proto__modal"
        role="dialog"
        aria-labelledby="share-preview-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mypage-proto__modal-head">
          <div>
            <p className="mypage-proto__modal-eyebrow">공유 미리보기</p>
            <h2 id="share-preview-title" className="mypage-proto__modal-title">
              외주·팀에게 보이는 화면
            </h2>
          </div>
          <button
            type="button"
            className="mypage-proto__modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <p className="mypage-proto__share-note">
          외주·팀에게 전달되는 읽기 전용 문서입니다. PDF·검수 결과는
          포함되지 않습니다.
        </p>

        <ProjectLibraryCard
          card={card}
          readOnly
          onRename={() => {}}
          onUpdateMeta={() => {}}
          onStartWork={() => {}}
          onDuplicate={() => {}}
          onSharePreview={() => {}}
        />

        <footer className="mypage-proto__modal-foot">
          <button
            type="button"
            className="sheet-card__btn sheet-card__btn--primary"
            disabled
            title="B-0: 읽기 링크 (미구현)"
          >
            공유 링크 만들기 (준비 중)
          </button>
        </footer>
      </div>
    </div>
  );
}
