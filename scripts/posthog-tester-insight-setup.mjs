#!/usr/bin/env node
/**
 * 특정 테스터(distinct_id = Firebase uid) 활동 인사이트·대시보드 생성
 *
 * PowerShell:
 *   $env:POSTHOG_PERSONAL_API_KEY="phx_…"
 *   $env:POSTHOG_HOST="https://us.posthog.com"   # 또는 eu
 *   $env:POSTHOG_PROJECT_ID="12345"
 *   $env:POSTHOG_TESTER_UID="oEU5prc1hFTh4e9OfqGDW8vIBOi1"
 *   $env:POSTHOG_TESTER_LABEL="hyeonjinan"
 *   npm run posthog:setup-tester
 *
 * Personal API key scopes: insight:write, dashboard:write (+ project:read 없으면 PROJECT_ID 필수)
 */

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY?.trim() ?? '';
const HOST = (process.env.POSTHOG_HOST?.trim() || 'https://us.posthog.com').replace(
  /\/$/,
  '',
);
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID?.trim() ?? '';
const TESTER_UID =
  process.env.POSTHOG_TESTER_UID?.trim() ||
  'oEU5prc1hFTh4e9OfqGDW8vIBOi1';
const TESTER_LABEL =
  process.env.POSTHOG_TESTER_LABEL?.trim() || 'hyeonjinan';

const DASHBOARD_NAME = `테스터 — ${TESTER_LABEL}`;
const TAG = 'indiya-tester';
const DATE_30D = { date_from: '-30d', explicitDate: false };

function fail(msg) {
  console.error(`\n[posthog-tester] ${msg}`);
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

function distinctIdFilter() {
  return [
    {
      key: 'distinct_id',
      type: 'event',
      value: [TESTER_UID],
      operator: 'exact',
    },
  ];
}

function trendsInsight(name, description, series) {
  return {
    name,
    description,
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        interval: 'day',
        dateRange: DATE_30D,
        filterTestAccounts: false,
        properties: distinctIdFilter(),
        series,
        trendsFilter: {},
        version: 2,
      },
    },
  };
}

function buildInsightSpecs() {
  const prefix = `[테스터/${TESTER_LABEL}]`;
  return [
    trendsInsight(
      `${prefix} 주요 이벤트 (일별)`,
      `distinct_id=${TESTER_UID} — 로그인·PDF·검수·외래어·피드백 (30일)`,
      [
        {
          kind: 'EventsNode',
          event: 'user_identified',
          name: '로그인 식별',
          math: 'total',
        },
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: 'PDF 열기',
          math: 'total',
        },
        {
          kind: 'EventsNode',
          event: 'check_run',
          name: '검수',
          math: 'total',
        },
        {
          kind: 'EventsNode',
          event: 'loanword_convert',
          name: '외래어 변환',
          math: 'total',
        },
        {
          kind: 'EventsNode',
          event: 'feedback_opened',
          name: '피드백 열기',
          math: 'total',
        },
        {
          kind: 'EventsNode',
          event: 'ruleset_saved',
          name: '기준 저장',
          math: 'total',
        },
      ],
    ),
    {
      name: `${prefix} 검수 scope 분해`,
      description: `check_run breakdown by scope — ${TESTER_UID}`,
      query: {
        kind: 'InsightVizNode',
        source: {
          kind: 'TrendsQuery',
          interval: 'day',
          dateRange: DATE_30D,
          filterTestAccounts: false,
          properties: distinctIdFilter(),
          series: [
            {
              kind: 'EventsNode',
              event: 'check_run',
              name: 'check_run',
              math: 'total',
            },
          ],
          breakdownFilter: {
            breakdown: 'scope',
            breakdown_type: 'event',
          },
          trendsFilter: {},
          version: 2,
        },
      },
    },
    trendsInsight(
      `${prefix} PDF 업로드`,
      `pdf_opened — ${TESTER_UID}`,
      [
        {
          kind: 'EventsNode',
          event: 'pdf_opened',
          name: 'pdf_opened',
          math: 'total',
        },
      ],
    ),
  ];
}

