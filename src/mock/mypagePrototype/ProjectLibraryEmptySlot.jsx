/** 나의 프로젝트 — 빈 슬롯 (sheet-card 폴더 탭 + 점선 본문) */
export default function ProjectLibraryEmptySlot() {
  return (
    <article className="sheet-card sheet-card--empty-slot" aria-label="빈 슬롯">
      <div className="sheet-card__tabs" aria-hidden="true">
        <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--lead sheet-card__tab--ghost" />
        <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--ghost" />
      </div>
      <div className="sheet-card__body sheet-card__body--empty-slot">
        <p className="mypage__project-slot-label">빈 슬롯</p>
        <p className="mypage__project-slot-desc">
          복제하거나 검수 화면에서 새 기준을 저장하면 채워집니다.
        </p>
      </div>
    </article>
  );
}
