import {
  MOCK_CATEGORIES,
  MOCK_TOTAL_FINDINGS,
} from './mockResultsAccordionData.js';
import './results-accordion-prototype.css';

/**
 * DEV: ?window=results-mock
 * 검수 후 결과를 「전체 발견 + 카테고리 accordion」으로 보여주는 대략 목업.
 * 실 CheckResultsPanel 연동 없음.
 */
export default function ResultsAccordionPrototypeScreen() {
  return (
    <div className="results-acc-proto">
      <p className="results-acc-proto__banner">
        DEV 목업 — 검수 결과 accordion (전체 발견 + 카테고리 묶음)
      </p>

      <div className="results-acc-proto__shell" aria-label="검수 결과 목업">
        <p className="results-acc-proto__total">
          전체 발견{' '}
          <span className="results-acc-proto__total-count">{MOCK_TOTAL_FINDINGS}</span>
        </p>

        <div className="results-acc-proto__list">
          {MOCK_CATEGORIES.map((cat) => (
            <details
              key={cat.id}
              className="results-acc-proto__cat"
              open={cat.defaultOpen}
            >
              <summary className="results-acc-proto__summary">
                <span className="results-acc-proto__chevron" aria-hidden>
                  ▼
                </span>
                <span className="results-acc-proto__cat-label">{cat.label}</span>
                <span className="results-acc-proto__cat-meta">
                  <span className="results-acc-proto__criteria">
                    {cat.criteriaCount}
                  </span>
                  <span className="results-acc-proto__criteria-unit">기준</span>
                  <span className="results-acc-proto__findings">
                    {cat.findingsCount}
                  </span>
                </span>
              </summary>

              <div className="results-acc-proto__body">
                {cat.cards.map((card) => (
                  <article key={card.id} className="results-acc-proto__card">
                    <h3 className="results-acc-proto__card-title">{card.title}</h3>
                    <p className="results-acc-proto__card-tip">{card.tip}</p>
                    <div className="results-acc-proto__pages">
                      {card.pages.map((page) => (
                        <span key={page} className="results-acc-proto__page">
                          {page}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>

      <p className="results-acc-proto__note">
        실제 MainScreen·CheckResultsPanel은 변경하지 않은 목업입니다. 구조만
        확인용. 표기 통일 flat 안은{' '}
        <code>?window=consistency-results-mock</code>
      </p>
    </div>
  );
}
