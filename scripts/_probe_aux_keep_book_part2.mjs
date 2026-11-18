/**
 * book_part2 — 본조 stem 붙임 히트 중 형태소 KEEP 목록·빈도
 * + 「짧은 붙임(한글 2음절) + VX 없음 → 버림」 시뮬레이션이 무엇을 치는지
 *
 *   node --import ./scripts/_json-import-hook.mjs scripts/_probe_aux_keep_book_part2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPageText } from '../src/lib/pdfPageText.js';
import { readFileSync } from 'node:fs';
import { gluedFindFromSpacedAuxFind } from '../src/lib/auxiliaryGluedFromSpaced.js';
import {
  AUXILIARY_FLEX_SPACE,
  STEM_TAIL_BOUNDARY,
  STEM_TAIL_END,
  escapeRegex,
} from '../src/lib/compoundPatternCommon.js';
import { compileRuleRegex } from '../src/lib/regexFromFind.js';
import { analyzeLine } from '../src/lib/kiwiMorph/analyze.js';
import { loadKiwiNode, resolveKiwiNodePaths } from '../src/lib/kiwiMorph/loadNode.js';
import { setKiwiInstance, clearKiwiInstance } from '../src/lib/kiwiMorph/runtime.js';
import { isConfirmedAuxiliaryMorph } from '../src/lib/auxiliaryMorphFilter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const pdfPath =
  process.argv[2] ||
  'C:\\Users\\gikan\\OneDrive\\바탕 화면\\book_part2.pdf';

const AUX_TAIL_FORBIDDEN_AFTER = {
  하: '루|하|히|허|할|함|합|핫',
  주: '택|민|식|문|장|의|재|권|년|일|번|소',
  지: '급|역|금|구|도|원|적|시|명|점|체|속|식|연|출',
  보: '상|통|율|안|류|수|호|증|장|험|관|고서|이|일|여|였',
  두: '운|워|웠|움',
};

function auxStem(head, tailSyl) {
  const forbid = AUX_TAIL_FORBIDDEN_AFTER[tailSyl];
  const tailPart = forbid
    ? `${escapeRegex(tailSyl)}(?!${forbid})${STEM_TAIL_END}`
    : `${escapeRegex(tailSyl)}${STEM_TAIL_END}`;
  return `(\\S*${escapeRegex(head)})${AUXILIARY_FLEX_SPACE}(${tailPart})(?!으로)${STEM_TAIL_BOUNDARY}`;
}

function hangulLen(s) {
  return (String(s).match(/[\uAC00-\uD7A3]/g) ?? []).length;
}

function hasVx(analyzed) {
  return (analyzed?.tokens ?? []).some((t) =>
    String(t.tag ?? '').split('-')[0] === 'VX',
  );
}

function tagStr(analyzed) {
  return (analyzed?.tokens ?? []).map((t) => `${t.str}/${t.tag}`).join(' ');
}

if (!fs.existsSync(pdfPath)) {
  console.error('PDF 없음:', pdfPath);
  process.exit(1);
}

const { ready } = resolveKiwiNodePaths();
if (!ready) {
  console.error('Kiwi 모델 없음');
  process.exit(1);
}
clearKiwiInstance();
setKiwiInstance(await loadKiwiNode());

const data = JSON.parse(
  readFileSync(new URL('../src/data/bon-bojo-rules.json', import.meta.url), 'utf8'),
);

/** @type {{ stem: string, itemId: string, gluedFind: string, regex: RegExp }[]} */
const stemRules = [];
for (const group of data.groups ?? []) {
  for (const item of group.items ?? []) {
    for (const raw of item.stems ?? []) {
      const parts = String(raw).trim().split(/\s+/).filter(Boolean);
      if (parts.length !== 2) continue;
      const stem = `${parts[0]} ${parts[1]}`;
      const spaced = auxStem(parts[0], parts[1]);
      const gluedFind = gluedFindFromSpacedAuxFind(spaced);
      const regex = compileRuleRegex({ pattern: 'regex', find: gluedFind });
      if (!regex) continue;
      stemRules.push({
        stem,
        itemId: item.id,
        gluedFind,
        regex,
      });
    }
  }
}

const fileBuf = fs.readFileSync(pdfPath);
const pdf = await pdfjsLib.getDocument({
  data: new Uint8Array(fileBuf.buffer, fileBuf.byteOffset, fileBuf.byteLength),
  cMapUrl:
    pathToFileURL(path.resolve(__dirname, '../public/pdfjs/cmaps')).href + '/',
  cMapPacked: true,
}).promise;

/** @type {Map<string, { n: number, stem: string, itemId: string, tags: string, vx: boolean, short: boolean, pages: Set<number> }>} */
const keep = new Map();
/** @type {Map<string, number>} */
const dropCount = new Map();
let rawGlued = 0;

for (let i = 1; i <= pdf.numPages; i += 1) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = content.items.filter((it) => typeof it?.str === 'string');
  const text = String(buildPageText(items).text ?? '');
  if (!text) continue;

  for (const rule of stemRules) {
    const re = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!m[0] || /\s/.test(m[0])) {
        if (m[0]?.length === 0) re.lastIndex += 1;
        continue;
      }
      rawGlued += 1;
      const surface = m[0];
      const analyzed = analyzeLine(surface);
      const conf = isConfirmedAuxiliaryMorph(analyzed);
      if (conf !== true) {
        dropCount.set(surface, (dropCount.get(surface) ?? 0) + 1);
        continue;
      }
      const key = `${rule.itemId}\t${rule.stem}\t${surface}`;
      let row = keep.get(key);
      if (!row) {
        row = {
          n: 0,
          stem: rule.stem,
          itemId: rule.itemId,
          tags: tagStr(analyzed),
          vx: hasVx(analyzed),
          short: hangulLen(surface) <= 2,
          pages: new Set(),
        };
        keep.set(key, row);
      }
      row.n += 1;
      row.pages.add(i);
    }
  }
}

