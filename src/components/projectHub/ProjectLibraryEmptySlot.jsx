/**
 * 나의 프로젝트 — 빈 슬롯 / 잠금 슬롯 (sheet-card 폴더 탭 + 점선 본문)
 *
 * @param {{ locked?: boolean }} [props]
 */
export default function ProjectLibraryEmptySlot({ locked = false }) {
  return (
    <article
      className={`sheet-card sheet-card--empty-slot${locked ? ' sheet-card--locked-slot' : ''}`}
      aria-label={locked ? '잠긴 슬롯' : '빈 프로젝트'}
    >
      <div className="sheet-card__tabs" aria-hidden="true">
        <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--lead sheet-card__tab--ghost" />
      </div>
      <div className="sheet-card__body sheet-card__body--empty-slot">
        <p className="mypage__project-slot-label">
          {locked ? '잠긴 슬롯' : '빈 프로젝트'}
        </p>
        {locked ? null : (
          <p className="mypage__project-slot-desc">
            검수 화면에서 프로젝트를 저장해 주세요
          </p>
        )}
      </div>
    </article>
  );
}
