/**
 * 작업 이력 — 맞춤법 2행 · 표기 통일(4분류+최근1회) · 본·보조 sparkline.
 */
import { WORK_CHART_MIN_SESSIONS_FOR_LINE } from '../../lib/projectWorkHistory.js';
import {
  buildWorkHistoryConsistencyCriteria,
  WORK_HISTORY_CONSISTENCY_GROUPS,
} from '../../presentation/workHistoryConsistencyCriteria.js';
import {
  buildSparklinePath,
  hasSpellingSplitHistory,
  sparklinePoints,
  WORK_HISTORY_SPARKLINE_HEIGHT,
  WORK_HISTORY_SPARKLINE_WIDTH,
} from '../../presentation/workHistorySparkline.js';

const SPARK_W = WORK_HISTORY_SPARKLINE_WIDTH;
const SPARK_H = WORK_HISTORY_SPARKLINE_HEIGHT;

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
 *   history: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[] | undefined,
 *   customRules?: import('../../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 * }} props
 */
export default function ProjectWorkHistoryChart({
  history,
  customRules = [],
  globalExcludePhrases = [],
}) {
  const sessions = Array.isArray(history) ? history : [];
  const sessionCount = sessions.length;
  const criteria = buildWorkHistoryConsistencyCriteria(
    customRules,
    globalExcludePhrases,
  );
  const spellingSplit = hasSpellingSplitHistory(sessions);

  if (!sessionCount) {
    return (
      <div className="project-hub-settings__card work-history-panel">
        <h3 className="work-history-panel__title">검수 진행 이력</h3>
        <p className="project-hub-settings__row-desc work-history-panel__empty">
          검수를 진행하면 항목별 추이가 여기에 표시됩니다.
        </p>
      </div>
    );
  }

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

  return (
    <div className="project-hub-settings__card work-history-panel">
      <h3 className="work-history-panel__title">검수 진행 이력</h3>

      <div className="work-history-panel__top-row">
        <section className="work-history-panel__block work-history-panel__block--spelling work-history-panel__block--half">
          {spellingSplit ? null : (
            <h4 className="work-history-panel__block-title">편집자 검토</h4>
          )}
          <div className="work-history-panel__block-body">
            {spellingSplit ? (
              <>
                <SparklineRow
                  label="편집자 검토"
                  subLabel
                  values={editorReviewValues}
                  sessionCount={sessionCount}
                  colorClass="work-history-panel__spark-row--spelling"
                  muted
                />
                <SparklineRow
                  label="맞춤법"
                  subLabel
                  values={builtinSpellingValues}
                  sessionCount={sessionCount}
                  colorClass="work-history-panel__spark-row--spelling"
                />
              </>
            ) : (
              <SparklineRow
                label="편집자 검토"
                values={legacySpellingValues}
                sessionCount={sessionCount}
                colorClass="work-history-panel__spark-row--spelling"
                hideLabel
              />
            )}
          </div>
        </section>

        <section className="work-history-panel__block work-history-panel__block--auxiliary work-history-panel__block--half">
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

      <section className="work-history-panel__block work-history-panel__block--consistency">
        <h4 className="work-history-panel__block-title">표기 통일(최근)</h4>
        <dl className="work-history-panel__criteria-groups">
          {WORK_HISTORY_CONSISTENCY_GROUPS.map((group) => {
            const items = criteria[group.id] ?? [];

            if (group.id === 'unify') {
              return (
                <div key={group.id} className="work-history-panel__criteria-group">
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
                            <ul className="work-history-panel__chips work-history-panel__chips--unify">
                              {entry.variants.map((variant) => (
                                <li
                                  key={variant}
                                  className="work-history-panel__chip"
                                >
                                  {variant}
                                </li>
                              ))}
                              {entry.pinned ? (
                                <li className="work-history-panel__chip work-history-panel__chip--pinned">
                                  {entry.pinned}
                                  <span
                                    className="work-history-panel__pin"
                                    aria-hidden
                                  >
                                    📌
                                  </span>
                                </li>
                              ) : null}
                            </ul>
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
              <div key={group.id} className="work-history-panel__criteria-group">
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
      </section>
    </div>
  );
}
