import { MOCK_COMMON_SLOT_CARD } from './mockCommonSlotGroupData.js';
import './common-slot-group-prototype.css';

/**
 * DEV: ?window=common-slot-group-mock
 * 공통 항목 찾기 — 카드 안 표기별 분류(1안) 전·후 비교 목업.
 * 실 CheckResultsPanel / MainScreen 은 변경하지 않음.
 */
export default function CommonSlotGroupPrototypeScreen() {
  const card = MOCK_COMMON_SLOT_CARD;

  return (
    <div className="common-slot-group-proto">
      <p className="common-slot-group-proto__banner">
        DEV 목업 · <code>?window=common-slot-group-mock</code> · 공통 항목 1안
      </p>
      <p className="common-slot-group-proto__lead">
        <code>{card.pattern}</code> 카드는 그대로 두고, 안쪽만 표기별 행으로
        묶습니다. 정렬: <strong>건수 많은 순</strong> → 같으면{' '}
        <strong>첫 등장 페이지 순</strong>.
      </p>

      <div className="common-slot-group-proto__grid">
        <section aria-label="지금">
          <h2 className="common-slot-group-proto__col-title">지금 · 페이지 순</h2>
          <div className="common-slot-group-proto__shell">
            <p className="common-slot-group-proto__rail">공통 항목 찾기</p>
            <article className="common-slot-group-proto__card">
              <div className="common-slot-group-proto__card-head">
                <label className="common-slot-group-proto__check">
                  <input type="checkbox" defaultChecked readOnly aria-label="PDF 표시" />
                </label>
                <div className="common-slot-group-proto__card-main">
                  <span className="common-slot-group-proto__badge">
                    공통 항목 찾기
                  </span>
                  <span className="common-slot-group-proto__label">
                    {card.pattern}
                  </span>
                </div>
                <span className="common-slot-group-proto__findings">
                  {card.total}
                </span>
              </div>
              <div className="common-slot-group-proto__pages">
                {card.flatPages.map((page) => (
                  <span
                    key={`before-${page}`}
                    className="common-slot-group-proto__page"
                  >
                    {page}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section aria-label="제안">
          <h2 className="common-slot-group-proto__col-title common-slot-group-proto__col-title--after">
            제안 · 표기별 묶음
          </h2>
          <div className="common-slot-group-proto__shell">
            <p className="common-slot-group-proto__rail">공통 항목 찾기</p>
            <article className="common-slot-group-proto__card">
              <div className="common-slot-group-proto__card-head">
                <label className="common-slot-group-proto__check">
                  <input type="checkbox" defaultChecked readOnly aria-label="PDF 표시" />
                </label>
                <div className="common-slot-group-proto__card-main">
                  <span className="common-slot-group-proto__badge">
                    공통 항목 찾기
                  </span>
                  <span className="common-slot-group-proto__label">
                    {card.pattern}
                  </span>
                </div>
                <span className="common-slot-group-proto__findings">
                  {card.total}
                </span>
              </div>
              <ul className="common-slot-group-proto__fills">
                {card.rows.map((row) => (
                  <li key={row.text} className="common-slot-group-proto__fill">
                    <div className="common-slot-group-proto__fill-row">
                      <span className="common-slot-group-proto__fill-text">
                        {row.text}
                      </span>
                      <span className="common-slot-group-proto__fill-count">
                        {row.count}
                      </span>
                    </div>
                    <div className="common-slot-group-proto__fill-pages">
                      {row.pages.map((page) => (
                        <span
                          key={`${row.text}-${page}`}
                          className="common-slot-group-proto__page"
                        >
                          {page}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="common-slot-group-proto__sort-note">
                <strong>조선 시대</strong>와 <strong>신라시대</strong>는 둘 다
                5건 → 첫 페이지가 빠른 <strong>조선 시대(7P)</strong>가 앞,
                <strong>신라시대(10P)</strong>가 뒤.
              </p>
            </article>
          </div>
        </section>
      </div>

      <p className="common-slot-group-proto__footnote">
        실제품 연동 전 구조 확인용입니다. 카드·기준 수·체크박스는 유지하고
        안쪽 페이지만 표기별로 나눕니다.
      </p>
    </div>
  );
}
