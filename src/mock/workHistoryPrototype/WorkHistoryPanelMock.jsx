import '../../components/project-hub-settings.css';
import './work-history-prototype.css';
import {
  buildSparklinePath,
  MOCK_CONSISTENCY_BY_GROUP,
  MOCK_CONSISTENCY_GROUPS,
  MOCK_SPARKLINE_ROWS,
  sparklinePoints,
} from './mockWorkHistoryData.js';

const SPARK_W = 168;
const SPARK_H = 32;
const CHIP_PREVIEW = 2;

/**
 * @param {'find' | 'unify' | 'commonString' | 'exclude'} groupId
 * @param {typeof MOCK_CONSISTENCY_BY_GROUP} byGroup
 */
function countConsistencyGroup(groupId, byGroup) {
  const items = byGroup[groupId] ?? [];
  return items.length;
}

/**
 * @param {import('./mockWorkHistoryData.js').MockUnifyEntry} entry
 */
function UnifyEntryMock({ entry }) {
  return (
    <li className="work-history-panel-mock__unify-entry">
      <ul className="work-history-panel-mock__chips work-history-panel-mock__chips--unify">
        {entry.variants.map((variant) => (
          <li key={variant} className="work-history-panel-mock__chip">
            {variant}
          </li>
        ))}
        <li className="work-history-panel-mock__unify-arrow" aria-hidden>
          →
        </li>
        <li className="work-history-panel-mock__chip work-history-panel-mock__chip--pinned">
          {entry.pinned}
          <span className="work-history-panel-mock__pin" aria-hidden>
            📌
          </span>
        </li>
      </ul>
    </li>
  );
}

/**
 * @param {{
 *   label: string,
 *   subLabel?: boolean,
 *   values: number[],
 *   sessionCount: number,
 *   colorClass: string,
 *   muted?: boolean,
 * }} props
 */
function SparklineRow({
  label,
  subLabel = false,
  values,
  sessionCount,
  colorClass,
  muted = false,
}) {
  const latest = values[values.length - 1];
  const path = buildSparklinePath(values, SPARK_W, SPARK_H);
  const points = sparklinePoints(values, SPARK_W, SPARK_H);

  return (
    <div
      className={`work-history-panel-mock__spark-row ${colorClass}${
        subLabel ? ' work-history-panel-mock__spark-row--sub' : ''
      }${muted ? ' work-history-panel-mock__spark-row--muted' : ''}`}
    >
      <span className="work-history-panel-mock__spark-label">{label}</span>
      <svg
        className="work-history-panel-mock__spark"
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        role="img"
        aria-label={`${label} 최근 ${sessionCount}회 추이`}
      >
        <line
          x1={0}
          x2={SPARK_W}
          y1={SPARK_H / 2}
          y2={SPARK_H / 2}
          className="work-history-panel-mock__spark-grid"
        />
        {sessionCount >= 2 ? (
          <path d={path} className="work-history-panel-mock__spark-line" />
        ) : null}
        {points.map((point, index) => (
          <circle
            key={`${label}-${index}`}
            cx={point.x}
            cy={point.y}
            r={3.5}
            className="work-history-panel-mock__spark-dot"
          >
            <title>{`${label} ${index + 1}회차 ${point.value}건`}</title>
          </circle>
        ))}
      </svg>
      <span className="work-history-panel-mock__latest">
        {latest}
        <span className="work-history-panel-mock__unit">건</span>
      </span>
    </div>
  );
}

/**
 * @param {{
 *   lastWorked?: string,
 *   pdfInfo?: string,
 *   sessions: import('./mockWorkHistoryData.js').MockSession[],
 *   consistencyByGroup?: typeof MOCK_CONSISTENCY_BY_GROUP,
 * }} props
 */
