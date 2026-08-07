/**
 * verbalTails 중 띄움·Surface 관형 휴리스틱으로 이미 DROP되는 표면 후보.
 * 연결(-고/-다…)은 morphTail·붙임 infix가 JSON 꼬리에 의존 → 관형만 안전히 이관.
 *   node scripts/prune-redundant-verbal-tails.mjs [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/unify-noise-list.json');
const apply = process.argv.includes('--apply');

const { isSpacedLeftAdnominalNoiseEojeol } = await import(
  pathToFileURL(
    path.join(ROOT, 'src/lib/unifyNoiseListAdnominalHeuristic.js'),
  ).href,
);
const {
  isSpacedAdverbGeNoiseEojeol,
  isSpacedAdverbHiNoiseEojeol,
  isSpacedClosedConjunctionNoiseEojeol,
  isSpacedClosedVerbalNoiseEojeol,
  isSpacedDependentSuffixNoiseEojeol,
  isSpacedOrdinalNoiseEojeol,
  isSpacedVerbalConnectiveNoiseEojeol,
} = await import(
  pathToFileURL(
    path.join(ROOT, 'src/lib/unifyNoiseListLexicalHeuristic.js'),
  ).href,
);
const { isSpacedLeftJosaNoiseEojeol } = await import(
  pathToFileURL(path.join(ROOT, 'src/lib/unifyNoiseListLeftHeuristic.js'))
    .href,
);

/**
 * JSON verbalTail 없이 어절 단독 DROP 가능한지 (Surface/리스트·본보조 제외).
 * @param {string} surface
 */
function coveredByHeuristicAlone(surface) {
  if (isSpacedLeftAdnominalNoiseEojeol(surface)) return 'adnominal';
  if (isSpacedVerbalConnectiveNoiseEojeol(surface)) return 'verbalConnective';
  if (isSpacedAdverbHiNoiseEojeol(surface)) return 'adverbHi';
  if (isSpacedAdverbGeNoiseEojeol(surface)) return 'adverbGe';
  if (isSpacedOrdinalNoiseEojeol(surface)) return 'ordinal';
  if (isSpacedDependentSuffixNoiseEojeol(surface)) return 'jari';
  if (isSpacedClosedConjunctionNoiseEojeol(surface)) return 'conjunction';
  if (isSpacedClosedVerbalNoiseEojeol(surface)) return 'closedVerbal';
  if (isSpacedLeftJosaNoiseEojeol(surface)) return 'josa';
  return null;
}

const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const verbal = [...(raw.verbalTails ?? [])];
/** @type {{ surface: string, via: string }[]} */
const redundant = [];
/** @type {{ surface: string, via: string }[]} */
const unsafeConnective = [];
/** @type {string[]} */
const keep = [];

for (const surface of verbal) {
  const via = coveredByHeuristicAlone(surface);
  if (!via) {
    keep.push(surface);
    continue;
  }
  // Surface에 verbalLike·adnominal·infix가 있으면 JSON 제거 안전.
  if (via === 'adnominal' || via === 'verbalConnective' || via === 'closedVerbal') {
    redundant.push({ surface, via });
  } else {
    unsafeConnective.push({ surface, via });
    keep.push(surface);
  }
}

const byVia = new Map();
for (const r of [...redundant, ...unsafeConnective]) {
  byVia.set(r.via, (byVia.get(r.via) ?? 0) + 1);
}

console.log(
  `verbalTails ${verbal.length} → keep ${keep.length}, prune ${redundant.length}, skip ${unsafeConnective.length}`,
);
console.log('by heuristic:', Object.fromEntries([...byVia.entries()].sort()));
console.log(
  'safe prune:',
  redundant.map((r) => `${r.surface}(${r.via})`),
);
if (unsafeConnective.length) {
  console.log(
    'skip (need JSON for morphTail/infix):',
    unsafeConnective.map((r) => `${r.surface}(${r.via})`),
  );
}

if (apply) {
  raw.verbalTails = keep;
  raw.harvestNote =
    'npm run sync-unify-noise-list. verbal 관형·연결 중복은 Surface 휴리스틱 이관.';
  writeFileSync(JSON_PATH, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, JSON_PATH)}`);
} else {
  console.log('(dry-run) 적용: node scripts/prune-redundant-verbal-tails.mjs --apply');
}
