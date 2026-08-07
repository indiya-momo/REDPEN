/**
 * Apply audit: heuristic-redundant exceptions 제거, 용언 표면 → verbalTails 이동.
 * node scripts/apply-noise-exception-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src/data/unify-noise-list.json');
const auditPath = path.join(root, 'tmp/noise-exception-audit.json');

function hangulOnly(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

function sortKo(arr) {
  return [...arr].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
}

function sortExc(arr) {
  return [...arr].toSorted((a, b) => a.localeCompare(b, 'ko'));
}

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const remove = new Set(
  audit.removeHeuristic.map((x) => hangulOnly(x.ex)).filter(Boolean),
);
const move = new Set(
  audit.moveVerbalTail.map((x) => hangulOnly(x.tail || x.ex)).filter(Boolean),
);

const beforeExc = raw.exceptionEojeols.length;
const beforeVerbal = raw.verbalTails.length;

const exceptions = raw.exceptionEojeols
  .map(hangulOnly)
  .filter(Boolean)
  .filter((e) => !remove.has(e) && !move.has(e));

const verbal = new Set(raw.verbalTails.map(hangulOnly).filter(Boolean));
for (const t of move) {
  if (t.length < 2) continue;
  verbal.add(t);
}

raw.exceptionEojeols = sortExc(exceptions);
raw.verbalTails = sortKo([...verbal]);
raw.updatedAt = new Date().toISOString().slice(0, 10);
raw.harvestNote =
  'npm run kiwi:harvest-noise-list — 예외·꼬리 갱신. 2026-08-07 형태소 감사로 용언 표면은 verbalTails로 이동';

fs.writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log({
  beforeExc,
  afterExc: raw.exceptionEojeols.length,
  removedHeuristic: remove.size,
  movedToVerbal: move.size,
  beforeVerbal,
  afterVerbal: raw.verbalTails.length,
});
