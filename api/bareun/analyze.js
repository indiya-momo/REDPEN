/**
 * 바른 형태소 — Kiwi 폴백용 서버 프록시.
 * POST /api/bareun/analyze  { text } | { texts }
 * GET  /api/bareun/analyze  → { ok, ready }
 *
 * 키는 서버 env만: BAREUN_API_KEY
 * 업스트림: BAREUN_API_URL (기본 https://api.bareun.ai, 로컬 http://127.0.0.1:5656)
 */

import {
  getBareunServerStatus,
  handleBareunAnalyzeBody,
} from '../../src/lib/bareunMorph/serverAnalyze.js';

/**
 * @param {import('http').IncomingMessage} req
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

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const status = getBareunServerStatus();
    res.status(200).json({
      ok: true,
      ready: status.ready,
      configured: status.configured,
    });
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
    res.status(400).json({ ok: false, error: 'BAREUN_BODY_INVALID' });
    return;
  }

  try {
    const result = await handleBareunAnalyzeBody(body);
    const code =
      result.ok === false &&
      (result.error === 'BAREUN_UNAVAILABLE' ||
        result.error === 'BAREUN_API_KEY_MISSING')
        ? 503
        : result.ok === false
          ? 400
          : 200;
    res.status(code).json(result);
  } catch (err) {
    console.error('[api/bareun/analyze]', err);
    res.status(500).json({ ok: false, error: 'BAREUN_INTERNAL' });
  }
}
