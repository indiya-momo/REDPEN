/**
 * Kiwi P0 스파이크 — UI 미연결.
 * 사용: node scripts/kiwi-p0-spike.mjs
 * 모델: tmp/kiwi-models/models/cong/base/ (kiwi_model_v0.23.1_base.tgz)
 * typo.dict 미로드.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { KiwiBuilder, Match } from 'kiwi-nlp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const wasmPath = path.join(root, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');
const modelDir = path.join(root, 'tmp/kiwi-models/models/cong/base');

/** @type {string[]} 계획: typo.dict 제외 */
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

const SAMPLES = [
  '나는 초콜렛을 먹었다.',
  '항아리 바위로 유명한 명지 계곡',
  '우리 나라에는 명지 계곡 외에도 영월이 있다.',
  '경제학과 경제 성장',
];

function loadModelFiles(dir, names) {
  /** @type {Record<string, Uint8Array>} */
  const out = {};
  /** @type {{ name: string, bytes: number }[]} */
  const sizes = [];
  for (const name of names) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) {
      throw new Error(`모델 파일 없음: ${p}`);
    }
    const buf = fs.readFileSync(p);
    out[name] = new Uint8Array(buf);
    sizes.push({ name, bytes: buf.length });
  }
  return { files: out, sizes };
}

function checkSurface1to1(input, tokens) {
  /** @type {{ ok: boolean, i: number, expected?: string, got?: string, position?: number, length?: number }[]} */
  const fails = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const expected = input.slice(t.position, t.position + t.length);
    if (expected !== t.str) {
      fails.push({
        ok: false,
        i,
        expected,
        got: t.str,
        position: t.position,
        length: t.length,
      });
    }
  }
  return fails;
}

function summarizeTokens(tokens) {
  return tokens.map((t) => `${t.str}/${t.tag}`).join(' ');
}

async function main() {
  if (!fs.existsSync(modelDir)) {
    console.error('모델 디렉터리 없음:', modelDir);
    console.error(
      'https://github.com/bab2min/Kiwi/releases/download/v0.23.1/kiwi_model_v0.23.1_base.tgz 를 tmp/kiwi-models 에 풀어 두세요.',
    );
    process.exit(1);
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, 'node_modules/kiwi-nlp/package.json'), 'utf8'),
  );
  const { files, sizes } = loadModelFiles(modelDir, MODEL_FILES);
  const wasmBytes = fs.statSync(wasmPath).size;

  console.log('=== Kiwi P0 spike ===');
  console.log('kiwi-nlp npm:', pkg.version, pkg.license);
  console.log('wasm bytes:', wasmBytes);
  console.log(
    'model files (no typo.dict):',
    sizes.map((s) => `${s.name}=${(s.bytes / 1024 / 1024).toFixed(2)}MB`).join(', '),
  );
  console.log(
    'model total MB:',
    (sizes.reduce((a, s) => a + s.bytes, 0) / 1024 / 1024).toFixed(2),
  );

  const t0 = performance.now();
  // Node: absolute path; some emscripten builds prefer file URL
  const builder = await KiwiBuilder.create(wasmPath);
  const wasmVersion = builder.version();
  console.log('wasm module version():', wasmVersion);
  console.log('builder create ms:', (performance.now() - t0).toFixed(0));

  const t1 = performance.now();
  const kiwi = await builder.build({
    modelFiles: files,
    modelType: 'cong',
    loadDefaultDict: true,
    loadMultiDict: true,
    loadTypoDict: false,
  });
  console.log('build(cong, no typo) ms:', (performance.now() - t1).toFixed(0));

  const matchModes = [
    { name: 'Match.all', value: Match.all },
    { name: 'Match.allWithNormalizing', value: Match.allWithNormalizing },
    { name: 'Match.none', value: Match.none },
  ];

  /** @type {Record<string, unknown>} */
  const report = {
    kiwiNlpVersion: pkg.version,
    kiwiNlpLicense: pkg.license,
    wasmVersion,
    modelPack: 'kiwi_model_v0.23.1_base.tgz → models/cong/base',
    modelType: 'cong',
    typoDictLoaded: false,
    wasmBytes,
    modelFiles: sizes,
    samples: [],
  };

  for (const sample of SAMPLES) {
    /** @type {Record<string, unknown>} */
    const row = { input: sample, modes: {} };
    for (const mode of matchModes) {
      const tA = performance.now();
      const result = await kiwi.analyze(sample, mode.value);
      const ms = performance.now() - tA;
      const tokens = result?.tokens ?? [];
      const fails = checkSurface1to1(sample, tokens);
      row.modes[mode.name] = {
        ms: Number(ms.toFixed(2)),
        score: result?.score,
        tokenCount: tokens.length,
        summary: summarizeTokens(tokens),
        surface1to1: fails.length === 0,
        failCount: fails.length,
        fails: fails.slice(0, 5),
        firstTokens: tokens.slice(0, 8).map((t) => ({
          str: t.str,
          tag: t.tag,
          position: t.position,
          length: t.length,
          score: t.score,
          typoCost: t.typoCost,
        })),
      };
    }
    report.samples.push(row);
    console.log('\n---', JSON.stringify(sample));
    for (const mode of matchModes) {
      const m = row.modes[mode.name];
      console.log(
        mode.name,
        `1:1=${m.surface1to1}`,
        `ms=${m.ms}`,
        m.summary,
      );
    }
  }

  // soft-wrap-ish: 인위적으로 붙인 줄
  const soft = '우리 나라에는 명지 계곡 외에도';
  const softResult = await kiwi.analyze(soft, Match.all);
  const softFails = checkSurface1to1(soft, softResult.tokens ?? []);
  report.softWrapLine = {
    input: soft,
    surface1to1: softFails.length === 0,
    summary: summarizeTokens(softResult.tokens ?? []),
  };
  console.log('\nsoft-wrap line 1:1=', softFails.length === 0, report.softWrapLine.summary);

  const outPath = path.join(root, 'tmp/kiwi-p0-spike-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\nreport →', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
