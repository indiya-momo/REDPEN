/**
 * Vite 개발 서버 — /api/stdict 에 표준국어대사전 키 주입.
 * @param {{ getKey: () => string }} opts
 */
export function stdictDevProxyPlugin(opts) {
  return {
    name: 'stdict-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/stdict', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const key = String(opts.getKey() ?? '').trim();
        if (!key) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('STDICT_KEY_MISSING');
          return;
        }
        try {
          const host = req.headers.host || '127.0.0.1';
          const incoming = new URL(req.url || '/', `http://${host}`);
          const q = String(incoming.searchParams.get('q') ?? '').trim();
          if (!q) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('STDICT_Q_MISSING');
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

          const upstream = await fetch(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json, text/plain, */*' },
          });
          const body = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            'Content-Type',
            upstream.headers.get('content-type') ||
              'application/json; charset=utf-8',
          );
          res.end(body);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
