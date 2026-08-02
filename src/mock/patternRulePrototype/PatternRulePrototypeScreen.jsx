import {
  MOCK_PATTERN_MISMATCHES,
  MOCK_PATTERN_RULE,
} from './mockPatternRuleData.js';
import './pattern-rule-prototype.css';

/**
 * DEV: ?window=pattern-rule-mock
 * patternRule 어긋남 표시 위치 — 1안(추천 패널) · 2안(기준 검수 결과).
 * 실제품 미연동.
 */
export default function PatternRulePrototypeScreen() {
  const rule = MOCK_PATTERN_RULE;
  const total = MOCK_PATTERN_MISMATCHES.reduce((s, m) => s + m.count, 0);

  return (
    <div className="pattern-rule-proto">
      <p className="pattern-rule-proto__banner">
        DEV 목업 · <code>?window=pattern-rule-mock</code> · patternRule 1·2안
      </p>
      <p className="pattern-rule-proto__lead">
        <code>{rule.confirmedFrom}</code>를 {rule.directionLabel}으로 확정한 뒤,{' '}
        <strong>접미 계열 <code>{rule.template}</code> 전체에 적용?</strong> confirm →
        미리보기. 블랙리스트(<code>여러/전/역대…</code>)는 목록에서 이미 제외된
        상태라고 가정합니다.
      </p>

      <div className="pattern-rule-proto__grid">
        <section aria-label="1안 추천 패널">
          <h2 className="pattern-rule-proto__col-title pattern-rule-proto__col-title--a">
            1안 · 추천 패널 안 새 구역
          </h2>
          <div className="pattern-rule-proto__shell">
            <p className="pattern-rule-proto__rail">표기 통일 추천</p>

            <div className="pattern-rule-proto__confirm">
              <strong>@정부</strong>(○○정부 형태) 전체를 붙여 쓰는 쪽으로
              통일할까요?
              <br />
              <span className="pattern-rule-proto__meta">
                기준: {rule.confirmedFrom}
              </span>
              <div className="pattern-rule-proto__confirm-actions">
                <button type="button" className="pattern-rule-proto__btn pattern-rule-proto__btn--primary">
                  예, 미리보기
                </button>
                <button type="button" className="pattern-rule-proto__btn">
                  이 쌍만
                </button>
              </div>
            </div>

            <article className="pattern-rule-proto__cluster">
              <div className="pattern-rule-proto__cluster-head">
                <span>미국@</span>
                <span className="pattern-rule-proto__meta">계열 · 이미 확정</span>
              </div>
              <div className="pattern-rule-proto__variant">
                미국 정부 → <strong>미국정부</strong> (붙임)
              </div>
            </article>

            <section className="pattern-rule-proto__section" aria-label="규칙 어긋남">
              <div className="pattern-rule-proto__section-head">
                <h3 className="pattern-rule-proto__section-title">
                  @정부 규칙(붙임)과 어긋남
                </h3>
                <span className="pattern-rule-proto__meta">{total}발견</span>
              </div>
              <p className="pattern-rule-proto__hint">
                짝이 없던 표기까지 포함합니다. 확인 후 일괄 적용하세요.
              </p>
              <ul className="pattern-rule-proto__list">
                {MOCK_PATTERN_MISMATCHES.map((m) => (
                  <li key={m.from} className="pattern-rule-proto__item">
                    <div className="pattern-rule-proto__row">
                      <span className="pattern-rule-proto__map">
                        {m.from}{' '}
                        <span className="pattern-rule-proto__arrow">→</span>{' '}
                        {m.to}
                      </span>
                      <span className="pattern-rule-proto__count">{m.count}</span>
                    </div>
                    <div className="pattern-rule-proto__pages">
                      {m.pages.map((p) => (
                        <span key={`${m.from}-${p}`} className="pattern-rule-proto__page">
                          {p}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pattern-rule-proto__footer-actions">
                <button type="button" className="pattern-rule-proto__btn">
                  취소
                </button>
                <button type="button" className="pattern-rule-proto__btn pattern-rule-proto__btn--primary">
                  이 목록으로 통일
                </button>
              </div>
            </section>
          </div>
        </section>

        <section aria-label="2안 기준 검수 결과">
          <h2 className="pattern-rule-proto__col-title pattern-rule-proto__col-title--b">
            2안 · 기준 검수 결과에도 반영
          </h2>
          <div className="pattern-rule-proto__shell">
            <p className="pattern-rule-proto__rail">표기 통일 확인 (결과)</p>
            <p className="pattern-rule-proto__hint" style={{ marginBottom: 10 }}>
              세션 <code>patternRule</code>이 만든 수정형을{' '}
              <strong>표기 통일하기</strong> 결과 카드처럼 보여 줍니다. (1차에는
              등록 CRUD 없이 세션만)
            </p>

            <article className="pattern-rule-proto__card">
              <div className="pattern-rule-proto__card-head">
                <span className="pattern-rule-proto__badge">표기 통일하기</span>
                <span className="pattern-rule-proto__label">
                  미국 정부 → 미국정부
                </span>
                <span className="pattern-rule-proto__findings">6</span>
              </div>
              <div className="pattern-rule-proto__pages" style={{ marginTop: 6, paddingLeft: 0 }}>
                <span className="pattern-rule-proto__page">12P</span>
                <span className="pattern-rule-proto__page">40P</span>
              </div>
            </article>

            {MOCK_PATTERN_MISMATCHES.map((m) => (
              <article key={m.from} className="pattern-rule-proto__card">
                <div className="pattern-rule-proto__card-head">
                  <span className="pattern-rule-proto__badge pattern-rule-proto__badge--rule">
                    @정부 규칙
                  </span>
                  <span className="pattern-rule-proto__label">
                    {m.from} → {m.to}
                  </span>
                  <span className="pattern-rule-proto__findings">{m.count}</span>
                </div>
                <div className="pattern-rule-proto__pages" style={{ marginTop: 6, paddingLeft: 0 }}>
                  {m.pages.map((p) => (
                    <span key={`${m.from}-b-${p}`} className="pattern-rule-proto__page">
                      {p}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <p className="pattern-rule-proto__footnote">
        1안은 추천 찾기 흐름 안에 미리보기·일괄이 닫힙니다. 2안은 기준 검수 결과
        목록과 같은 자리에서 보이지만, 등록 규칙 승격 전이라 배지를 구분해 두었습니다.
      </p>
    </div>
  );
}
