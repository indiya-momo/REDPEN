/**
 * 작업 이력 — 맞춤법 각 1행 · 표기 통일(현재 기준+확정) · 본·보조.
 */
import { WORK_CHART_MIN_SESSIONS_FOR_LINE } from '../../lib/projectWorkHistory.js';
import {
  buildWorkHistoryConsistencyCriteria,
  WORK_HISTORY_CONSISTENCY_GROUPS,
} from '../../presentation/workHistoryConsistencyCriteria.js';
import { buildWorkHistoryDecisionLedger } from '../../presentation/workHistoryDecisionLedger.js';
import {
  buildSparklinePath,
  hasSpellingSplitHistory,
  sparklinePoints,
  WORK_HISTORY_SPARKLINE_HEIGHT,
  WORK_HISTORY_SPARKLINE_WIDTH,
} from '../../presentation/workHistorySparkline.js';

const SPARK_W = WORK_HISTORY_SPARKLINE_WIDTH;
const SPARK_H = WORK_HISTORY_SPARKLINE_HEIGHT;

/** @type {ReadonlySet<'find' | 'unify'>} */
const TALL_CRITERIA_GROUP_IDS = new Set(['find', 'unify']);

/**
 * @param {{
 *   label: string,
 *   subLabel?: boolean,
 *   values: number[],
 *   sessionCount: number,
 *   colorClass: string,
 *   muted?: boolean,
 *   hideLabel?: boolean,
 * }} props
 */
function SparklineRow({
  label,
  subLabel = false,
  values,
  sessionCount,
  colorClass,
  muted = false,
  hideLabel = false,
}) {
  const latest = values[values.length - 1] ?? 0;
  const path = buildSparklinePath(values, SPARK_W, SPARK_H);
  const points = sparklinePoints(values, SPARK_W, SPARK_H);

  return (
    <div
      className={`work-history-panel__spark-row ${colorClass}${
        subLabel ? ' work-history-panel__spark-row--sub' : ''
      }${muted ? ' work-history-panel__spark-row--muted' : ''}${
        hideLabel ? ' work-history-panel__spark-row--no-label' : ''
      }`}
    >
      {hideLabel ? null : (
        <span className="work-history-panel__spark-label">{label}</span>
      )}
      <svg
        className="work-history-panel__spark"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        role="img"
        aria-label={`${label} 최근 ${sessionCount}회 추이`}
      >
        <line
          x1={0}
          x2={SPARK_W}
          y1={SPARK_H / 2}
          y2={SPARK_H / 2}
          className="work-history-panel__spark-grid"
        />
        {sessionCount >= WORK_CHART_MIN_SESSIONS_FOR_LINE ? (
          <path d={path} className="work-history-panel__spark-line" />
        ) : null}
        {points.map((point, index) => (
          <circle
            key={`${label}-${index}`}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className="work-history-panel__spark-dot"
          >
            <title>{`${label} ${index + 1}회차 ${point.value}건`}</title>
          </circle>
        ))}
      </svg>
      <span className="work-history-panel__latest">
        {latest}
        <span className="work-history-panel__unit">건</span>
      </span>
    </div>
  );
}

/**
 * @param {import('../../lib/projectWorkHistory.js').WorkHistoryEntry[]} sessions
 * @param {(entry: import('../../lib/projectWorkHistory.js').WorkHistoryEntry) => number | undefined} pick
 */
function sparklineSeries(sessions, pick) {
  return sessions.map((entry) => {
    const value = pick(entry);
    return typeof value === 'number' ? value : 0;
  });
}

/**
 * @param {{
 *   variants: string[],
 *   pinned?: string | null,
 * }} props
 */
