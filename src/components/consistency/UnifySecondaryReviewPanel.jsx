/**
 * 표기 통일 추천 — DEV 전용 「2차 검토」인라인 요약.
 * 실제 처리·변경된 항목만 표시. 0건 카테고리·「대상 없음」은 내지 않음.
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
 * }} SecondaryReviewSummary
 */

/**
 * @param {{ summary: SecondaryReviewSummary | null }} props
 */
export default function UnifySecondaryReviewPanel({ summary }) {
  if (!import.meta.env.DEV || !summary) return null;

  const pred = summary.predicate;
  const josa = summary.josa;
  const ruleExcluded = summary.ruleExcluded ?? [];
  const ambiguous = summary.triage?.ambiguous ?? [];
  const certainNoun = summary.triage?.certainNoun ?? [];
  const nounCount = certainNoun.length;
  const predicateEstCount = ambiguous.length;
  const ruleCount = ruleExcluded.length;

  const josaWithItems = [
    { title: '규칙으로 배지', items: josa?.rulePromoted ?? [] },
    { title: '모델이 조사·어미로 확인', items: josa?.slmConfirmed ?? [] },
    { title: '모델이 배지 해제(합성어 등)', items: josa?.slmCleared ?? [] },
    { title: '한도로 생략', items: josa?.capSkipped ?? [] },
  ].filter((s) => s.items.length > 0);

  const predWithItems = [
    { title: '목록에서 제외', items: pred?.dropped ?? [] },
    { title: '유지', items: pred?.kept ?? [] },
    { title: '실패·검토 필요', items: pred?.needsReview ?? [] },
  ].filter((s) => s.items.length > 0);

  if (
    !nounCount &&
    !predicateEstCount &&
    !ruleCount &&
    !josaWithItems.length &&
    !predWithItems.length
  ) {
    return null;
  }

  /** @type {string[]} */
  const discoveryBits = [];
  if (nounCount) discoveryBits.push(`명사 ${nounCount}건`);
  if (predicateEstCount) discoveryBits.push(`용언(추정) ${predicateEstCount}건`);
  if (ruleCount) discoveryBits.push(`규칙 제외 ${ruleCount}건`);

  let summaryText = '2차 검토';
  if (discoveryBits.length) {
    summaryText = `2차 검토에서 ${discoveryBits.join(', ')}이 발견되었습니다`;
  }

  /** @type {string[]} */
  const extraBits = [];
  if (josaWithItems.length) {
    const bits = [];
    const josaRule = josa?.rulePromoted?.length ?? 0;
    const josaOk = josa?.slmConfirmed?.length ?? 0;
    const josaNo = josa?.slmCleared?.length ?? 0;
    const josaCap = josa?.capSkipped?.length ?? josa?.droppedCap ?? 0;
    if (josaRule) bits.push(`규칙배지 ${josaRule}`);
    if (josaOk) bits.push(`조사확인 ${josaOk}`);
    if (josaNo) bits.push(`조사해제 ${josaNo}`);
    if (josaCap) bits.push(`한도생략 ${josaCap}`);
    if (bits.length) extraBits.push(`조사 ${bits.join('·')}`);
  }
  if (predWithItems.length) {
    const bits = [];
    if (pred?.reviewed) bits.push(`검토 ${pred.reviewed}`);
    if (pred?.dropped?.length) bits.push(`제외 ${pred.dropped.length}`);
    if (pred?.kept?.length) bits.push(`유지 ${pred.kept.length}`);
    if (pred?.needsReview?.length) bits.push(`실패 ${pred.needsReview.length}`);
    if (bits.length) extraBits.push(`모델 ${bits.join('·')}`);
  }
  if (extraBits.length) {
    summaryText = `${summaryText} · ${extraBits.join(' · ')}`;
  }

  return (
    <details className="unify-candidate-find__secondary-review" open>
      <summary className="unify-candidate-find__secondary-review-summary">
        {summaryText}
      </summary>
      <div className="unify-candidate-find__secondary-review-body">
        <details className="unify-candidate-find__secondary-review-help">
          <summary>이 패널 안내</summary>
          <p className="unify-candidate-find__secondary-review-note">
            [명사] [용언(추정)]에 속하지 않는 항목은 목록에서 제외했습니다. 용언은
            빈도를 확인하여 추정합니다.
          </p>
        </details>

        {ruleCount > 0 ? (
          <div className="unify-candidate-find__secondary-review-block">
            <div className="unify-candidate-find__secondary-review-block-title">
              목록 제외
            </div>
            <ProcessedList
              items={ruleExcluded.map((item) => ({
                ...item,
                label: item.reason
                  ? `${item.label} -${item.reason}`
                  : item.label,
              }))}
            />
          </div>
        ) : null}

        {josaWithItems.length > 0 ? (
          <div className="unify-candidate-find__secondary-review-block">
            <div className="unify-candidate-find__secondary-review-block-title">
              조사·어간
            </div>
            {josaWithItems.map((section) => (
              <ProcessedSection
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        ) : null}

        {predWithItems.length > 0 ? (
          <div className="unify-candidate-find__secondary-review-block">
            <div className="unify-candidate-find__secondary-review-block-title">
              유지/삭제 모델
            </div>
            {predWithItems.map((section) => (
              <ProcessedSection
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

/**
 * @param {{ title: string, items: ReviewItem[] }} props
 */
function ProcessedSection({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="unify-candidate-find__secondary-review-section">
      <div className="unify-candidate-find__secondary-review-heading">
        {title}
        <span className="unify-candidate-find__secondary-review-count">
          {' '}
          {items.length}
        </span>
      </div>
      <ProcessedList items={items} />
    </div>
  );
}

/**
 * @param {{ items: ReviewItem[] }} props
 */
function ProcessedList({ items }) {
  return (
    <ul className="unify-candidate-find__secondary-review-list">
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ul>
  );
}
