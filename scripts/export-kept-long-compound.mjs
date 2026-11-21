/**
 * Export kept rows for editor labeling (context-first, hints folded).
 *   npx vite-node scripts/export-kept-long-compound.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDefaultAuxiliaryVerbs } from '../src/lib/defaultAuxiliaryVerbs.js';
import { BON_BOJO_LONG_COMPOUND_SPLIT_ID } from '../src/lib/bonBojoRules.js';
import { runRuleCheck } from '../src/lib/ruleEngine.js';
import {
  clearAuxiliaryDictSolidCache,
  enrichAuxiliaryDictSolid,
} from '../src/lib/auxiliaryDictSolid.js';
import { setStdictVerbFormsForTests } from '../src/lib/stdictVerbForms.js';
import { loadKiwiNode } from '../src/lib/kiwiMorph/loadNode.js';
import { analyzeLine } from '../src/lib/kiwiMorph/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desk = 'C:\\Users\\gikan\\OneDrive\\\uBC14\uD0D5 \uD654\uBA74';
const verbForms = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/stdict-verb-forms.json'), 'utf8'),
);
const CTX = 36;

function splitHead(suggestedText) {
  const head = String(suggestedText ?? '').trim().split(/\s+/)[0] ?? '';
  return head.replace(/[^\uAC00-\uD7A3]/g, '');
}

function longRules() {
  return ensureDefaultAuxiliaryVerbs([])
    .filter((r) => r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID)
    .map((r) => ({ ...r, enabled: true }));
}

function loadCorpus(label, source) {
  if (source.endsWith('.json')) {
    const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
    return { label, source, text: String(raw.rawText ?? '') };
  }
  return { label, source, text: fs.readFileSync(source, 'utf8') };
}

function csvEscape(v) {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function contextAround(text, start, end) {
  const s = Number.isFinite(start) ? start : -1;
  const e = Number.isFinite(end) ? end : -1;
  if (s < 0 || e < 0) {
    return { before: '', after: '', offset: '' };
  }
  return {
    before: text.slice(Math.max(0, s - CTX), s),
    after: text.slice(e, Math.min(text.length, e + CTX)),
    offset: String(s),
  };
}

async function main() {
  await loadKiwiNode();
  clearAuxiliaryDictSolidCache();
  setStdictVerbFormsForTests(verbForms);
  const rules = longRules();
  const corpora = [
    loadCorpus(
      '\uACBD\uC8FC\uBA4D(3\uAD50)',
      path.join(desk, '261120_\uACBD\uC8FC\uBA4D-\uBCF8\uBB38(3\uAD50)_\uC791\uC5C5.json'),
    ),
    loadCorpus('yumul', path.join(root, 'tmp-pdf-extract', 'yumul.txt')),
    loadCorpus('street', path.join(root, 'tmp-pdf-extract', 'street.txt')),
  ];

  const rows = [];
  for (const c of corpora) {
    const { results } = runRuleCheck([{ pageNum: 1, text: c.text }], rules);
    const beforeGroups = (results ?? []).filter((g) => g.auxSplitLongCompound);
    const afterGroups = await enrichAuxiliaryDictSolid(beforeGroups, {
      verbForms,
      analyze: analyzeLine,
    });
    for (const g of afterGroups) {
      for (const inst of g.instances ?? []) {
        const matched = String(inst.matchedText ?? '');
        let start = Number(inst.start);
        let end = Number(inst.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          // fallback: first occurrence after previous same surface (approx)
          start = c.text.indexOf(matched);
          end = start >= 0 ? start + matched.length : -1;
        }
        // Prefer index/start from rule engine if present
        if (Number.isFinite(inst.index) && !Number.isFinite(inst.start)) {
          start = Number(inst.index);
          end = start + matched.length;
        }
        const ctx = contextAround(c.text, start, end);
        rows.push({
          corpus: c.label,
          pageNum: inst.pageNum ?? 1,
          offset: ctx.offset,
          before: ctx.before,
          matchedText: matched,
          after: ctx.after,
          judgment: '',
          fpType: '',
          // folded after judgment cols
          suggestedText: inst.suggestedText ?? '',
          head: splitHead(inst.suggestedText),
        });
      }
    }
  }

  // Deduplicate offset for same surface: if start was wrong indexOf, refine
  // by walking occurrences in order per corpus+matched
  const seen = new Map();
  for (const r of rows) {
    if (r.offset !== '') continue;
    const key = `${r.corpus}\0${r.matchedText}`;
    let from = seen.get(key) ?? 0;
    const corpus = corpora.find((c) => c.label === r.corpus);
    const idx = corpus.text.indexOf(r.matchedText, from);
    if (idx >= 0) {
      const ctx = contextAround(corpus.text, idx, idx + r.matchedText.length);
      r.offset = ctx.offset;
      r.before = ctx.before;
      r.after = ctx.after;
      seen.set(key, idx + r.matchedText.length);
    }
  }
  // Also fix rows that all got same first indexOf
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.corpus}\0${r.matchedText}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(r);
  }
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const [corpusLabel, matched] = key.split('\0');
    const corpus = corpora.find((c) => c.label === corpusLabel);
    let from = 0;
    for (const r of list) {
      const idx = corpus.text.indexOf(matched, from);
      if (idx < 0) break;
      const ctx = contextAround(corpus.text, idx, idx + matched.length);
      r.offset = ctx.offset;
      r.before = ctx.before;
      r.after = ctx.after;
      from = idx + matched.length;
    }
  }

  const header = [
    '\uC6D0\uACE0',
    '\uC989',
    '\uC624\uD504\uC14B',
    '\uC55E\uBB38\uB9E5',
    '\uC6D0\uBB38',
    '\uB4A4\uBB38\uB9E5',
    '\uD310\uC815(\uC815\uD0D0/\uC624\uD0D0)',
    '\uC624\uD0D0 \uC720\uD615(\uAC00|\uB098|\uB2E4|\uB77C)',
    '\uC81C\uC548(\uD310\uC815 \uD6C4)',
    'head(\uD310\uC815 \uD6C4)',
  ];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.corpus,
        r.pageNum,
        r.offset,
        r.before,
        r.matchedText,
        r.after,
        r.judgment,
        r.fpType,
        r.suggestedText,
        r.head,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];

  const outCsv = path.join(root, 'project-docs', 'long-compound-kept-25-label.csv');
  const outJson = path.join(root, 'project-docs', 'long-compound-kept-25-label.json');
  const body = '\uFEFF' + lines.join('\n') + '\n';
  fs.writeFileSync(outCsv, body, 'utf8');
  fs.writeFileSync(path.join(desk, 'long-compound-kept-25-label.csv'), body, 'utf8');
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: 'Judge from context first; suggestedText/head are folded after judgment columns. No auto judgment.',
        count: rows.length,
        rows,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(JSON.stringify({ count: rows.length, outCsv }, null, 2));
  for (const r of rows) {
    console.log(
      `${r.corpus}\t${r.offset}\t…${r.before}|${r.matchedText}|${r.after}…`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
