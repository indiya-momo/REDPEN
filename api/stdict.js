/**
 * 표준국어대사전 검색 프록시 (Vercel).
 * 브라우저 CORS 회피 + key 는 서버 env 만 사용.
 *
 * env: STDICT_API_KEY (또는 VITE_STDICT_API_KEY — 로컬 호환, 빌드에 넣지 말 것)
 *
 * GET /api/stdict?q=공개
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const key = String(
    process.env.STDICT_API_KEY || process.env.VITE_STDICT_API_KEY || '',
  ).trim();
  if (!key) {
    res
      .status(503)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .end('STDICT_KEY_MISSING');
    return;
  }

  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res
      .status(400)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .end('STDICT_Q_MISSING');
    return;
  }

  const url = new URL('https://stdict.korean.go.kr/api/search.do');
  url.searchParams.set('key', key);
  url.searchParams.set('q', q);
  url.searchParams.set('req_type', 'json');
  url.searchParams.set('advanced', 'y');
  url.searchParams.set('method', 'exact');
  url.searchParams.set('type1', 'word');
  url.searchParams.set('num', '10');
  url.searchParams.set('start', '1');

  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    const body = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res
      .status(upstream.status)
      .setHeader('Content-Type', contentType)
      .setHeader(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=600',
      )
      .end(body);
  } catch {
    res
      .status(502)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .end('STDICT_UPSTREAM_ERROR');
  }
}
