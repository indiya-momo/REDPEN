/**
 * 경주멍 KEEP 중 VX 없음 → gluedCompoundLemma + 표준국어대사전 등재 여부
 *
 *   node --import ./scripts/_json-import-hook.mjs scripts/_probe_aux_solid_novx.mjs [pdf]
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
import {
  clearAuxiliaryDictSolidCache,
  gluedCompoundLemma,
  isRegisteredPredicateLemma,
} from '../src/lib/auxiliaryDictSolid.js';
import { bonBojoDisplayLabelForItem } from '../src/lib/bonBojoRules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
).href;

const pdfPath =
  process.argv[2] ||
  'C:\\Users\\gikan\\OneDrive\\바탕 화면\\261117_경주멍-본문 2교지_검토중_.pdf';

const STDICT_ORIGIN = process.env.STDICT_ORIGIN || 'http://127.0.0.1:5173';

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

function hasVx(analyzed) {
  return (analyzed?.tokens ?? []).some(
    (t) => String(t.tag ?? '').split('-')[0] === 'VX',
  );
}

function tagStr(analyzed) {
  return (analyzed?.tokens ?? []).map((t) => `${t.str}/${t.tag}`).join(' ');
}

async function fetchImpl(url, init) {
  const u = new URL(url, STDICT_ORIGIN);
  return fetch(u, init);
}

if (!fs.existsSync(pdfPath)) {
  console.error('PDF 없음:', pdfPath);
  process.exit(1);
}

const { ready } = resolveKiwiNodePaths();
if (!ready) {
  console.error('Kiwi 없음');
  process.exit(1);
}
clearKiwiInstance();
setKiwiInstance(await loadKiwiNode());
clearAuxiliaryDictSolidCache();

const data = JSON.parse(
  readFileSync(new URL('../src/data/bon-bojo-rules.json', import.meta.url), 'utf8'),
);

const stemRules = [];
for (const group of data.groups ?? []) {
  for (const item of group.items ?? []) {
    for (const raw of item.stems ?? []) {
      const parts = String(raw).trim().split(/\s+/).filter(Boolean);
      if (parts.length !== 2) continue;
      const spaced = auxStem(parts[0], parts[1]);
      const gluedFind = gluedFindFromSpacedAuxFind(spaced);
      const regex = compileRuleRegex({ pattern: 'regex', find: gluedFind });
      if (!regex) continue;
      stemRules.push({
        stem: `${parts[0]} ${parts[1]}`,
        itemId: item.id,
        label: item.displayLabel || item.label,
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

/** @type {Map<string, { n: number, itemId: string, stem: string, tags: string }>} */
const noVx = new Map();

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
      const surface = m[0];
      const analyzed = analyzeLine(surface);
      if (isConfirmedAuxiliaryMorph(analyzed) !== true) continue;
      if (hasVx(analyzed)) continue;
      const key = `${rule.itemId}\t${rule.stem}\t${surface}`;
      const row = noVx.get(key) ?? {
        n: 0,
        itemId: rule.itemId,
        stem: rule.stem,
        tags: tagStr(analyzed),
      };
      row.n += 1;
      noVx.set(key, row);
    }
  }
}

const rows = [...noVx.entries()].map(([key, row]) => ({
  key,
  surface: key.split('\t')[2],
  ...row,
}));

/** @type {{ surface: string, itemId: string, stem: string, n: number, lemma: string, registered: boolean | null, tags: string }[]} */
const out = [];
/** @type {Map<string, boolean | null>} */
const lemmaCache = new Map();

for (const row of rows.sort((a, b) => b.n - a.n)) {
  const label = bonBojoDisplayLabelForItem(row.itemId) || row.itemId;
  const lemma = gluedCompoundLemma(row.surface, row.itemId, label);
  let registered = null;
  if (lemma) {
    if (lemmaCache.has(lemma)) {
      registered = lemmaCache.get(lemma);
    } else {
      registered = await isRegisteredPredicateLemma(lemma, { fetchImpl });
      lemmaCache.set(lemma, registered);
    }
  }
  out.push({
    surface: row.surface,
    itemId: row.itemId,
    stem: row.stem,
    n: row.n,
    lemma,
    registered,
    tags: row.tags,
  });
}

const withLemma = out.filter((r) => r.lemma);
const regYes = out.filter((r) => r.registered === true);
const regNo = out.filter((r) => r.lemma && r.registered === false);
const noLemma = out.filter((r) => !r.lemma);

console.log(
  JSON.stringify(
    {
      pdf: path.basename(pdfPath),
      noVxUnique: out.length,
      noVxHitSum: out.reduce((s, r) => s + r.n, 0),
      withLemma: withLemma.length,
      registeredYes: {
        unique: regYes.length,
        hitSum: regYes.reduce((s, r) => s + r.n, 0),
      },
      registeredNo: {
        unique: regNo.length,
        hitSum: regNo.reduce((s, r) => s + r.n, 0),
      },
      noLemma: {
        unique: noLemma.length,
        hitSum: noLemma.reduce((s, r) => s + r.n, 0),
      },
      stdictLemmasQueried: lemmaCache.size,
    },
    null,
    2,
  ),
);

console.log('\n=== 등재 YES (합성어 표시 대상) top 25 ===');
for (const r of regYes.sort((a, b) => b.n - a.n).slice(0, 25)) {
  console.log(
    `${String(r.n).padStart(3)}  ${r.itemId.padEnd(14)} 「${r.surface}」 → ${r.lemma}  ${r.tags}`,
  );
}

console.log('\n=== 등재 NO (lemma는 있으나 사전 미등재) top 25 ===');
for (const r of regNo.sort((a, b) => b.n - a.n).slice(0, 25)) {
  console.log(
    `${String(r.n).padStart(3)}  ${r.itemId.padEnd(14)} 「${r.surface}」 → ${r.lemma}  ${r.tags}`,
  );
}

console.log('\n=== lemma 없음 top 25 ===');
for (const r of noLemma.sort((a, b) => b.n - a.n).slice(0, 25)) {
  console.log(
    `${String(r.n).padStart(3)}  ${r.itemId.padEnd(14)} 「${r.surface}」  ${r.tags}`,
  );
}

clearKiwiInstance();
