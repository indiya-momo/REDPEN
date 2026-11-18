/**
 * 서버/DEV 플러그인 공용 — 바른 AnalyzeSyntaxList → Kiwi 형태 결과.
 */
import {
  BAREUN_DEFAULT_UPSTREAM,
  parseBareunAnalyzeBody,
} from './contract.js';
import { bareunListResponseToKiwiItems } from './mapToKiwiShape.js';

/**
 * @returns {{ apiKey: string, upstream: string }}
 */
export function resolveBareunEnv() {
  // 클라이언트 번들에 넣지 말 것 — 서버·Vite 플러그인 process.env만
  const apiKey = String(process.env.BAREUN_API_KEY || '').trim();
  const upstream = String(
    process.env.BAREUN_API_URL ||
      process.env.BAREUN_ANALYZE_UPSTREAM ||
      BAREUN_DEFAULT_UPSTREAM,
  )
    .trim()
    .replace(/\/$/, '');
  return { apiKey, upstream };
}

export function getBareunServerStatus() {
  const { apiKey, upstream } = resolveBareunEnv();
  const local =
    /localhost|127\.0\.0\.1/i.test(upstream) || upstream.includes(':5656');
  return {
    ready: Boolean(apiKey) || local,
    configured: Boolean(apiKey) || Boolean(upstream),
    upstream,
  };
}

/**
 * @param {string[]} texts
 * @param {{ apiKey?: string, upstream?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function callBareunAnalyzeSyntaxList(texts, opts = {}) {
  const env = resolveBareunEnv();
  const apiKey = String(opts.apiKey ?? env.apiKey).trim();
  const upstream = String(opts.upstream ?? env.upstream)
    .trim()
    .replace(/\/$/, '');
  if (!upstream) {
    return { ok: false, error: 'BAREUN_UNAVAILABLE' };
  }
  const local = /localhost|127\.0\.0\.1/i.test(upstream);
  if (!apiKey && !local) {
    return { ok: false, error: 'BAREUN_API_KEY_MISSING' };
  }

  const url = `${upstream}/bareun.LanguageService/AnalyzeSyntaxList`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  /** @type {Record<string, string>} */
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['api-key'] = apiKey;

  const res = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      document: {
        sentences: texts,
        language: 'ko_KR',
      },
      encoding_type: 'UTF8',
      auto_spacing: false,
      auto_jointing: false,
    }),
  });
  const rawText = await res.text();
  let json;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'BAREUN_UPSTREAM_INVALID' };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: 'BAREUN_UPSTREAM_HTTP',
      status: res.status,
      body: json,
    };
  }
  const results = bareunListResponseToKiwiItems(texts, json);
  return { ok: true, results };
}

/**
 * @param {unknown} body
 */
export async function handleBareunAnalyzeBody(body) {
  const parsed = parseBareunAnalyzeBody(body);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  try {
    return await callBareunAnalyzeSyntaxList(parsed.texts);
  } catch (err) {
    console.warn('[bareunMorph]', err);
    return { ok: false, error: 'BAREUN_INTERNAL' };
  }
}
