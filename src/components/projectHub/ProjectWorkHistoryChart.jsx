/**
 * 작업 이력 — 맞춤법(편집자 검토·맞춤법) · 표기 통일(현재 기준+확정) · 본·보조.
 */
import {
  buildDisplayWorkHistory,
  normalizeWorkHistory,
  workHistoryDateKeyFromIso,
  WORK_CHART_MIN_SESSIONS_FOR_LINE,
} from '../../lib/projectWorkHistory.js';
import {
  buildWorkHistoryConsistencyCriteria,
  WORK_HISTORY_CONSISTENCY_GROUPS,
} from '../../presentation/workHistoryConsistencyCriteria.js';
import {
  buildWorkHistoryDecisionLedger,
} from '../../presentation/workHistoryDecisionLedger.js';
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
 * 스파크라인 눈금 — 날짜. 같은 날 여러 검수면 `M.D N회`.
 * @param {string} iso
 * @param {import('../../lib/projectWorkHistory.js').WorkHistoryEntry[]} [sessions]
 * @param {number} [index]
 */
function formatSessionAxisTick(iso, sessions = [], index = 0) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = `${d.getMonth() + 1}.${d.getDate()}`;
  const dayKey = workHistoryDateKeyFromIso(iso);
  if (!dayKey || sessions.length < 2) return datePart;
  const sameDay = sessions
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry }) => workHistoryDateKeyFromIso(entry.at) === dayKey);
  if (sameDay.length <= 1) return datePart;
  const order = sameDay.findIndex(({ i }) => i === index) + 1;
  return `${datePart} ${order}회`;
}

/**
 * @param {{
 *   label: string,
 *   subLabel?: boolean,
 *   values: number[],
 *   sessionAts?: string[],
 *   sessionCount: number,
 *   colorClass: string,
 *   muted?: boolean,
 *   sessions?: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[],
 *   hideLabel?: boolean,
 * }} props
 */
function SparklineRow({
  label,
  subLabel = false,
  values,
  sessionAts = [],
  sessions = [],
  sessionCount,
  colorClass,
  muted = false,
  hideLabel = false,
}) {
  const path = buildSparklinePath(values, SPARK_W, SPARK_H);
  const points = sparklinePoints(values, SPARK_W, SPARK_H);

  return (
    <div
      className={`work-history-panel__spark-row ${colorClass}${
        subLabel ? ' work-history-panel__spark-row--sub' : ''
      }${muted ? ' work-history-panel__spark-row--muted' : ''}`}
    >
      <span
        className="work-history-panel__spark-label"
        aria-hidden={hideLabel ? true : undefined}
      >
        {hideLabel ? null : label}
      </span>
      <div className="work-history-panel__spark-plot">
        <svg
          className="work-history-panel__spark"
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          preserveAspectRatio="none"
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
        </svg>
        <div className="work-history-panel__spark-dots" aria-hidden="true">
          {points.map((point, index) => {
            const atLabel = sessionAts[index]
              ? formatSessionAxisTick(sessionAts[index], sessions, index)
              : `${index + 1}회차`;
            return (
              <span
                key={`${label}-${index}`}
                className="result-findings-count-circle work-history-panel__spark-value"
                style={{
                  left: `${(point.x / SPARK_W) * 100}%`,
                  top: `${(point.y / SPARK_H) * 100}%`,
                }}
                title={`${label} ${atLabel} · ${point.value}건`}
              >
                {point.value}
              </span>
            );
          })}
        </div>
      </div>
      <span className="work-history-panel__latest" aria-hidden="true" />
    </div>
  );
}

/**
 * 세션에 기록된 실제 건수만 쓴다. (미기록은 0)
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
 *   sessions: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[],
 *   compact?: boolean,
 * }} props
 */
