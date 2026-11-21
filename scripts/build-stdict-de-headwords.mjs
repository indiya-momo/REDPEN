/**
 * 표준국어대사전 전체 JSON의 단어 표제어에서 데가 들어간 것만 뽑는다.
 * stdict-verb-forms는 쓰지 않는다(난데없다 활용형이 빠져 있음).
 *
 *   node scripts/build-stdict-de-headwords.mjs "<JSON 폴더>"
 *
 * 출력: public/data/stdict-de-headwords.json
 * 사전 JSON 날짜는 폴더명 또는 --date 로 meta.sourceDate에 적는다(기본 20261106).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/data/stdict-de-headwords.json');

function hangulSyllables(s) {
  let n = 0;
  for (const ch of String(s)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xac00 && cp <= 0xd7a3) n += 1;
  }
  return n;
}

function cleanLemma(word) {
  return String(word ?? '')
    .replace(/-/g, '')
    .replace(/[·\s^]+/g, '')
    .replace(/\d+$/g, '');
}

function stemOf(surface, poses) {
  const pos = poses.join(' ');
  if (/(동사|형용사)/.test(pos) && surface.endsWith('다') && surface.length > 1) {
    return surface.slice(0, -1);
  }
  return surface;
}

function inferDate(dir, argDate) {
  if (argDate) return argDate;
  const m = String(dir).match(/(\d{8})/);
  return m ? m[1] : '20261106';
}

const args = process.argv.slice(2);
const dateIx = args.indexOf('--date');
const argDate = dateIx >= 0 ? args[dateIx + 1] : '';
const filtered = args.filter((a, i) => a !== '--date' && i !== dateIx + 1);
const dictDir = filtered[0];
if (!dictDir) {
  console.error('사용법: node scripts/build-stdict-de-headwords.mjs "<JSON 폴더>" [--date 20261106]');
  process.exit(1);
}

const sourceDate = inferDate(dictDir, argDate);
const files = fs.readdirSync(dictDir).filter((n) => n.endsWith('.json'));
const bySurface = new Map();
for (const name of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dictDir, name), 'utf8'));
  const items = data?.channel?.item ?? [];
  for (const it of items) {
    const wi = it.word_info ?? {};
    if ((wi.word_unit || '') !== '단어') continue;
    const raw = String(wi.word || '');
    const surface = cleanLemma(raw);
    if (!surface.includes('데') || surface === '데') continue;
    const poses = (wi.pos_info ?? []).map((p) => p.pos || '');
    const stem = stemOf(surface, poses);
    const rec = { raw, surface, stem, poses };
    const list = bySurface.get(surface) ?? [];
    list.push(rec);
    bySurface.set(surface, list);
  }
}

const entries = [];
for (const list of bySurface.values()) {
  const first = list[0];
  if (hangulSyllables(first.stem) < 2) continue;
  entries.push({
    raw: [...new Set(list.map((x) => x.raw))].join(', '),
    surface: first.surface,
    stem: first.stem,
    poses: [...new Set(list.flatMap((x) => x.poses))].join('|'),
  });
}
entries.sort(
  (a, b) =>
    b.stem.length - a.stem.length || a.surface.localeCompare(b.surface, 'ko'),
);

const out = {
  meta: {
    sourceDate,
    source: '표준국어대사전 전체 JSON 단어 표제어',
    stemMinSyllables: 2,
    count: entries.length,
  },
  entries,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log('wrote', OUT, 'count', entries.length, 'sourceDate', sourceDate);
