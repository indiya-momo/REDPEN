/**
 * @param {{
 *   badges: Array<{
 *     id: string,
 *     name: string,
 *     description?: string,
 *     imageSrc?: string,
 *     showArt?: boolean,
 *     earned: boolean,
 *   } | null>,
 * }} props
 */
export default function BadgeCollectionGrid({ badges }) {
  return (
    <ul className="mypage-badge-grid" aria-label="배지 목록">
      {badges.map((badge, index) =>
        badge ? (
          <li key={badge.id} className="mypage-badge-grid__item">
            <article
              className={`mypage-badge-card${badge.earned ? ' mypage-badge-card--earned' : ' mypage-badge-card--locked'}${badge.showArt === false ? ' mypage-badge-card--text-only' : ''}`}
              aria-label={`${badge.name}${badge.earned ? ' (획득)' : ' (미획득)'}`}
            >
              <div className="mypage-badge-card__frame">
                {badge.showArt === false ? (
                  <div className="mypage-badge-card__art-reserve" aria-hidden />
                ) : badge.imageSrc ? (
                  <img
                    className="mypage-badge-card__image"
                    src={badge.imageSrc}
                    alt=""
                    decoding="async"
                  />
                ) : (
                  <div className="mypage-badge-card__placeholder" aria-hidden />
                )}
              </div>
              <p className="mypage-badge-card__name">{badge.name}</p>
              {badge.description ? (
                <p className="mypage-badge-card__desc">{badge.description}</p>
              ) : null}
            </article>
          </li>
        ) : (
          <li
            key={`badge-grid-empty-${index}`}
            className="mypage-badge-grid__item mypage-badge-grid__item--empty"
            aria-hidden="true"
          />
        ),
      )}
    </ul>
  );
}
