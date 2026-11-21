/**
 * Long-compound silence smoke with removed-by attribution.
 *   npx vite-node scripts/smoke-long-compound-silence.mjs
 *
 * Stages:
 *   beforeCount = ruleEngine 1cha long-compound instances
 *   afterCount  = enrichAuxiliaryDictSolid 2cha instances
 * removed-by (per before row, same rules as enrich):
 *   registered-silence | hyphen-gate | registered-compound-solid | kept | kept-no-compound-lemma
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDefaultAuxiliaryVerbs } from '../src/lib/defaultAuxiliaryVerbs.js';
import { BON_BOJO_LONG_COMPOUND_SPLIT_ID } from '../src/lib/bonBojoRules.js';
import { runRuleCheck } from '../src/lib/ruleEngine.js';
import {
  citationOfSplitRow,
  clearAuxiliaryDictSolidCache,
  enrichAuxiliaryDictSolid,
  longCompoundSplitLemma,
} from '../src/lib/auxiliaryDictSolid.js';
import {
  citationHasCompoundHyphen,
  clearStdictVerbFormsCache,
  resolveSpaceRequiredLemma,
  setStdictVerbFormsForTests,
  shouldSilenceLongCompoundHostAsRegisteredLemma,
  stdictVerbFormsLemmaCount,
} from '../src/lib/stdictVerbForms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const desk = 'C:\\Users\\gikan\\OneDrive\\\uBC14\uD0D5 \uD654\uBA74';
const verbForms = JSON.parse(
  fs.readFileSync(path.join(root, 'public/data/stdict-verb-forms.json'), 'utf8'),
);

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

function instKey(inst) {
  return [
    inst.pageNum ?? 1,
    inst.start ?? '',
    inst.end ?? '',
    inst.matchedText ?? '',
    inst.suggestedText ?? '',
  ].join('|');
}

function flatInstances(groups) {
  return (groups ?? []).flatMap((g) =>
    (g.instances ?? []).map((inst) => ({
      matchedText: inst.matchedText,
      suggestedText: inst.suggestedText,
      head: splitHead(inst.suggestedText),
      pageNum: inst.pageNum,
      start: inst.start,
      end: inst.end,
    })),
  );
}

/** Mirror enrichAuxiliaryDictSolid long-compound job kinds. */
function classifyRemovedBy(row, analyze) {
  const head = row.head || splitHead(row.suggestedText);
  if (shouldSilenceLongCompoundHostAsRegisteredLemma(head)) {
    return resolveSpaceRequiredLemma(head, head)
      ? 'registered-silence'
      : 'registered-silence-unresolved';
  }
  const citation = citationOfSplitRow(
    { suggestedText: row.suggestedText },
    analyze,
  );
  if (!citation || !citationHasCompoundHyphen(citation)) {
    return 'hyphen-gate';
  }
  const lemma = longCompoundSplitLemma(row.suggestedText);
  if (!lemma) return 'kept-no-compound-lemma';
  if (resolveSpaceRequiredLemma(lemma, lemma)) {
    return 'registered-compound-solid';
  }
  return 'kept';
}

function tallyReasons(rows, analyze) {
  const counts = {
    'registered-silence': 0,
    'registered-silence-unresolved': 0,
    'hyphen-gate': 0,
    'registered-compound-solid': 0,
    'kept-no-compound-lemma': 0,
    kept: 0,
  };
  const samples = {
    'registered-silence': [],
    'hyphen-gate': [],
    'registered-compound-solid': [],
    kept: [],
  };
  for (const row of rows) {
    const reason = classifyRemovedBy(row, analyze);
    counts[reason] = (counts[reason] ?? 0) + 1;
    const bucket = samples[reason];
    if (bucket && bucket.length < 5) {
      bucket.push({
        matchedText: row.matchedText,
        suggestedText: row.suggestedText,
        head: row.head,
        removedBy: reason,
      });
    }
  }
  return { counts, samples };
}

function pairList(rows) {
  const pairs = new Map();
  for (const row of rows) {
    const lemma = row.head;
    let bucket = pairs.get(lemma);
    if (!bucket) {
      bucket = { host: lemma, lemma, examples: new Map(), count: 0 };
      pairs.set(lemma, bucket);
    }
    bucket.count += 1;
    const ex = String(row.matchedText ?? '');
    bucket.examples.set(ex, (bucket.examples.get(ex) ?? 0) + 1);
  }
  return [...pairs.values()]
    .map((b) => ({
      host: b.host,
      lemma: b.lemma,
      count: b.count,
      examples: [...b.examples.entries()]
        .sort((a, c) => c[1] - a[1])
        .slice(0, 8)
        .map(([text, n]) => ({ text, n })),
    }))
    .sort((a, b) => b.count - a.count);
}

