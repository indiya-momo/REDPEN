/**
 * 작업 이력 — 검수 진행 이력 꺾은선 그래프.
 * 선 색은 설정 메뉴 기둥 색(--pillar-*)을 그대로 쓴다.
 */
import { buildWorkHistoryChartModel } from '../../presentation/workHistoryChart.js';

const SERIES_META = {
  spelling: { label: '맞춤법', color: 'var(--pillar-spelling)' },
  consistency: { label: '표기 통일', color: 'var(--pillar-consistency)' },
};

/**
 * @param {{
 *   history: import('../../lib/projectWorkHistory.js').WorkHistoryEntry[] | undefined,
 * }} props
 */
export default function ProjectWorkHistoryChart({ history }) {
  const model = buildWorkHistoryChartModel(history);

  if (!model) {
    return (
      <div className="project-hub-settings__card work-history-chart">
        <p className="project-hub-settings__row-desc work-history-chart__empty">
          검수를 진행하면 날짜별 지적 건수가 꺾은선 그래프로 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="project-hub-settings__card work-history-chart">
      <svg
        viewBox={`0 0 ${model.width} ${model.height}`}
        role="img"
        aria-label="날짜별 검수 지적 건수 꺾은선 그래프"
      >
        {model.yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={model.plot.left}
              x2={model.plot.right}
              y1={tick.y}
              y2={tick.y}
              className="work-history-chart__grid"
            />
            <text
              x={model.plot.left - 8}
              y={tick.y}
              className="work-history-chart__tick"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}
        {model.xLabels.map((label) => (
          <text
            key={`${label.x}-${label.label}`}
            x={label.x}
            y={model.plot.bottom + 18}
            className="work-history-chart__tick"
            textAnchor="middle"
          >
            {label.label}
          </text>
        ))}
        {model.series.map((series) => (
          <g key={series.key} style={{ color: SERIES_META[series.key].color }}>
            {series.points.length > 1 ? (
              <path d={series.path} className="work-history-chart__line" />
            ) : null}
            {series.points.map((point) => (
              <circle
                key={`${series.key}-${point.date}`}
                cx={point.x}
                cy={point.y}
                r={3.5}
                className="work-history-chart__point"
              >
                <title>
                  {`${point.date} ${SERIES_META[series.key].label} ${point.value}건`}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <div className="work-history-chart__legend">
        {model.series.map((series) => (
          <span key={series.key} className="work-history-chart__legend-item">
            <span
              className="work-history-chart__legend-dot"
              style={{ background: SERIES_META[series.key].color }}
              aria-hidden
            />
            {SERIES_META[series.key].label}
          </span>
        ))}
      </div>
    </div>
  );
}