function SessionDateAxis({ sessions }) {
  if (sessions.length < 1) return null;
  const count = sessions.length;

  return (
    <div className="work-history-panel__session-axis">
      <span className="work-history-panel__session-axis-gutter" />
      <div className="work-history-panel__session-dates">
        {sessions.map((entry, index) => {
          const leftPct = count === 1 ? 50 : (index / (count - 1)) * 100;
          return (
            <span
              key={entry.at}
              className="work-history-panel__session-date-tick"
              style={{ left: `${leftPct}%` }}
              title={`${index + 1}회차 ${formatSessionAxisTick(entry.at, sessions, index)}`}
            >
              {formatSessionAxisTick(entry.at, sessions, index)}
            </span>
          );
        })}
      </div>
      <span className="work-history-panel__session-axis-end" />
    </div>
  );
}

/**
 * @param {{
 *   variants: string[],
 *   pinned?: string | null,
 *   atLabel?: string,
 * }} props
 */
function UnifyArrowRow({ variants, pinned = null, atLabel = '' }) {
  const findChips = variants.filter(Boolean);

  if (!pinned) {
    if (!findChips.length) return null;
    return (
      <div className="work-history-panel__unify-decision">
        {atLabel ? (
          <div className="work-history-panel__unify-at">{atLabel}</div>
        ) : null}
        <ul className="work-history-panel__chips work-history-panel__chips--unify">
          {findChips.map((variant) => (
            <li key={variant} className="work-history-panel__chip">
              {variant}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="work-history-panel__unify-decision">
      {atLabel ? (
        <div className="work-history-panel__unify-at">{atLabel}</div>
      ) : null}
      <div className="work-history-panel__unify-arrow-row">
        {findChips.length ? (
          <ul className="work-history-panel__chips work-history-panel__chips--unify">
            {findChips.map((variant) => (
              <li key={variant} className="work-history-panel__chip">
                {variant}
              </li>
            ))}
          </ul>
        ) : (
          <span className="work-history-panel__criteria-empty">수정형 없음</span>
        )}
        <span className="work-history-panel__unify-arrow" aria-hidden="true">
          →
        </span>
        <span className="work-history-panel__chip work-history-panel__chip--pinned">
          <span className="work-history-panel__chip-pin" aria-hidden="true">
            📌
          </span>
          {pinned}
        </span>
      </div>
    </div>
  );
}

/**
 * @param {{ key: string, label: string, atLabel: string }[]} rows
 * @returns {{ atLabel: string, items: { key: string, label: string }[] }[]}
 */
function groupDatedChipsByAt(rows) {
  /** @type {Map<string, { atLabel: string, items: { key: string, label: string }[] }>} */
  const byAt = new Map();
  /** @type {{ atLabel: string, items: { key: string, label: string }[] }[]} */
  const groups = [];
  for (const row of rows) {
    const atLabel = row.atLabel || '';
    let group = byAt.get(atLabel);
    if (!group) {
      group = { atLabel, items: [] };
      byAt.set(atLabel, group);
      groups.push(group);
    }
    group.items.push({ key: row.key, label: row.label });
  }
  return groups;
}

/**
 * @param {{
 *   labels: string[],
 *   atLabel?: string,
 * }} props
 */
function DatedChipGroup({ labels, atLabel = '' }) {
  if (!labels.length) return null;
  return (
    <div className="work-history-panel__unify-decision">
      {atLabel ? (
        <div className="work-history-panel__unify-at">{atLabel}</div>
      ) : null}
      <ul className="work-history-panel__chips work-history-panel__chips--parallel">
        {labels.map((label) => (
          <li key={label} className="work-history-panel__chip">
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   criteria: ReturnType<typeof buildWorkHistoryConsistencyCriteria>,
 *   ledger: ReturnType<typeof buildWorkHistoryDecisionLedger>,
 * }} props
 */
function ConsistencyCriteriaBlock({
  criteria,
  ledger,
}) {
  const unifyLedger = ledger.filter((item) => item.kind === 'unify');
  const findLedger = ledger.filter((item) => item.kind === 'find');
  const commonLedger = ledger.filter((item) => item.kind === 'commonString');

  /** @type {{ key: string, variants: string[], pinned: string | null, atLabel: string }[]} */
  const unifyRows = unifyLedger.length
    ? unifyLedger.map((item) => ({
        key: item.id,
        variants: item.variants,
        pinned: item.pinned || null,
        atLabel: item.atLabel || '',
      }))
    : (criteria.unify ?? []).map((entry, index) => ({
        key: `criteria-${index}-${entry.variants.join('\u0001')}-${entry.pinned ?? ''}`,
        variants: entry.variants,
        pinned: entry.pinned,
        atLabel: '',
      }));

  /** @type {{ key: string, label: string, atLabel: string }[]} */
  const findRows = findLedger.length
    ? findLedger.map((item) => ({
        key: item.id,
        label: item.query,
        atLabel: item.atLabel || '',
      }))
    : (criteria.find ?? []).map((label, index) => ({
        key: `find-${index}-${label}`,
        label,
        atLabel: '',
      }));
  // 대장에 없는 현재 등록 찾기도 날짜 없이 이어서 표시
  if (findLedger.length && criteria.find?.length) {
    const seen = new Set(findLedger.map((item) => item.query));
    criteria.find.forEach((label, index) => {
      if (seen.has(label)) return;
      seen.add(label);
      findRows.push({
        key: `find-current-${index}-${label}`,
        label,
        atLabel: '',
      });
    });
  }
  const findGroups = groupDatedChipsByAt(findRows);

  const commonLedgerRows = commonLedger.length
    ? commonLedger.map((item) => ({
        key: item.id,
        label: item.pattern,
        atLabel: item.atLabel || '',
      }))
    : (criteria.commonString ?? []).map((label, index) => ({
        key: `common-${index}-${label}`,
        label,
        atLabel: '',
      }));
  const commonGroups = groupDatedChipsByAt(commonLedgerRows);

  return (
    <section className="work-history-panel__block work-history-panel__block--consistency">
      <h4 className="work-history-panel__block-title">표기 통일(현재 기준)</h4>
      <dl className="work-history-panel__criteria-groups">
        {WORK_HISTORY_CONSISTENCY_GROUPS.map((group) => {
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
                  {unifyRows.length ? (
                    <ul className="work-history-panel__unify-list">
                      {unifyRows.map((entry) => (
                        <li key={entry.key} className="work-history-panel__unify-entry">
                          <UnifyArrowRow
                            variants={entry.variants}
                            pinned={entry.pinned}
                            atLabel={entry.atLabel}
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

          if (group.id === 'find') {
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
                  {findGroups.length ? (
                    <ul className="work-history-panel__unify-list">
                      {findGroups.map((entry) => (
                        <li
                          key={entry.atLabel || entry.items.map((i) => i.key).join('|')}
                          className="work-history-panel__unify-entry"
                        >
                          <DatedChipGroup
                            atLabel={entry.atLabel}
                            labels={entry.items.map((item) => item.label)}
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

          if (group.id === 'commonString') {
            return (
              <div key={group.id} className="work-history-panel__criteria-group">
                <dt className="work-history-panel__criteria-label">
                  {group.label}
                </dt>
                <dd className="work-history-panel__criteria-body">
                  {commonGroups.length ? (
                    <ul className="work-history-panel__unify-list">
                      {commonGroups.map((entry) => (
                        <li
                          key={
                            entry.atLabel ||
                            entry.items.map((i) => i.key).join('|')
                          }
                          className="work-history-panel__unify-entry"
                        >
                          <DatedChipGroup
                            atLabel={entry.atLabel}
                            labels={entry.items.map((item) => item.label)}
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

          const items = criteria.exclude ?? [];
          return (
            <div key={group.id} className="work-history-panel__criteria-group">
              <dt className="work-history-panel__criteria-label">
                {group.label}
              </dt>
              <dd className="work-history-panel__criteria-body">
                {items.length ? (
                  <ul className="work-history-panel__chips work-history-panel__chips--parallel">
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
  );
}

/**
 * @param {{
 *   history: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[] | undefined,
 *   projectContext?: import('../../lib/projectMeta.js').ProjectContext,
 *   customRules?: import('../../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[],
 * }} props
 */
export default function ProjectWorkHistoryChart({
  history,
  projectContext,
  customRules = [],
  globalExcludePhrases = [],
  consistencyDecisions = [],
}) {
  const chartSessions = buildDisplayWorkHistory(history, projectContext) ?? [];
  const listSessions = normalizeWorkHistory(history) ?? [];
  const sessionCount = chartSessions.length;
  const criteria = buildWorkHistoryConsistencyCriteria(
    customRules,
    globalExcludePhrases,
  );
  // 실제 확정 대장만 — 등록 항목·projectContext로 가짜 이력을 만들지 않음
  const ledger = buildWorkHistoryDecisionLedger(consistencyDecisions);
  const spellingSplit = hasSpellingSplitHistory(
    listSessions.length ? listSessions : chartSessions,
  );

  const editorReviewValues = sparklineSeries(
    chartSessions,
    (entry) => entry.editorReview,
  );
  const builtinSpellingValues = sparklineSeries(
    chartSessions,
    (entry) => entry.spelling,
  );
  const legacySpellingValues = sparklineSeries(
    chartSessions,
    (entry) => entry.spelling,
  );
  const bonBojoValues = sparklineSeries(chartSessions, (entry) => entry.bonBojo);
  const sessionAts = chartSessions.map((entry) => entry.at);
  const hasBonBojoHistory = chartSessions.some(
    (entry) => typeof entry.bonBojo === 'number',
  );
  const hasSpellingHistory = chartSessions.some(
    (entry) =>
      typeof entry.spelling === 'number' ||
      typeof entry.editorReview === 'number',
  );

  if (!sessionCount) {
    return (
      <div className="project-hub-settings__card work-history-panel">
        <h3 className="work-history-panel__title">검수 진행 이력</h3>
        <p className="project-hub-settings__row-desc work-history-panel__empty">
          검수를 진행하면 항목별 추이가 여기에 표시됩니다.
        </p>
        <ConsistencyCriteriaBlock
          criteria={criteria}
          ledger={ledger}
        />
      </div>
    );
  }

  return (
    <div className="project-hub-settings__card work-history-panel">
      <h3 className="work-history-panel__title">검수 진행 이력</h3>

      {hasSpellingHistory && spellingSplit ? (
        <section className="work-history-panel__block work-history-panel__block--spelling">
          <h4 className="work-history-panel__block-title">맞춤법</h4>
          <div className="work-history-panel__block-body">
            <SparklineRow
              label="편집자 검토 필요"
              subLabel
              values={editorReviewValues}
              sessionAts={sessionAts}
              sessions={chartSessions}
              sessionCount={sessionCount}
              colorClass="work-history-panel__spark-row--spelling"
              muted
            />
            <SparklineRow
              label="맞춤법 규칙"
              subLabel
              values={builtinSpellingValues}
              sessionAts={sessionAts}
              sessions={chartSessions}
              sessionCount={sessionCount}
              colorClass="work-history-panel__spark-row--spelling"
            />
            <SessionDateAxis sessions={chartSessions} />
          </div>
        </section>
      ) : null}
      {hasSpellingHistory && !spellingSplit ? (
        <section className="work-history-panel__block work-history-panel__block--spelling">
          <h4 className="work-history-panel__block-title">맞춤법</h4>
          <div className="work-history-panel__block-body">
            <SparklineRow
              label="맞춤법 규칙"
              values={legacySpellingValues}
              sessionAts={sessionAts}
              sessions={chartSessions}
              sessionCount={sessionCount}
              colorClass="work-history-panel__spark-row--spelling"
              hideLabel
            />
            <SessionDateAxis sessions={chartSessions} />
          </div>
        </section>
      ) : null}

      <ConsistencyCriteriaBlock
        criteria={criteria}
        ledger={ledger}
      />

      {hasBonBojoHistory ? (
        <section className="work-history-panel__block work-history-panel__block--auxiliary">
          <h4 className="work-history-panel__block-title">본용언+보조용언</h4>
          <div className="work-history-panel__block-body">
            <SparklineRow
              label="본용언+보조용언"
              values={bonBojoValues}
              sessionAts={sessionAts}
              sessions={chartSessions}
              sessionCount={sessionCount}
              colorClass="work-history-panel__spark-row--auxiliary"
              hideLabel
            />
            <SessionDateAxis sessions={chartSessions} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
