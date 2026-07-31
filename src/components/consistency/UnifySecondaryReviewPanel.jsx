/**
 * 표기 통일 추천 — DEV 전용 「2차 검토」인라인 요약.
 * 요약만 보이고, 눌러야 항목이 나온다.
 * @see project-docs/unify-predicate-review-slm-design-2026-07-30.md
 */

/**
 * @typedef {{ id: string, label: string, reason?: string }} ReviewItem
 * @typedef {{
 *   phase?: 'rule_only' | string,
 *   ruleExcluded?: ReviewItem[],
 *   triage?: {
 *     certainNoun?: ReviewItem[],
 *     ambiguous?: ReviewItem[],
 *   },
 *   josa?: {
 *     ran?: boolean,
 *     droppedCap?: number,
 *     rulePromoted?: ReviewItem[],
 *     slmConfirmed?: ReviewItem[],
 *     slmCleared?: ReviewItem[],
 *     capSkipped?: ReviewItem[],
 *   },
 *   predicate?: {
 *     reviewed: number,
 *     dropped: ReviewItem[],
 *     kept: ReviewItem[],
 *     needsReview: ReviewItem[],
 *   },
 *   stdict?: {
 *     ran?: boolean,
 *     reviewed?: number,
 *     movedNounToPredicate?: ReviewItem[],
 *     confirmedNoun?: ReviewItem[],
 *     confirmedPredicate?: ReviewItem[],
 *     missing?: ReviewItem[],
 *     error?: string,
 *   },
 * }} SecondaryReviewSummary
 */

/**
 * @param {{ summary: SecondaryReviewSummary | null }} props
 */
export default function UnifySecondaryReviewPanel({ summary }) {
  if (!import.meta.env.DEV || !summary) return null;

  const stdict = summary.stdict;
  const ambiguous = summary.triage?.ambiguous ?? [];
  const certainNoun = summary.triage?.certainNoun ?? [];
  const stdictKeptNoun = stdict?.confirmedNoun ?? [];
  const stdictMissing = stdict?.missing ?? [];
  const stdictRan = Boolean(stdict?.ran);
  const stdictError = String(stdict?.error ?? '').trim();

  // 용언(추정)과 겹치면 명사에서 제외 — 예: @보자는 사전 명사여도 규칙상 용언(추정)
  const ambiguousIds = new Set(ambiguous.map((x) => x.id));
  const ambiguousLabels = new Set(ambiguous.map((x) => x.label));
  const rawNounItems = stdictRan ? stdictKeptNoun : certainNoun;
  const nounItems = rawNounItems.filter(
    (item) =>
      !ambiguousIds.has(item.id) && !ambiguousLabels.has(item.label),
  );
  const predicateEstItems = ambiguous;
  const missingItems = stdictMissing;

  if (
    !nounItems.length &&
    !predicateEstItems.length &&
    !missingItems.length &&
    !stdictError
  ) {
    return null;
  }

  const hasBody =
    nounItems.length > 0 ||
    predicateEstItems.length > 0 ||
    missingItems.length > 0 ||
    Boolean(stdictError);

  return (
    <details className="unify-candidate-find__secondary-review">
      <summary className="unify-candidate-find__secondary-review-summary">
        표준국어대사전 검토 결과
      </summary>
      {hasBody ? (
        <div className="unify-candidate-find__secondary-review-body">
          {stdictError ? (
            <p className="unify-candidate-find__secondary-review-note">
              사전 검토 실패: {stdictError}
            </p>
          ) : null}

          <ProcessedSection
            title="명사"
            items={nounItems}
            countTight
          />
          <ProcessedSection
            title="용언(추정)"
            items={predicateEstItems}
          />
          <ProcessedSection
            title="미등재·혼재"
            items={missingItems}
          />
        </div>
      ) : null}
    </details>
  );
}

/**
 * @param {{
 *   title: string,
 *   items: ReviewItem[],
 *   countTight?: boolean,
 * }} props
 */
function ProcessedSection({ title, items, countTight = false }) {
  if (!items.length) return null;
  return (
    <div className="unify-candidate-find__secondary-review-section">
      <div className="unify-candidate-find__secondary-review-heading">
        {title}
        {countTight ? null : ' '}
        <span className="unify-candidate-find__secondary-review-count">
          {items.length}
        </span>
      </div>
      <p className="unify-candidate-find__secondary-review-inline">
        {items.map((item) => item.label).join(' ')}
      </p>
    </div>
  );
}
