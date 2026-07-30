#!/usr/bin/env node
/**
 * unify-josa-review-slm-sketch.md §13 체크리스트 자동 실행.
 * 사전: node scripts/josa-slm-mock-vllm.mjs (또는 실 vLLM :8000)
 *
 *   node scripts/josa-slm-manual-verify.mjs
 */
import { attachJosaReviewHints } from '../src/lib/unifyJosaReview.js';
import { filterJosaReviewBySlm } from '../src/lib/unifyJosaReviewSlm/filter.js';
import { parseSlmReviewFromText } from '../src/lib/unifyJosaReviewSlm/parse.js';
import { createServerRunner } from '../src/lib/unifyJosaReviewSlm/runner/serverRunner.js';
import { buildJosaSlmUserMessage, JOSA_SLM_SYSTEM_PROMPT } from '../src/lib/unifyJosaReviewSlm/prompt.js';

const SLM_BASE = process.env.JOSA_SLM_MOCK_BASE || 'http://127.0.0.1:8000/v1';
const IS_REAL_SLM = process.env.JOSA_SLM_REAL === '1' || process.env.JOSA_SLM_REAL === 'true';
const CHAT_TIMEOUT_MS = Number(process.env.JOSA_SLM_TIMEOUT_MS || (IS_REAL_SLM ? 180_000 : 10_000));
const VITE_BASE = process.env.VITE_DEV_BASE || 'http://127.0.0.1:5173';
const PROXY_URL = `${VITE_BASE}/api/josa-slm/v1/chat/completions`;
const DIRECT_URL = `${SLM_BASE}/chat/completions`;

/** @type {{ ok: boolean, label: string, detail?: string }[]} */
const results = [];

/**
 * @param {string} label
 * @param {() => Promise<void>} fn
 */
async function check(label, fn) {
  try {
    await fn();
    results.push({ ok: true, label });
    console.log(`  ✓ ${label}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ ok: false, label, detail });
    console.log(`  ✗ ${label}`);
    console.log(`    → ${detail}`);
  }
}

/**
 * @param {string} url
 * @param {string} userContent
 */
async function postChat(url, userContent) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'kakaocorp/kanana-2-1.3b-instruct',
      temperature: 0,
      max_tokens: 128,
      messages: [
        { role: 'system', content: JOSA_SLM_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content ?? '';
  const parsed = parseSlmReviewFromText(text, '역학은');
  if (!parsed) throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`);
  return parsed;
}

const SAMPLE_USER = buildJosaSlmUserMessage(
  {
    id: '역학은',
    variant: '역학 은',
    gluedVariant: '역학은',
    ruleStem: '역학',
    ruleSuffix: '은',
  },
  { contextBefore: '양자', contextAfter: '은 물리' },
);

const riskyCluster = attachJosaReviewHints([
  {
    key: '역학은',
    variants: ['역학은', '역학 은'],
    counts: { '역학은': 2, '역학 은': 1 },
    occurrencesByVariant: {
      '역학 은': [{ pageNum: 1, index: 10, matchedText: '역학 은' }],
    },
    recommendedUnify: '역학은',
    totalCount: 3,
    kind: 'conflict',
  },
])[0];

console.log(`\n§13 수동 검증 (${IS_REAL_SLM ? '실 SLM' : 'mock/추론 서버'})\n`);

await check('GET /v1/models', async () => {
  const res = await fetch(`${SLM_BASE.replace(/\/v1$/, '')}/v1/models`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
});

await check('경로 B — curl 대체 POST /v1/chat/completions', async () => {
  const parsed = await postChat(DIRECT_URL, SAMPLE_USER);
  if (parsed.kind !== 'josa_or_suffix' || parsed.confidence !== 'high') {
    throw new Error(JSON.stringify(parsed));
  }
  if (!IS_REAL_SLM && parsed.reason !== 'mock-with-context') {
    throw new Error(`맥락 미포함 mock 응답: ${parsed.reason}`);
  }
});

await check('Vite 프록시 /api/josa-slm/v1 → :8000', async () => {
  const parsed = await postChat(PROXY_URL, SAMPLE_USER);
  if (parsed.id !== '역학은') throw new Error(JSON.stringify(parsed));
});

await check('filterJosaReviewBySlm + serverRunner 승격', async () => {
  const runner = createServerRunner({ endpoint: SLM_BASE, timeoutMs: CHAT_TIMEOUT_MS });
  const [out] = await filterJosaReviewBySlm([riskyCluster], {
    runner,
    slmModel: IS_REAL_SLM ? 'kanana-2-1.3b-instruct' : 'mock-manual-verify',
    pageTexts: [
      { pageNum: 1, text: '현대 양자 역학 은 물리학의 기초이다.\n' },
    ],
  });
  if (out.josaReview?.status !== 'review') {
    throw new Error('josaReview 승격 실패');
  }
  if (out.josaReviewCandidate?.tier !== 'risky') {
    throw new Error(`tier=${out.josaReviewCandidate?.tier}`);
  }
});

await check('tier high — SLM 미호출·즉시 배지', async () => {
  const highCluster = attachJosaReviewHints([
    {
      key: '활동하도록',
      variants: ['활동하도록', '활동 하도록'],
      counts: { '활동하도록': 2, '활동 하도록': 1 },
      occurrencesByVariant: {},
      recommendedUnify: '활동하도록',
      totalCount: 3,
      kind: 'conflict',
    },
  ])[0];
  let called = false;
  const runner = {
    async reviewBatch() {
      called = true;
      return [];
    },
  };
  const [out] = await filterJosaReviewBySlm([highCluster], { runner });
  if (called) throw new Error('high tier가 SLM을 호출함');
  if (out.josaReview?.status !== 'review') throw new Error('high 배지 없음');
});

await check('추론 서버 다운 — fail-closed', async () => {
  const runner = createServerRunner({ endpoint: 'http://127.0.0.1:59999/v1' });
  const [out] = await filterJosaReviewBySlm([riskyCluster], { runner });
  if (out.josaReview) throw new Error('실패 시 배지가 남음');
});

const failed = results.filter((r) => !r.ok);
console.log(`\n결과: ${results.length - failed.length}/${results.length} 통과`);
if (failed.length) {
  process.exit(1);
}
console.log('\n브라우저 E2E: .env.local에 VITE_UNIFY_JOSA_SLM=true 후 npm run dev 재시작 → 표기 통일 찾기\n');
