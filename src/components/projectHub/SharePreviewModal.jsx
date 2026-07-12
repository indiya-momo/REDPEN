import ProjectLibraryCard from './ProjectLibraryCard.jsx';

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   onClose: () => void,
 * }} props
 */
export default function SharePreviewModal({ card, onClose }) {
  const ledger = (Array.isArray(card.decisionLedger) ? card.decisionLedger : []).filter(
    (item) => item.kind === 'unify',
  );

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
          포함되지 않습니다. 확정 대장(통일형 📌 기록)은 포함됩니다.
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

        <section
          className="mypage-proto__share-ledger work-history-panel__block work-history-panel__block--ledger"
          aria-label="확정 대장"
        >
          <h3 className="work-history-panel__block-title">확정 대장</h3>
          {ledger.length ? (
            <ul className="work-history-panel__ledger-list">
              {ledger.map((item) => (
                <li key={item.id} className="work-history-panel__ledger-item">
                  <div className="work-history-panel__ledger-meta">
                    {item.atLabel || '날짜 없음'}
                  </div>
                  <ul className="work-history-panel__chips work-history-panel__chips--unify">
                    {item.variants.map((variant) => (
                      <li key={variant} className="work-history-panel__chip">
                        {variant}
                      </li>
                    ))}
                    <li className="work-history-panel__chip work-history-panel__chip--pinned">
                      {item.pinned}
                      <span className="work-history-panel__pin" aria-hidden>
                        📌
                      </span>
                    </li>
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="work-history-panel__criteria-empty">
              아직 확정 기록이 없습니다.
            </p>
          )}
        </section>

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