async function measure(corpus, rules, opts) {
  const pages = [{ pageNum: 1, text: corpus.text }];
  const { results } = runRuleCheck(pages, rules);
  const beforeGroups = (results ?? []).filter((g) => g.auxSplitLongCompound);
  const before = flatInstances(beforeGroups);
  const analyze = opts.analyze ?? (() => null);

  const attribution = tallyReasons(before, analyze);
  const silenceOnFate = before.map((row) => ({
    key: instKey(row),
    reason: classifyRemovedBy(row, analyze),
  }));
  // A/B: pretend silence always false — only non-silence reasons apply.
  const silenceOffWouldKeepOrGate = before.map((row) => {
    const head = row.head;
    const citation = citationOfSplitRow(
      { suggestedText: row.suggestedText },
      analyze,
    );
    if (!citation || !citationHasCompoundHyphen(citation)) return 'hyphen-gate';
    const lemma = longCompoundSplitLemma(row.suggestedText);
    if (!lemma) return 'kept-no-compound-lemma';
    if (resolveSpaceRequiredLemma(lemma, lemma)) return 'registered-compound-solid';
    return 'kept';
  });
  const silenceDelta = silenceOnFate.filter((row, i) => {
    if (row.reason !== 'registered-silence' && row.reason !== 'registered-silence-unresolved') {
      return false;
    }
    // With silence off these would not be registered-silence.
    return silenceOffWouldKeepOrGate[i] !== row.reason;
  }).length;

  const afterGroups = await enrichAuxiliaryDictSolid(beforeGroups, opts);
  const after = flatInstances(afterGroups);
  const afterKeys = new Set(after.map(instKey));
  const registeredSilenced = before.filter(
    (row) =>
      shouldSilenceLongCompoundHostAsRegisteredLemma(row.head) &&
      !afterKeys.has(instKey(row)),
  );

  const expectedKept = before.filter((row) => {
    const r = classifyRemovedBy(row, analyze);
    return r === 'kept' || r === 'kept-no-compound-lemma';
  }).length;
  const expectedRemoved =
    attribution.counts['registered-silence'] +
    attribution.counts['registered-silence-unresolved'] +
    attribution.counts['hyphen-gate'] +
    attribution.counts['registered-compound-solid'];

  return {
    label: corpus.label,
    chars: corpus.text.length,
    stages: {
      beforeCount: before.length,
      beforeStage: 'ruleEngine long-compound instances (1cha)',
      afterCount: after.length,
      afterStage: 'enrichAuxiliaryDictSolid (2cha)',
    },
    beforeCount: before.length,
    afterCount: after.length,
    removedBy: attribution.counts,
    removedBySamples: attribution.samples,
    expectedKeptByClassifier: expectedKept,
    expectedRemovedByClassifier: expectedRemoved,
    afterMatchesExpectedKept: after.length === expectedKept,
    silenceOnOffDelta: silenceDelta,
    registeredSilencedCount: registeredSilenced.length,
    silencePairs: pairList(registeredSilenced),
  };
}

async function loadAnalyze() {
  try {
    const { loadKiwiNode } = await import('../src/lib/kiwiMorph/loadNode.js');
    const { analyzeLine } = await import('../src/lib/kiwiMorph/analyze.js');
    await loadKiwiNode();
    return { analyze: analyzeLine, analyzeMode: 'kiwi' };
  } catch (err) {
    return {
      analyze: () => null,
      analyzeMode: 'stub-null',
      analyzeError: String(err?.message ?? err),
    };
  }
}

