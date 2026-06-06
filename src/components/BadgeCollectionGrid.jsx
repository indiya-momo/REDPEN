/**
 * @param {{
 *   badges: Array<{
 *     id: string,
 *     name: string,
 *     description?: string,
 *     imageSrc?: string,
 *     earned: boolean,
 *   }>,
 * }} props
 */
export default function BadgeCollectionGrid({ badges }) {
  return (
    <ul className="mypage-badge-grid" aria-label="배지 목록">
      {badges.map((badge) => (
        <li key={badge.id} className="mypage-badge-grid__item">
          <article
            className={`mypage-badge-card${badge.earned ? ' mypage-badge-card--earned' : ' mypage-badge-card--locked'}`}
            aria-label={`${badge.name}${badge.earned ? ' (획득)' : ' (미획득)'}`}
          >
            <div className="mypage-badge-card__frame">
              {badge.earned && badge.imageSrc ? (
                <img
                  className="mypage-badge-card__image"
                  src={badge.imageSrc}
                  alt=""
                  decoding="async"
                />
              ) : (
                <div className="mypage-badge-card__placeholder" aria-hidden>
                  {badge.earned ? '뱃지' : '?'}
                </div>
              )}
            </div>
            <p className="mypage-badge-card__name">{badge.name}</p>
            {badge.description ? (
              <p className="mypage-badge-card__desc">{badge.description}</p>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
