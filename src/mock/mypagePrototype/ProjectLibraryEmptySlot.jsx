/**
 * 나의 프로젝트 — 빈 슬롯 / 잠금 슬롯 (sheet-card 폴더 탭 + 점선 본문)
 *
 * @param {{ locked?: boolean }} [props]
 */
export default function ProjectLibraryEmptySlot({ locked = false }) {
  return (
    <article
      className={`sheet-card sheet-card--empty-slot${locked ? ' sheet-card--locked-slot' : ''}`}
      aria-label={locked ? '잠긴 슬롯' : '빈 슬롯'}
    >
      <div className="sheet-card__tabs" aria-hidden="true">
        <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--lead sheet-card__tab--ghost" />
        <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--ghost" />
      </div>
      <div className="sheet-card__body sheet-card__body--empty-slot">
        <p className="mypage__project-slot-label">
          {locked ? '잠긴 슬롯' : '빈 슬롯'}
        </p>
        <p className="mypage__project-slot-desc">
          {locked
            ? '오픈베타에서는 프로젝트를 1개만 저장할 수 있습니다. 같은 이름으로 덮어쓰거나, 기존 프로젝트를 삭제한 뒤 새로 저장하세요.'
            : '검수 화면에서 새 기준으로 저장하면 채워집니다.'}
        </p>
      </div>
    </article>
  );
}