function UnifyChipRow({ variants, pinned = null }) {
  return (
    <ul className="work-history-panel__chips work-history-panel__chips--unify">
      {variants.map((variant) => (
        <li key={variant} className="work-history-panel__chip">
          {variant}
        </li>
      ))}
      {pinned ? (
        <li className="work-history-panel__chip work-history-panel__chip--pinned">
          {pinned}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * @param {{
 *   criteria: ReturnType<typeof buildWorkHistoryConsistencyCriteria>,
 *   ledger: ReturnType<typeof buildWorkHistoryDecisionLedger>,
 * }} props
 */
function ConsistencyCriteriaBlock({ criteria, ledger }) {
  return (
    <section className="work-history-panel__block work-history-panel__block--consistency">
      <h4 className="work-history-panel__block-title">표기 통일(현재 기준)</h4>
      <dl className="work-history-panel__criteria-groups">
        {WORK_HISTORY_CONSISTENCY_GROUPS.map((group) => {
          const items = criteria[group.id] ?? [];
          const tall = TALL_CRITERIA_GROUP_IDS.has(group.id);

          if (group.id === 'unify') {
            return (
              <div
                key={group.id}
                className={`work-history-panel__criteria-group${
                  tall ? ' work-history-panel__criteria-group--tall' : ''
                }`}
              >
                <dt className="work-history-panel__criteria-label">
                  {group.label}
                </dt>
                <dd className="work-history-panel__criteria-body">
                  {items.length ? (
                    <ul className="work-history-panel__unify-list">
                      {items.map((entry) => (
                        <li
                          key={`${entry.variants.join('\u0001')}\u0002${entry.pinned ?? ''}`}
                          className="work-history-panel__unify-entry"
                        >
                          <UnifyChipRow
                            variants={entry.variants}
                            pinned={entry.pinned}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="work-history-panel__criteria-empty">등록 없음</p>
                  )}
                </dd>
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className={`work-history-panel__criteria-group${
                tall ? ' work-history-panel__criteria-group--tall' : ''
              }`}
            >
              <dt className="work-history-panel__criteria-label">
                {group.label}
              </dt>
              <dd className="work-history-panel__criteria-body">
                {items.length ? (
                  <ul className="work-history-panel__chips">
                    {items.map((item) => (
                      <li key={item} className="work-history-panel__chip">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="work-history-panel__criteria-empty">등록 없음</p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="work-history-panel__ledger">
        {ledger.length ? (
          <ul className="work-history-panel__ledger-list">
            {ledger.map((item) => (
              <li key={item.id} className="work-history-panel__ledger-item">
                <div className="work-history-panel__ledger-meta">
                  {item.atLabel || '날짜 없음'}
                </div>
                <UnifyChipRow variants={item.variants} pinned={item.pinned} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="work-history-panel__criteria-empty">
            통일형을 지정하면 확정 기록이 여기에 쌓입니다.
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * @param {{
 *   history: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[] | undefined,
 *   customRules?: import('../../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[],
 * }} props
 */
export default function ProjectWorkHistoryChart({
  history,
  customRules = [],
  globalExcludePhrases = [],
  consistencyDecisions = [],
}) {
  const sessions = Array.isArray(history) ? history : [];
  const sessionCount = sessions.length;
  const criteria = buildWorkHistoryConsistencyCriteria(
    customRules,
    globalExcludePhrases,
  );
  const ledger = buildWorkHistoryDecisionLedger(consistencyDecisions);
  const spellingSplit = hasSpellingSplitHistory(sessions);

  const editorReviewValues = sparklineSeries(
    sessions,
    (entry) => entry.editorReview,
  );
  const builtinSpellingValues = sparklineSeries(
    sessions,
    (entry) => entry.spelling,
  );
  const legacySpellingValues = sparklineSeries(
    sessions,
    (entry) => entry.spelling,
  );
  const bonBojoValues = sparklineSeries(sessions, (entry) => entry.bonBojo);

  if (!sessionCount) {
    return (
      <div className="project-hub-settings__card work-history-panel">
        <h3 className="work-history-panel__title">검수 진행 이력</h3>
        <p className="project-hub-settings__row-desc work-history-panel__empty">
          검수를 진행하면 항목별 추이가 여기에 표시됩니다.
        </p>
        <ConsistencyCriteriaBlock criteria={criteria} ledger={ledger} />
      </div>
    );
  }

  return (
    <div className="project-hub-settings__card work-history-panel">
      <h3 className="work-history-panel__title">검수 진행 이력</h3>

      {spellingSplit ? (
        <>
          <section className="work-history-panel__block work-history-panel__block--spelling">
            <h4 className="work-history-panel__block-title">편집자 검토</h4>
            <div className="work-history-panel__block-body">
              <SparklineRow
                label="편집자 검토"
                values={editorReviewValues}
                sessionCount={sessionCount}
                colorClass="work-history-panel__spark-row--spelling"
                muted
                hideLabel
              />
            </div>
          </section>
          <section className="work-history-panel__block work-history-panel__block--spelling">
            <h4 className="work-history-panel__block-title">맞춤법</h4>
            <div className="work-history-panel__block-body">
              <SparklineRow
                label="맞춤법"
                values={builtinSpellingValues}
                sessionCount={sessionCount}
                colorClass="work-history-panel__spark-row--spelling"
                hideLabel
              />
            </div>
          </section>
        </>
      ) : (
        <section className="work-history-panel__block work-history-panel__block--spelling">
          <h4 className="work-history-panel__block-title">편집자 검토</h4>
          <div className="work-history-panel__block-body">
            <SparklineRow
              label="편집자 검토"
              values={legacySpellingValues}
              sessionCount={sessionCount}
              colorClass="work-history-panel__spark-row--spelling"
              hideLabel
            />
          </div>
        </section>
      )}

      <ConsistencyCriteriaBlock criteria={criteria} ledger={ledger} />

      <section className="work-history-panel__block work-history-panel__block--auxiliary">
        <h4 className="work-history-panel__block-title">본용언+보조용언</h4>
        <div className="work-history-panel__block-body">
          <SparklineRow
            label="본용언+보조용언"
            values={bonBojoValues}
            sessionCount={sessionCount}
            colorClass="work-history-panel__spark-row--auxiliary"
            hideLabel
          />
        </div>
      </section>
    </div>
  );
}
