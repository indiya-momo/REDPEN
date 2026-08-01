/**
 * Vite DEV — POST /api/kiwi/analyze (시나리오 C).
 * Node에서 Kiwi wasm+tmp 모델 실행, 브라우저에는 토큰 JSON만.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIWI_ANALYZE_PATH } from '../src/lib/kiwiMorph/serverContract.js';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<unknown>}
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

export function kiwiAnalyzeDevPlugin() {
  return {
    name: 'kiwi-analyze-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url !== KIWI_ANALYZE_PATH && url !== `${KIWI_ANALYZE_PATH}/`) {
          next();
          return;
        }

        try {
          const { getKiwiServerStatus, handleKiwiAnalyzeBody, ensureKiwiServerInstance } =
            await import('../src/lib/kiwiMorph/serverAnalyzeService.js');

          if (req.method === 'GET' || req.method === 'HEAD') {
            const status = getKiwiServerStatus(rootDir);
            if (status.ready) {
              // 첫 요청에서 워밍업 (실패해도 ready 플래그는 경로 기준)
              void ensureKiwiServerInstance({ rootDir });
            }
            sendJson(res, 200, { ok: true, ready: status.ready });
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET, HEAD, POST');
            res.end('Method Not Allowed');
            return;
          }

          let body;
          try {
            body = await readJsonBody(req);
          } catch {
            sendJson(res, 400, { ok: false, error: 'KIWI_BODY_INVALID' });
            return;
          }

          const result = await handleKiwiAnalyzeBody(body, { rootDir });
          const status =
            result.ok === false && result.error === 'KIWI_UNAVAILABLE'
              ? 503
              : result.ok === false
                ? 400
                : 200;
          sendJson(res, status, result);
        } catch (err) {
          console.warn('[kiwi-analyze-dev]', err);
          sendJson(res, 500, { ok: false, error: 'KIWI_INTERNAL' });
        }
      });
    },
  };
}
