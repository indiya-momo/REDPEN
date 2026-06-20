#!/usr/bin/env node
/**
 * PostHog 베타 대시보드 일괄 생성 (코호트 + 인사이트 + 대시보드)
 *
 * 사용 (PowerShell):
 *   $env:POSTHOG_PERSONAL_API_KEY="phx_…"
 *   $env:POSTHOG_HOST="https://us.posthog.com"
 *   $env:POSTHOG_PROJECT_ID="12345"   # us.posthog.com/project/12345/… URL 숫자
 *   npm run posthog:setup-beta
 *
 * Personal API key scopes: cohort:write, insight:write (+ project:read 없으면 PROJECT_ID 필수)
 */

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY?.trim() ?? '';
const HOST = (process.env.POSTHOG_HOST?.trim() || 'https://us.posthog.com').replace(
  /\/$/,
  '',
);
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID?.trim() ?? '';

const COHORT_NAME = '베타 실사용자 (내부 제외)';
const RETURN_UPLOADER_COHORT_NAME = '재업로드 2회+ (로그인)';
const DASHBOARD_NAME = '인디야 오픈베타';
const TAG = 'indiya-beta';

/** 코호트 API용 (레거시 filters 형식) */
const EXCLUDE_INTERNAL_COHORT_FILTERS = {
  type: 'AND',
  values: [
    {
      type: 'AND',
      values: [
        {
          key: 'is_internal',
          operator: 'is_not',
          value: true,
          type: 'person',
        },
      ],
    },
  ],
};

/** 인사이트 query API용 — 배열 + 코호트 참조 */
function cohortInsightProperties(cohortId) {
  return [
    {
      key: 'id',
      type: 'cohort',
      value: cohortId,
    },
  ];
}

const DATE_7D = { date_from: '-7d', explicitDate: false };
const DATE_24H = { date_from: '-24h', explicitDate: false };

function fail(msg) {
  console.error(`\n[posthog-setup] ${msg}`);
  process.exit(1);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
    );
  }
  return data;
}

const PROJECT_ID_HINT =
  'PostHog 주소창 https://us.posthog.com/project/숫자/ … 에서 숫자를 ' +
  'POSTHOG_PROJECT_ID 로 넣으세요. (project:read 권한 없어도 됨)';

async function resolveProjectId() {
  if (PROJECT_ID) {
    console.log(`[posthog-setup] project_id=${PROJECT_ID} (env)`);
    return PROJECT_ID;
  }
  try {
    const projects = await api('/api/projects/');
    const list = projects?.results ?? projects ?? [];
    if (!Array.isArray(list) || list.length === 0) {
      fail(`프로젝트 목록이 비었습니다. ${PROJECT_ID_HINT}`);
    }
    const id = String(list[0].id);
    console.log(`[posthog-setup] project_id=${id} (${list[0].name ?? 'default'})`);
    return id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('project:read') || msg.includes('403')) {
      fail(
        `API 키에 project:read 권한이 없습니다.\n${PROJECT_ID_HINT}`,
      );
    }
    throw err;
  }
}

function isScopeDenied(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('403') || msg.includes('permission_denied');
}

async function findByName(listPath, name) {
  try {
    const data = await api(listPath);
    const rows = data?.results ?? [];
    return rows.find((row) => row.name === name) ?? null;
  } catch (err) {
    if (isScopeDenied(err)) return null;
    throw err;
  }
}

async function ensureCohort(projectId) {
  const existing = await findByName(
    `/api/projects/${projectId}/cohorts/?limit=200`,
    COHORT_NAME,
  );
  if (existing) {
    console.log(`[posthog-setup] cohort exists: ${existing.id} ${COHORT_NAME}`);
    return existing.id;
  }
  const created = await api(`/api/projects/${projectId}/cohorts/`, {
    method: 'POST',
    body: {
      name: COHORT_NAME,
      description:
        'is_internal이 true가 아닌 사용자 (VITE_BETA_QUOTA_ADMIN_* 내부 계정 제외)',
      is_static: false,
      filters: {
        properties: EXCLUDE_INTERNAL_COHORT_FILTERS,
      },
    },
  });
  console.log(`[posthog-setup] cohort created: ${created.id}`);
  return created.id;
}

