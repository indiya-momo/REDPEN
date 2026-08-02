/**
 * Vite 개발 서버 — /api/kornorms 에 어문 규범 serviceKey 주입.
 * 브라우저에는 키를 넣지 않는다 (stdictDevProxyPlugin 과 동일 패턴).
 * @param {{ getKey: () => string }} opts
 */
export function kornormsDevProxyPlugin(opts) {
  return {
    name: 'kornorms-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/kornorms', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const key = String(opts.getKey() ?? '').trim();
        if (!key) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('KORNORMS_KEY_MISSING');
          return;
        }
        try {
          const host = req.headers.host || '127.0.0.1';
          // mount 스트립 여부에 대비해 /api/kornorms 접두를 제거
          const rawPath = String(req.url || '/').split('?')[0];
          const pathSeg =
            rawPath
              .replace(/^\/api\/kornorms\/?/, '/')
              .replace(/^\//, '')
              .replace(/\/+$/, '') || 'exampleReqList.do';
          const incoming = new URL(req.url || '/', `http://${host}`);
          const url = new URL(`https://korean.go.kr/kornorms/${pathSeg}`);
          for (const [name, value] of incoming.searchParams.entries()) {
            if (name === 'serviceKey') continue;
            url.searchParams.append(name, value);
          }
          url.searchParams.set('serviceKey', key);

          const upstream = await fetch(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/xml, text/xml, */*' },
          });
          const body = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') ||
              'application/xml; charset=utf-8',
          );
          res.end(body);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