export function WorkHistoryPanelMock({
  lastWorked = '26.07.08 (오늘)',
  pdfInfo = '260107_스트리트 이코노미본문4교_260126_163458.pdf · 199쪽 · 9.0MB',
  sessions,
  consistencyByGroup = MOCK_CONSISTENCY_BY_GROUP,
}) {
  const sessionCount = sessions.length;
  const latestSession = sessions[sessionCount - 1];
  const latestFindings = latestSession?.consistencyByType ?? {
    find: 0,
    unify: 0,
    commonString: 0,
  };

  const spellingRows = MOCK_SPARKLINE_ROWS.filter(
    (row) => row.key === 'editorReview' || row.key === 'spelling',
  );
  const bonBojoRow = MOCK_SPARKLINE_ROWS.find((row) => row.key === 'bonBojo');

  return (
    <div className="project-hub-settings__group work-history-panel-mock">
      <div className="project-hub-settings__card project-hub-settings__card--work-summary">
        <div className="project-hub-settings__row project-hub-settings__row--readonly">
          <div className="project-hub-settings__row-text">
            <span className="project-hub-settings__row-label">마지막 작업</span>
          </div>
          <span className="project-hub-settings__value">{lastWorked}</span>
        </div>
        <div className="project-hub-settings__row project-hub-settings__row--readonly">
          <div className="project-hub-settings__row-text">
            <span className="project-hub-settings__row-label">PDF 정보</span>
          </div>
          <span className="project-hub-settings__value">{pdfInfo}</span>
        </div>
      </div>

      <div className="project-hub-settings__card work-history-panel-mock__history">
        <h3 className="work-history-panel-mock__title">검수 진행 이력</h3>

        <section className="work-history-panel-mock__block work-history-panel-mock__block--spelling">
          <h4 className="work-history-panel-mock__block-title">맞춤법</h4>
          <div className="work-history-panel-mock__block-body">
            {spellingRows.map((row) => (
              <SparklineRow
                key={row.key}
                label={row.label}
                subLabel={row.subLabel}
                values={sessions.map((s) => s[row.key])}
                sessionCount={sessionCount}
                colorClass="work-history-panel-mock__spark-row--spelling"
                muted={row.key === 'editorReview'}
              />
            ))}
          </div>
        </section>

        <section className="work-history-panel-mock__block work-history-panel-mock__block--consistency">
          <h4 className="work-history-panel-mock__block-title">표기 통일</h4>
          <dl className="work-history-panel-mock__criteria-groups">
            {MOCK_CONSISTENCY_GROUPS.map((group) => {
              const count = countConsistencyGroup(group.id, consistencyByGroup);

              if (group.id === 'unify') {
                const entries = consistencyByGroup.unify ?? [];
                const visible = entries.slice(0, CHIP_PREVIEW);
                const hidden = Math.max(0, entries.length - CHIP_PREVIEW);

                return (
                  <div key={group.id} className="work-history-panel-mock__criteria-group">
                    <dt className="work-history-panel-mock__criteria-label">
                      {group.label}
                      <span className="work-history-panel-mock__criteria-count">
                        {count}건
                      </span>
                    </dt>
                    <dd className="work-history-panel-mock__criteria-body">
                      {entries.length ? (
                        <ul className="work-history-panel-mock__unify-list">
                          {visible.map((entry) => (
                            <UnifyEntryMock
                              key={`${entry.pinned}-${entry.variants.join(',')}`}
                              entry={entry}
                            />
                          ))}
                          {hidden > 0 ? (
                            <li className="work-history-panel-mock__criteria-more">
                              +{hidden}
                            </li>
                          ) : null}
                        </ul>
                      ) : (
                        <p className="work-history-panel-mock__criteria-empty">등록 없음</p>
                      )}
                    </dd>
                  </div>
                );
              }

              const items = /** @type {string[]} */ (consistencyByGroup[group.id] ?? []);
              const visible = items.slice(0, CHIP_PREVIEW);
              const hidden = Math.max(0, items.length - CHIP_PREVIEW);

              return (
                <div key={group.id} className="work-history-panel-mock__criteria-group">
                  <dt className="work-history-panel-mock__criteria-label">
                    {group.label}
                    <span className="work-history-panel-mock__criteria-count">
                      {count}건
                    </span>
                  </dt>
                  <dd className="work-history-panel-mock__criteria-body">
                    {items.length ? (
                      <ul className="work-history-panel-mock__chips">
                        {visible.map((item) => (
                          <li key={item} className="work-history-panel-mock__chip">
                            {item}
                          </li>
                        ))}
                        {hidden > 0 ? (
                          <li className="work-history-panel-mock__chip work-history-panel-mock__chip--more">
                            +{hidden}
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="work-history-panel-mock__criteria-empty">등록 없음</p>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="work-history-panel-mock__findings-summary">
            <span className="work-history-panel-mock__findings-label">최근 1회</span>
            <p className="work-history-panel-mock__findings-parts">
              찾기{' '}
              <strong>{latestFindings.find}</strong>
              <span className="work-history-panel-mock__unit">건</span>
              <span className="work-history-panel-mock__findings-sep" aria-hidden>
                ·
              </span>
              통일형{' '}
              <strong>{latestFindings.unify}</strong>
              <span className="work-history-panel-mock__unit">건</span>
              <span className="work-history-panel-mock__findings-sep" aria-hidden>
                ·
              </span>
              공통 문자열{' '}
              <strong>{latestFindings.commonString}</strong>
              <span className="work-history-panel-mock__unit">건</span>
            </p>
          </div>
        </section>

        {bonBojoRow ? (
          <section className="work-history-panel-mock__block work-history-panel-mock__block--auxiliary">
            <h4 className="work-history-panel-mock__block-title">본·보조</h4>
            <div className="work-history-panel-mock__block-body">
              <SparklineRow
                label={bonBojoRow.label}
                values={sessions.map((s) => s.bonBojo)}
                sessionCount={sessionCount}
                colorClass="work-history-panel-mock__spark-row--auxiliary"
              />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