async function main() {
  const corpora = [
    loadCorpus(
      '\uACBD\uC8FC\uBA4D(3\uAD50)',
      path.join(desk, '261120_\uACBD\uC8FC\uBA4D-\uBCF8\uBB38(3\uAD50)_\uC791\uC5C5.json'),
    ),
    loadCorpus('yumul', path.join(root, 'tmp-pdf-extract', 'yumul.txt')),
    loadCorpus('street', path.join(root, 'tmp-pdf-extract', 'street.txt')),
  ];
  const rules = longRules();
  const { analyze, analyzeMode, analyzeError } = await loadAnalyze();

  clearAuxiliaryDictSolidCache();
  setStdictVerbFormsForTests(verbForms);
  const lemmaCountLoaded = stdictVerbFormsLemmaCount();

  const syntheticGroup = {
    patternKind: 'auxiliary-verb',
    auxSplitLongCompound: true,
    tip: '',
    instances: [
      {
        matchedText: '\ucc3e\uc544\uc624\ub2e4\uac00\ub3c4',
        suggestedText: '\ucc3e\uc544\uc624\ub2e4 \uac00\ub3c4',
      },
      {
        matchedText: '\uc5b4\ub8e8\ub9cc\uc838\uc8fc\uc138\uc694',
        suggestedText: '\uc5b4\ub8e8\ub9cc\uc838 \uc8fc\uc138\uc694',
      },
      {
        matchedText: '\ub4e4\uc5b4\uc640\uc8fc\uc138\uc694',
        suggestedText: '\ub4e4\uc5b4\uc640 \uc8fc\uc138\uc694',
      },
    ],
  };
  const synthAnalyze = (head) => {
    if (head === '\uc5b4\ub8e8\ub9cc\uc838') {
      return {
        tokens: [
          { str: '\uc5b4\ub8e8\ub9cc\uc9c0', tag: 'VV' },
          { str: '\uc5b4', tag: 'EF' },
        ],
      };
    }
    if (head === '\ub4e4\uc5b4\uc640') {
      return {
        tokens: [
          { str: '\ub4e4\uc5b4\uc624', tag: 'VV' },
          { str: '\uc544', tag: 'EF' },
        ],
      };
    }
    return null;
  };
  const syntheticLoaded = await enrichAuxiliaryDictSolid([syntheticGroup], {
    verbForms,
    analyze: synthAnalyze,
  });
  const loadedTexts = (syntheticLoaded[0]?.instances ?? []).map(
    (i) => i.matchedText,
  );

  clearAuxiliaryDictSolidCache();
  clearStdictVerbFormsCache();
  const syntheticUnloaded = await enrichAuxiliaryDictSolid(
    [structuredClone(syntheticGroup)],
    { analyze: synthAnalyze },
  );
  const unloadedTexts = (syntheticUnloaded[0]?.instances ?? []).map(
    (i) => i.matchedText,
  );

  clearAuxiliaryDictSolidCache();
  setStdictVerbFormsForTests(verbForms);

  const withLoad = [];
  for (const c of corpora) {
    withLoad.push(await measure(c, rules, { verbForms, analyze }));
  }

  const totals = withLoad.reduce(
    (acc, row) => {
      acc.before += row.beforeCount;
      acc.after += row.afterCount;
      for (const [k, v] of Object.entries(row.removedBy)) {
        acc.removedBy[k] = (acc.removedBy[k] ?? 0) + v;
      }
      acc.silenceOnOffDelta += row.silenceOnOffDelta;
      return acc;
    },
    {
      before: 0,
      after: 0,
      removedBy: {},
      silenceOnOffDelta: 0,
    },
  );

  const out = {
    generatedAt: new Date().toISOString(),
    lemmaCount: lemmaCountLoaded,
    analyzeMode,
    analyzeError: analyzeError || undefined,
    measuredEffectOnCorpora: 'none',
    measuredEffectNote:
      '1cha -daga* already removes ...da+ga heads; registered-silence delta on these three corpora is 0. Gate kept as safety net.',
    stagesNote: {
      beforeCount: 'ruleEngine 1cha long-compound instance rows',
      afterCount: 'enrichAuxiliaryDictSolid 2cha remaining instance rows',
    },
    syntheticEnrich: {
      loadedKept: loadedTexts,
      unloadedKept: unloadedTexts,
      expectLoadedSilencesRegistered: !loadedTexts.includes(
        '\ucc3e\uc544\uc624\ub2e4\uac00\ub3c4',
      ),
      // 미로드 시 침묵은 안 켜지지만, H 인덱스 부재로 칸 전체가 닫혀 행이 빌 수 있음.
      unloadNote:
        'silence false when unloaded; hyphen-gate may still empty the column',
      ok:
        loadedTexts.includes('\uc5b4\ub8e8\ub9cc\uc838\uc8fc\uc138\uc694') &&
        loadedTexts.includes('\ub4e4\uc5b4\uc640\uc8fc\uc138\uc694') &&
        !loadedTexts.includes('\ucc3e\uc544\uc624\ub2e4\uac00\ub3c4'),
    },
    totals,
    withExtractLoaded: withLoad,
  };

  const outPath = path.join(root, 'tmp-long-compound-silence-smoke.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  console.log('wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
