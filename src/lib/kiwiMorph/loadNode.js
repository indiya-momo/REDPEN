/**
 * Node 전용 Kiwi 로드 — tmp/kiwi-models + node_modules wasm.
 * 브라우저 번들에 넣지 말 것 (동적 import는 테스트·스크립트에서만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KiwiBuilder } from 'kiwi-nlp';
import { KIWI_DEFAULT_USER_WORDS } from './userDict.js';
import { setKiwiInstance } from './runtime.js';

const MODEL_FILES = [
  'combiningRule.txt',
  'default.dict',
  'extract.mdl',
  'multi.dict',
  'sj.morph',
  'cong.mdl',
  'nounchr.mdl',
  'dialect.dict',
];

/**
 * @param {string} [rootDir] repo root
 * @returns {{ wasmPath: string, modelDir: string, ready: boolean }}
 */
export function resolveKiwiNodePaths(rootDir) {
  const root =
    rootDir ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const wasmPath = path.join(root, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');
  const modelDir = path.join(root, 'tmp/kiwi-models/models/cong/base');
  const ready =
    fs.existsSync(wasmPath) &&
    fs.existsSync(path.join(modelDir, 'cong.mdl'));
  return { wasmPath, modelDir, ready };
}

/**
 * @param {{
 *   rootDir?: string,
 *   userWords?: { word: string, tag?: string, score?: number }[],
 *   register?: boolean,
 * }} [opts]
 * @returns {Promise<import('kiwi-nlp').Kiwi | null>}
 */
export async function loadKiwiNode(opts = {}) {
  const { wasmPath, modelDir, ready } = resolveKiwiNodePaths(opts.rootDir);
  if (!ready) return null;

  /** @type {Record<string, Uint8Array>} */
  const modelFiles = {};
  for (const name of MODEL_FILES) {
    const p = path.join(modelDir, name);
    if (!fs.existsSync(p)) {
      throw new Error(`Kiwi 모델 파일 없음: ${p}`);
    }
    modelFiles[name] = new Uint8Array(fs.readFileSync(p));
  }

  const builder = await KiwiBuilder.create(wasmPath);
  const userWords = opts.userWords ?? [...KIWI_DEFAULT_USER_WORDS];
  const kiwi = await builder.build({
    modelFiles,
    modelType: 'cong',
    loadDefaultDict: true,
    loadMultiDict: true,
    loadTypoDict: false,
    userWords,
  });

  if (opts.register !== false) {
    setKiwiInstance(kiwi);
  }
  return kiwi;
}
