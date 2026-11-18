/**
 * Vite DEV — POST /api/bareun/analyze (바른 폴백, 키는 서버 env만).
 */
import {
  BAREUN_ANALYZE_PATH,
} from '../src/lib/bareunMorph/contract.js';

/**
 * @param {import('http').IncomingMessage} req
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
}

export function bareunAnalyzeDevPlugin() {
  return {
    name: 'bareun-analyze-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url !== BAREUN_ANALYZE_PATH && url !== `${BAREUN_ANALYZE_PATH}/`) {
          next();
          return;
        }

        try {
          const {
            getBareunServerStatus,
            handleBareunAnalyzeBody,
          } = await import('../src/lib/bareunMorph/serverAnalyze.js');

          if (req.method === 'GET' || req.method === 'HEAD') {
            const status = getBareunServerStatus();
            sendJson(res, 200, {
              ok: true,
              ready: status.ready,
              configured: status.configured,
            });
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET, HEAD, POST');
            res.end('Method Not Allowed');
            return;
          }

          const body = await readJsonBody(req);
          const result = await handleBareunAnalyzeBody(body);
          const code =
            result.ok === false &&
            (result.error === 'BAREUN_UNAVAILABLE' ||
              result.error === 'BAREUN_API_KEY_MISSING')
              ? 503
              : result.ok === false
                ? 400
                : 200;
          sendJson(res, code, result);
        } catch (err) {
          console.warn('[bareunAnalyzeDevPlugin]', err);
          sendJson(res, 500, { ok: false, error: 'BAREUN_INTERNAL' });
        }
      });
    },
  };
}