async function ensureReturnUploaderCohort(projectId) {
  const existing = await findByName(
    `/api/projects/${projectId}/cohorts/?limit=200`,
    RETURN_UPLOADER_COHORT_NAME,
  );
  if (existing) {
    console.log(
      `[posthog-setup] cohort exists: ${existing.id} ${RETURN_UPLOADER_COHORT_NAME}`,
    );
    return existing.id;
  }
  const created = await api(`/api/projects/${projectId}/cohorts/`, {
    method: 'POST',
    body: {
      name: RETURN_UPLOADER_COHORT_NAME,
      description:
        '로그인 사용자 중 pdf_upload_count person 속성이 2 이상 (재업로드 경험)',
      is_static: false,
      filters: {
        properties: {
          type: 'AND',
          values: [
            {
              type: 'AND',
              values: [
                {
                  key: 'pdf_upload_count',
                  operator: 'gte',
                  value: 2,
                  type: 'person',
                },
                {
                  key: 'is_internal',
                  operator: 'is_not',
                  value: true,
                  type: 'person',
                },
              ],
            },
          ],
        },
      },
    },
  });
  console.log(`[posthog-setup] cohort created: ${created.id}`);
  return created.id;
}

function eventPropertyFilter(key, value) {
  return {
    key,
    operator: 'exact',
    value: [String(value)],
    type: 'event',
  };
}

function insightQuery(source, cohortId) {
  return {
    kind: 'InsightVizNode',
    source: {
      filterTestAccounts: false,
      properties: cohortInsightProperties(cohortId),
      ...source,
    },
  };
}

function buildInsightSpecs(cohortId, returnUploaderCohortId) {
  return [
  {
    name: '[베타] 방문 — session_start',
    description: '주간 유입 (내부 제외). 6/9 이전 데이터는 identify 미연결로 참고만.',
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_7D,
      series: [
        {
          kind: 'EventsNode',
          event: 'session_start',
          name: 'session_start',
          math: 'dau',
        },
      ],
      trendsFilter: {},
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] 로그인 전환',
    description: 'session_start → $identify (7일 창, 내부 제외)',
    query: insightQuery({
      kind: 'FunnelsQuery',
      dateRange: DATE_7D,
      series: [
        { kind: 'EventsNode', event: 'session_start', name: '방문' },
        { kind: 'EventsNode', event: '$identify', name: '로그인' },
      ],
      funnelsFilter: {
        funnelWindowInterval: 7,
        funnelWindowIntervalUnit: 'day',
      },
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] 로그인 후 검수',
    description: '$identify → pdf_opened → check_run (6/9 fix 이후 신뢰, 내부 제외)',
    query: insightQuery({
      kind: 'FunnelsQuery',
      dateRange: DATE_7D,
      series: [
        { kind: 'EventsNode', event: '$identify', name: '로그인' },
        { kind: 'EventsNode', event: 'pdf_opened', name: 'PDF' },
        { kind: 'EventsNode', event: 'check_run', name: '검수' },
      ],
      funnelsFilter: {
        funnelWindowInterval: 7,
        funnelWindowIntervalUnit: 'day',
      },
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] 검수 identify 연결',
    description: 'check_run + $is_identified breakdown (Last 24h, 내부 제외)',
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_24H,
      series: [
        {
          kind: 'EventsNode',
          event: 'check_run',
          name: 'check_run',
          math: 'total',
        },
      ],
      breakdownFilter: {
        breakdown: '$is_identified',
        breakdown_type: 'event',
      },
      trendsFilter: {},
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] PDF 업로드 건수',
    description: 'pdf_opened 총 건수 (주간, 내부 제외)',
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_7D,
      series: [
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: 'pdf_opened',
          math: 'total',
        },
      ],
      trendsFilter: {},
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] PDF 재업로드 사용자',
    description:
      'is_return_upload=true 인 pdf_opened 유니크 사용자 (2번째 이상 업로드, 내부 제외)',
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_7D,
      series: [
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: '재업로드',
          math: 'dau',
          properties: [eventPropertyFilter('is_return_upload', true)],
        },
      ],
      trendsFilter: {},
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] PDF 업로드 순번 분포',
    description: 'upload_index_bucket breakdown — 1·2·3·4+ (내부 제외)',
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_7D,
      series: [
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: 'pdf_opened',
          math: 'total',
        },
      ],
      breakdownFilter: {
        breakdown: 'upload_index_bucket',
        breakdown_type: 'event',
      },
      trendsFilter: {},
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] 재방문 후 업로드',
    description:
      'session_start → pdf_opened (7일 창). 재방문 세션에서 다시 업로드한 비율, 내부 제외',
    query: insightQuery({
      kind: 'FunnelsQuery',
      dateRange: DATE_7D,
      series: [
        { kind: 'EventsNode', event: 'session_start', name: '방문(세션)' },
        { kind: 'EventsNode', event: 'pdf_opened', name: 'PDF 업로드' },
      ],
      funnelsFilter: {
        funnelWindowInterval: 7,
        funnelWindowIntervalUnit: 'day',
      },
      version: 2,
    }, cohortId),
  },
  {
    name: '[베타] 재업로드 2회+ 코호트 — 업로드',
    description: `재업로드 2회+ 코호트의 pdf_opened (주간, 내부·첫방문 제외)`,
    query: insightQuery({
      kind: 'TrendsQuery',
      interval: 'day',
      dateRange: DATE_7D,
      series: [
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: 'pdf_opened',
          math: 'total',
        },
      ],
      trendsFilter: {},
      version: 2,
    }, returnUploaderCohortId),
  },
];
}

