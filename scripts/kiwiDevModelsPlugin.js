/**
 * Vite DEV 전용 — tmp/kiwi-models · kiwi-wasm 을 로컬 URL로 서빙.
 * 프로덕션 빌드/배포에는 모델을 넣지 않음 (법무 회신 전).
 *
 * - GET /@kiwi/wasm → node_modules/kiwi-nlp/dist/kiwi-wasm.wasm
 * - GET /@kiwi/models/<file> → tmp/kiwi-models/models/cong/base/<file>
 */
import fs from 'node:fs';
import path from 'node:path';

const MODEL_FILES = new Set([
  'combiningRule.txt',
  'default.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'cong.mdl',
  'nounchr.mdl',
  'dialect.dict',
]);

function contentType(filePath) {
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.txt') || filePath.endsWith('.dict')) {
    return 'text/plain; charset=utf-8';
  }
  return 'application/octet-stream';
}

/**
 * @param {{ root?: string }} [opts]
 */
export function kiwiDevModelsPlugin(opts = {}) {
  const root = opts.root || process.cwd();
  const wasmPath = path.join(root, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');
  const modelDir = path.join(root, 'tmp/kiwi-models/models/cong/base');

  return {
    name: 'kiwi-dev-models',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] || '';
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }

        if (url === '/@kiwi/wasm' || url === '/@kiwi/wasm/') {
          if (!fs.existsSync(wasmPath)) {
            res.statusCode = 404;
            res.end('KIWI_WASM_MISSING');
            return;
          }
          res.setHeader('Content-Type', contentType(wasmPath));
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(wasmPath).pipe(res);
          return;
        }

        const m = url.match(/^\/@kiwi\/models\/([^/]+)$/);
        if (m) {
          const name = decodeURIComponent(m[1]);
          if (!MODEL_FILES.has(name) || name.includes('..')) {
            res.statusCode = 404;
            res.end('KIWI_MODEL_FORBIDDEN');
            return;
          }
          const filePath = path.join(modelDir, name);
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end('KIWI_MODEL_MISSING');
            return;
          }
          res.setHeader('Content-Type', contentType(filePath));
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        next();
      });
    },
  };
}
