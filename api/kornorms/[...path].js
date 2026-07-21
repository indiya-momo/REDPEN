/**
 * 국립국어원 어문 규범 API 프록시 (Vercel).
 * 브라우저 CORS 회피 + serviceKey 는 서버 env 만 사용.
 *
 * 필요 env (Production/Preview 중 하나):
 *   KORNORMS_SERVICE_KEY 또는 VITE_KORNORMS_SERVICE_KEY
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end('Method Not Allowed');
    return;
  }

  const key = String(
    process.env.KORNORMS_SERVICE_KEY ||
      process.env.VITE_KORNORMS_SERVICE_KEY ||
      '',
  ).trim();
  if (!key) {
    res
      .status(503)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .end('KORNORMS_KEY_MISSING');
    return;
  }

  const parts = req.query.path;
  const pathSeg = Array.isArray(parts)
    ? parts.join('/')
    : String(parts || 'exampleReqList.do');
  const url = new URL(`https://korean.go.kr/kornorms/${pathSeg}`);

  for (const [name, value] of Object.entries(req.query)) {
    if (name === 'path' || name === 'serviceKey') continue;
    const vals = Array.isArray(value) ? value : [value];
    for (const v of vals) {
      if (v == null) continue;
      url.searchParams.append(name, String(v));
    }
  }
  url.searchParams.set('serviceKey', key);

  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/xml, text/xml, */*' },
    });
    const body = await upstream.text();
    const contentType =
      upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
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
      .end('KORNORMS_UPSTREAM_ERROR');
  }
}
