/**
 * 띄어쓰기 단계 0 스파이크. 앱 경로에 연결하지 않는다.
 *
 * 사용: node scripts/spacing-morph-stage0-spike.mjs
 * 필요: kiwi-nlp 0.23.0 (devDependency), 모델
 *   tmp/kiwi-models/models/cong/base/
 *   (kiwi_model_v0.23.1_base.tgz, typo.dict 는 로드하지 않음)
 *
 * 표준국어대사전 API 키가 없으면 공개 검색 HTML의 첫 페이지 표제어만 본다.
 * 그 검색은 exact API가 아니다. 실패하면 등재는 미확인.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KiwiBuilder, Match } from 'kiwi-nlp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const wasmPath = path.join(root, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm');
const modelDir = path.join(root, 'tmp/kiwi-models/models/cong/base');

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

const SENTENCES = [
  '쉬어 가라고',
  '쉬어가다',
  '하지말고',
  '하지말다',
  '하지 말다',
  '하지 마',
  '종이를 말다',
  '국에 밥을 말아',
  '산가지',
  '들어오다',
  '들어 오다',
  '그 말',
];

const DICT_QUERIES = [
  '쉬어가다',
  '들어오다',
  '말다',
  '산가지',
  '가다',
  '오르다',
];

function loadModelFiles(dir, names) {
  /** @type {Record<string, Uint8Array>} */
  const out = {};
  for (const name of names) {
    const p = path.join(dir, name);
    if (!fs.existsSync(p)) throw new Error(`모델 파일 없음: ${p}`);
    out[name] = new Uint8Array(fs.readFileSync(p));
  }
  return out;
}

function summarize(tokens) {
  return tokens.map((t) => `${t.str}/${t.tag}`).join(' ');
}

function surfaceOk(input, tokens) {
  return tokens.every(
    (t) => input.slice(t.position, t.position + t.length) === t.str,
  );
}

/**
 * 공개 검색 결과 첫 페이지. exact API 아님.
 * @param {string} q
 */
async function publicStdict(q) {
  const url = `https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return { query: q, error: `HTTP_${res.status}`, hits: [] };
  const html = await res.text();
  const countMatch = html.match(/찾기 결과 \(총\s+(\d+)\s+개\)/);
  const hits = [];
  const re =
    /class="t_blue1">([\s\S]*?)<\/a><span class="t_gray hanja_font"[^>]*>[\s\S]*?<\/span>\s*(?:\[[^\]]*\])?\s*「([^」]+)」/g;
  let m;
  while ((m = re.exec(html))) {
    const word = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
    hits.push({ word, pos: m[2] });
  }
  const key = q.replace(/[^\uAC00-\uD7A3]/g, '');
  const norm = (word) =>
    word.replace(/[-^]/g, '').replace(/\d+$/g, '');
  const exact = hits.filter((hit) => norm(hit.word) === key);
  return {
    query: q,
    source: 'stdict-public-search-html',
    listedCount: countMatch ? Number(countMatch[1]) : null,
    hits,
    exactHeadword: exact,
  };
}

async function main() {
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`kiwi-nlp wasm 없음: ${wasmPath}`);
  }
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, 'node_modules/kiwi-nlp/package.json'), 'utf8'),
  );
  const files = loadModelFiles(modelDir, MODEL_FILES);
  const builder = await KiwiBuilder.create(wasmPath);
  const kiwi = await builder.build({
    modelFiles: files,
    modelType: 'cong',
    loadDefaultDict: true,
    loadMultiDict: true,
    loadTypoDict: false,
  });

  const analyses = [];
  for (const text of SENTENCES) {
    const result = await kiwi.analyze(text, Match.all);
    const tokens = result?.tokens ?? [];
    analyses.push({
      text,
      surface1to1: surfaceOk(text, tokens),
      summary: summarize(tokens),
      tokens: tokens.map((t) => ({
        str: t.str,
        tag: t.tag,
        position: t.position,
        length: t.length,
      })),
    });
    console.log(`${text}\t${summarize(tokens)}`);
  }

  const dict = [];
  for (const q of DICT_QUERIES) {
    try {
      const row = await publicStdict(q);
      dict.push(row);
      const exact = row.exactHeadword.map((h) => `${h.word}/${h.pos}`).join(', ');
      console.log(
        `DICT ${q}\tlisted=${row.listedCount}\texact=${exact || '없음'}`,
      );
    } catch (err) {
      dict.push({ query: q, error: String(err?.message || err), hits: [] });
      console.log(`DICT ${q}\t미확인 ${err?.message || err}`);
    }
  }

  const report = {
    kiwiNlp: pkg.version,
    license: pkg.license,
    wasmVersion: builder.version(),
    model: 'kiwi_model_v0.23.1_base.tgz models/cong/base',
    typoDictLoaded: false,
    match: 'Match.all',
    stdictApiKey: false,
    analyses,
    dict,
  };
  const out = path.join(root, 'tmp/spacing-morph-stage0-spike.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('report', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
