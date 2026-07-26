import { useMemo, useState } from 'react';
import {
  MOCK_CONSISTENCY_RESULT_CARDS,
  MOCK_CONSISTENCY_TOTAL_FINDINGS,
} from './mockConsistencyResultsFlatData.js';
import './consistency-results-flat-prototype.css';

/**
 * DEV: ?window=consistency-results-mock
 * 표기 통일 결과 — 폴더 없이 flat 리스트, 표기 통일하기 맨 위·흰 카드 강조.
 * 실 CheckResultsPanel / MainScreen 은 변경하지 않음.
 */
export default function ConsistencyResultsFlatPrototypeScreen() {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(
      MOCK_CONSISTENCY_RESULT_CARDS.map((c) => [c.id, true]),
    ),
  );

  const visibleFindings = useMemo(
    () =>
      MOCK_CONSISTENCY_RESULT_CARDS.reduce(
        (sum, c) => sum + (checked[c.id] ? c.findings : 0),
        0,
      ),
    [checked],
  );

  return (
    <div className="consistency-results-flat-proto">
      <p className="consistency-results-flat-proto__banner">
        DEV 목업 · <code>?window=consistency-results-mock</code> · flat 리스트
        (표기 통일하기 우선 · 흰 카드)
      </p>

      <div
        className="consistency-results-flat-proto__shell"
        aria-label="표기 통일 결과 flat 목업"
      >
        <p className="consistency-results-flat-proto__total">
          <span className="consistency-results-flat-proto__total-label">
            전체 발견
          </span>
          <span
            className="consistency-results-flat-proto__total-count"
            title={`표시 ${visibleFindings} / 전체 ${MOCK_CONSISTENCY_TOTAL_FINDINGS}`}
          >
            {visibleFindings}
          </span>
        </p>

        <ul className="consistency-results-flat-proto__list">
          {MOCK_CONSISTENCY_RESULT_CARDS.map((card, index) => {
            const prev = MOCK_CONSISTENCY_RESULT_CARDS[index - 1];
            const showUnifyDivider =
              card.emphasize && (!prev || !prev.emphasize);
            const showOtherDivider =
              !card.emphasize && prev?.emphasize;

            return (
              <li key={card.id} className="consistency-results-flat-proto__item">
                {showUnifyDivider ? (
                  <p className="consistency-results-flat-proto__rail">
                    표기 통일하기
                  </p>
                ) : null}
                {showOtherDivider ? (
                  <p className="consistency-results-flat-proto__rail consistency-results-flat-proto__rail--muted">
                    그 외 찾기
                  </p>
                ) : null}
                <article
                  className={[
                    'consistency-results-flat-proto__card',
                    card.emphasize
                      ? 'consistency-results-flat-proto__card--unify'
                      : 'consistency-results-flat-proto__card--other',
                    !checked[card.id]
                      ? 'consistency-results-flat-proto__card--off'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="consistency-results-flat-proto__card-head">
                    <label
                      className="consistency-results-flat-proto__check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked[card.id])}
                        onChange={() =>
                          setChecked((prevState) => ({
                            ...prevState,
                            [card.id]: !prevState[card.id],
                          }))
                        }
                        aria-label={`${card.label} PDF 표시`}
                      />
                    </label>
                    <div className="consistency-results-flat-proto__card-main">
                      <span
                        className={`consistency-results-flat-proto__badge consistency-results-flat-proto__badge--${card.kind}`}
                      >
                        {card.badge}
                      </span>
                      <span className="consistency-results-flat-proto__label">
                        {card.label}
                      </span>
                    </div>
                    <span className="consistency-results-flat-proto__findings">
                      {checked[card.id] ? card.findings : 0}
                    </span>
                  </div>
                  <div className="consistency-results-flat-proto__pages">
                    {card.pages.map((page) => (
                      <span
                        key={`${card.id}-${page}`}
                        className="consistency-results-flat-proto__page"
                      >
                        {page}
                      </span>
                    ))}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="consistency-results-flat-proto__note">
        폴더 accordion 없음 · 유형은 뱃지로 구분 · 통일 카드만 흰 면으로
        강조. 실제품 연동 전 구조 확인용입니다.
      </p>
    </div>
  );
}