async function resolveProjectId() {
  if (PROJECT_ID) {
    if (!/^\d+$/.test(PROJECT_ID)) {
      fail(`POSTHOG_PROJECT_ID는 숫자만 가능합니다: "${PROJECT_ID}"`);
    }
    console.log(`[posthog-tester] project_id=${PROJECT_ID} (env)`);
    return PROJECT_ID;
  }
  const projects = await api('/api/projects/');
  const list = projects?.results ?? projects ?? [];
  if (!Array.isArray(list) || list.length === 0) {
    fail('프로젝트 목록이 비었습니다. POSTHOG_PROJECT_ID를 넣으세요.');
  }
  const id = String(list[0].id);
  console.log(`[posthog-tester] project_id=${id} (${list[0].name ?? 'default'})`);
  return id;
}

async function findByName(listPath, name) {
  const data = await api(listPath);
  const rows = data?.results ?? [];
  return rows.find((row) => row.name === name) ?? null;
}

async function ensureDashboard(projectId) {
  const existing = await findByName(
    `/api/projects/${projectId}/dashboards/?limit=200`,
    DASHBOARD_NAME,
  );
  if (existing) {
    console.log(`[posthog-tester] dashboard exists: ${existing.id}`);
    return existing.id;
  }
  const created = await api(`/api/projects/${projectId}/dashboards/`, {
    method: 'POST',
    body: {
      name: DASHBOARD_NAME,
      description: `내부 테스터 활동 (uid=${TESTER_UID}). 오픈베타 대시보드와 별도.`,
      tags: [TAG],
      pinned: true,
    },
  });
  console.log(`[posthog-tester] dashboard created: ${created.id}`);
  return created.id;
}

async function ensureInsight(projectId, spec, dashboardId) {
  const existing = await findByName(
    `/api/projects/${projectId}/insights/?limit=200`,
    spec.name,
  );
  const payload = {
    name: spec.name,
    description: spec.description,
    query: spec.query,
    tags: [TAG],
  };
  if (dashboardId) payload.dashboards = [dashboardId];
  if (existing) {
    const updated = await api(
      `/api/projects/${projectId}/insights/${existing.id}/`,
      { method: 'PATCH', body: payload },
    );
    console.log(`[posthog-tester] insight updated: ${updated.id} ${spec.name}`);
    return { id: updated.id, shortId: updated.short_id };
  }
  const created = await api(`/api/projects/${projectId}/insights/`, {
    method: 'POST',
    body: payload,
  });
  console.log(`[posthog-tester] insight created: ${created.id} ${spec.name}`);
  return { id: created.id, shortId: created.short_id };
}

async function main() {
  if (!API_KEY.startsWith('phx_')) {
    fail(
      'POSTHOG_PERSONAL_API_KEY(phx_…)가 필요합니다.\n' +
        'PostHog → Settings → Personal API keys → insight:write, dashboard:write',
    );
  }
  console.log(`[posthog-tester] host=${HOST}`);
  console.log(`[posthog-tester] uid=${TESTER_UID} label=${TESTER_LABEL}`);
  const projectId = await resolveProjectId();
  const dashboardId = await ensureDashboard(projectId);
  const specs = buildInsightSpecs();
  const insights = [];
  for (const spec of specs) {
    const row = await ensureInsight(projectId, spec, dashboardId);
    insights.push({ ...row, name: spec.name });
  }
  console.log('\n완료');
  if (dashboardId) {
    console.log(`대시보드: ${HOST}/project/${projectId}/dashboard/${dashboardId}`);
  }
  for (const row of insights) {
    const url = row.shortId
      ? `${HOST}/project/${projectId}/insights/${row.shortId}`
      : `${HOST}/project/${projectId}/insights/${row.id}`;
    console.log(`  ${row.name}\n    ${url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
