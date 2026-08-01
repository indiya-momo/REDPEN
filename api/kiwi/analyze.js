/**
 * Kiwi 형태소 analyze (시나리오 C — 서버 전용).
 *
 * POST /api/kiwi/analyze  { "text": "…" } | { "texts": ["…"] }
 * GET  /api/kiwi/analyze  → { ok, ready }
 *
 * 환경:
 * - 로컬/호스트에 tmp/kiwi-models + kiwi-nlp 있으면 직접 실행
 * - 없거나 Vercel 등에서 모델 미포함이면 KIWI_ANALYZE_UPSTREAM 으로 프록시
 * - 둘 다 없으면 503 KIWI_UNAVAILABLE (브라우저 wasm 미전송)
 */

import { getKiwiServerStatus, handleKiwiAnalyzeBody } from '../../src/lib/kiwiMorph/serverAnalyzeService.js';

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
async function readBody(req) {
  if (req.body != null && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/**
 * @param {string} upstream
 * @param {string} method
 * @param {unknown} [body]
 */
async function proxyUpstream(upstream, method, body) {
  const init = {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  };
  if (method === 'POST' && body != null) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(upstream.replace(/\/$/, ''), init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { ok: false, error: 'KIWI_UPSTREAM_INVALID' };
  }
  return { status: res.status, json };
}

export default async function handler(req, res) {
  const upstream = String(process.env.KIWI_ANALYZE_UPSTREAM || '').trim();

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (upstream) {
      try {
        const { status, json } = await proxyUpstream(upstream, 'GET');
        res.status(status).json(json);
      } catch {
        res.status(502).json({ ok: false, error: 'KIWI_UPSTREAM_ERROR' });
      }
      return;
    }
    const status = getKiwiServerStatus();
    res.status(200).json({ ok: true, ready: status.ready });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST');
    res.status(405).end('Method Not Allowed');
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.status(400).json({ ok: false, error: 'KIWI_BODY_INVALID' });
    return;
  }

  if (upstream) {
    try {
      const { status, json } = await proxyUpstream(upstream, 'POST', body);
      res.status(status).json(json);
    } catch {
      res.status(502).json({ ok: false, error: 'KIWI_UPSTREAM_ERROR' });
    }
    return;
  }

  try {
    const result = await handleKiwiAnalyzeBody(body);
    const code =
      result.ok === false && result.error === 'KIWI_UNAVAILABLE'
        ? 503
        : result.ok === false
          ? 400
          : 200;
    res.status(code).json(result);
  } catch (err) {
    console.error('[api/kiwi/analyze]', err);
    res.status(500).json({ ok: false, error: 'KIWI_INTERNAL' });
  }
}