async function ensureInsight(projectId, spec, dashboardId) {
  const existing = await findByName(
    `/api/projects/${projectId}/insights/?limit=200`,
    spec.name,
  );
  /** @type {Record<string, unknown>} */
  const payload = {
    name: spec.name,
    description: spec.description,
    query: spec.query,
    tags: [TAG],
  };
  if (dashboardId) payload.dashboards = [dashboardId];
  if (existing) {
    const updated = await api(`/api/projects/${projectId}/insights/${existing.id}/`, {
      method: 'PATCH',
      body: payload,
    });
    console.log(`[posthog-setup] insight updated: ${updated.id} ${spec.name}`);
    return { id: updated.id, shortId: updated.short_id };
  }
  const created = await api(`/api/projects/${projectId}/insights/`, {
    method: 'POST',
    body: payload,
  });
  console.log(`[posthog-setup] insight created: ${created.id} ${spec.name}`);
  return { id: created.id, shortId: created.short_id };
}

async function ensureDashboard(projectId) {
  try {
    const existing = await findByName(
      `/api/projects/${projectId}/dashboards/?limit=200`,
      DASHBOARD_NAME,
    );
    if (existing) {
      console.log(`[posthog-setup] dashboard exists: ${existing.id}`);
      return existing.id;
    }
    const created = await api(`/api/projects/${projectId}/dashboards/`, {
      method: 'POST',
      body: {
        name: DASHBOARD_NAME,
        description:
          '인디야 오픈베타 — 내부(is_internal) 제외. 6/9 이후 로그인·검수 지표 중심.',
        tags: [TAG],
        pinned: true,
      },
    });
    console.log(`[posthog-setup] dashboard created: ${created.id}`);
    return created.id;
  } catch (err) {
    if (isScopeDenied(err)) {
      console.warn(
        '[posthog-setup] 대시보드 스킵 (dashboard:read/write 없음). 인사이트만 생성합니다.',
      );
      return null;
    }
    throw err;
  }
}

async function main() {
  if (!API_KEY.startsWith('phx_')) {
    fail(
      'POSTHOG_PERSONAL_API_KEY(phx_…)가 필요합니다.\n' +
        'PostHog → Settings → Personal API keys → insight:write, cohort:write',
    );
  }

  console.log(`[posthog-setup] host=${HOST}`);
  const projectId = await resolveProjectId();
  const cohortId = await ensureCohort(projectId);
  const returnUploaderCohortId = await ensureReturnUploaderCohort(projectId);
  const dashboardId = await ensureDashboard(projectId);
  const insightSpecs = buildInsightSpecs(cohortId, returnUploaderCohortId);
  /** @type {{ id: number, shortId?: string, name: string }[]} */
  const insights = [];
  for (const spec of insightSpecs) {
    const row = await ensureInsight(projectId, spec, dashboardId);
    insights.push({ ...row, name: spec.name });
  }

  console.log('\n[posthog-setup] 완료');
  if (dashboardId) {
    console.log(`  대시보드: ${HOST}/project/${projectId}/dashboard/${dashboardId}`);
  } else {
    console.log(`  인사이트 목록: ${HOST}/project/${projectId}/insights`);
    console.log('  (대시보드는 UI에서 New dashboard → 위 인사이트 추가)');
  }
  for (const row of insights) {
    const path = row.shortId
      ? `${HOST}/project/${projectId}/insights/${row.shortId}`
      : `${HOST}/project/${projectId}/insights/${row.id}`;
    console.log(`  · ${row.name}\n    ${path}`);
  }
}

main().catch((err) => fail(err.message));
