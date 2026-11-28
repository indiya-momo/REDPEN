/**
 * 마이페이지 「표준국어대사전 데이터」 카드. 로그인한 회원에게만 그린다.
 */
import {
  STDICT_DATA_FILES,
  STDICT_DATA_MEMBER_NOTE,
  STDICT_DATA_TITLE,
  STDICT_DATA_USAGE_LINES,
  getStdictDataDownloadUrl,
} from '../lib/stdictDataDownloads.js';

export default function StdictDataDownloadCard() {
  return (
    <section className="mypage__card" aria-labelledby="mypage-stdict-data-title">
      <div className="mypage__card-head">
        <h2 id="mypage-stdict-data-title" className="mypage__card-title">
          {STDICT_DATA_TITLE} {STDICT_DATA_MEMBER_NOTE}
        </h2>
      </div>
      {STDICT_DATA_USAGE_LINES.map((line) => (
        <p key={line} className="mypage__profile-note">
          {line}
        </p>
      ))}
      <ul className="stdict-data-download__list">
        {STDICT_DATA_FILES.map((item) => (
          <li key={item.id} className="stdict-data-download__item">
            <div className="stdict-data-download__text">
              <span className="stdict-data-download__label">{item.label}</span>
              <span className="stdict-data-download__note">{item.note}</span>
            </div>
            <a
              className="stdict-data-download__button"
              href={getStdictDataDownloadUrl(item)}
              download={item.href ? undefined : item.file}
              rel={item.href ? 'noopener noreferrer' : undefined}
            >
              다운받기
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