const keepRows = [...keep.entries()]
  .map(([key, row]) => ({ key, ...row, pageList: [...row.pages].sort((a, b) => a - b) }))
  .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key, 'ko'));

const shortNoVx = keepRows.filter((r) => r.short && !r.vx);
const shortWithVx = keepRows.filter((r) => r.short && r.vx);
const longKeep = keepRows.filter((r) => !r.short);

console.log(
  JSON.stringify(
    {
      pdf: path.basename(pdfPath),
      pages: pdf.numPages,
      stemRules: stemRules.length,
      rawGluedHits: rawGlued,
      keepUnique: keepRows.length,
      keepHitSum: keepRows.reduce((s, r) => s + r.n, 0),
      dropUniqueSurfaces: dropCount.size,
      sim_shortNoVx_wouldDrop: {
        unique: shortNoVx.length,
        hitSum: shortNoVx.reduce((s, r) => s + r.n, 0),
      },
      shortWithVx_kept: {
        unique: shortWithVx.length,
        hitSum: shortWithVx.reduce((s, r) => s + r.n, 0),
      },
    },
    null,
    2,
  ),
);

console.log('\n=== KEEP top 40 (빈도) ===');
for (const r of keepRows.slice(0, 40)) {
  console.log(
    `${String(r.n).padStart(4)}  ${r.short ? '短' : '長'}${r.vx ? 'VX' : '  '}  ${r.itemId.padEnd(14)} stem=${r.stem.padEnd(8)} 「${r.key.split('\t')[2]}」  ${r.tags}  p:${r.pageList.slice(0, 8).join(',')}${r.pageList.length > 8 ? '…' : ''}`,
  );
}

console.log('\n=== 시뮬: 한글2음절 이하 + VX없음 → 버릴 KEEP ===');
for (const r of shortNoVx.sort((a, b) => b.n - a.n)) {
  console.log(
    `${String(r.n).padStart(4)}  ${r.itemId.padEnd(14)} stem=${r.stem.padEnd(8)} 「${r.key.split('\t')[2]}」  ${r.tags}`,
  );
}

console.log('\n=== 시뮬에 안 걸림: 한글2음절 + VX 있음 (살림) ===');
for (const r of shortWithVx.sort((a, b) => b.n - a.n).slice(0, 30)) {
  console.log(
    `${String(r.n).padStart(4)}  ${r.itemId.padEnd(14)} stem=${r.stem.padEnd(8)} 「${r.key.split('\t')[2]}」  ${r.tags}`,
  );
}

// 관심 표면이 DROP/KEEP 어디에 있는지
const watch = [
  '어두운',
  '어두컴컴한',
  '어지러운',
  '고마운',
  '아내',
  '아들',
  '아주',
  '아나',
  '어가',
  '여보',
  '해가',
  '해가는',
];
console.log('\n=== 관심 표면 (원고 안 등장·KEEP·DROP) ===');
for (const w of watch) {
  const k = keepRows.filter((r) => r.key.endsWith(`\t${w}`));
  const d = dropCount.get(w) ?? 0;
  if (!k.length && !d) {
    console.log(`  (없음) ${w}`);
    continue;
  }
  for (const r of k) {
    console.log(`  KEEP×${r.n} ${w} ← ${r.itemId} / ${r.stem} / ${r.tags}`);
  }
  if (d) console.log(`  DROP×${d} ${w}`);
}

console.log('\n=== DROP 표면 전부 (표면×횟수) ===');
for (const [s, n] of [...dropCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))) {
  console.log(`  DROP×${n} 「${s}」`);
}

console.log('\n=== verb-duda KEEP 전부 ===');
const duda = keepRows.filter((r) => r.itemId === 'verb-duda');
if (!duda.length) console.log('  (없음)');
for (const r of duda.sort((a, b) => b.n - a.n)) {
  console.log(
    `  KEEP×${r.n} stem=${r.stem} 「${r.key.split('\t')[2]}」  ${r.tags}  p:${r.pageList.join(',')}`,
  );
}

const noVx = keepRows.filter((r) => !r.vx);
const withVx = keepRows.filter((r) => r.vx);
console.log(
  `\n=== KEEP VX 유무: VX있음 unique=${withVx.length} sum=${withVx.reduce((s, r) => s + r.n, 0)} / VX없음 unique=${noVx.length} sum=${noVx.reduce((s, r) => s + r.n, 0)} ===`,
);
console.log('\n=== KEEP VX없음 top 30 (합성·단일동사 후보) ===');
for (const r of noVx.sort((a, b) => b.n - a.n).slice(0, 30)) {
  console.log(
    `${String(r.n).padStart(4)}  ${r.itemId.padEnd(14)} stem=${r.stem.padEnd(8)} 「${r.key.split('\t')[2]}」  ${r.tags}`,
  );
}

clearKiwiInstance();
