/**
 * 예외 재검토 적용 — 휴리스틱 중복 제거 + 용언 표면 verbalTails 이동.
 * node scripts/apply-noise-exception-recheck.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src/data/unify-noise-list.json');

function hangulOnly(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

function sortExc(arr) {
  return [...arr].toSorted((a, b) => a.localeCompare(b, 'ko'));
}

function sortKo(arr) {
  return [...arr].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
}

/** Kiwi·수동 — 예외에서 verbalTails로 (닫힌 표면) */
const MOVE_TO_VERBAL = [
  '는다',
  '었고',
  '아닌',
  '개인적',
  '려준',
  '으킨',
  '라고',
];

async function main() {
  const {
    isSpacedLeftJosaNoiseEojeol,
  } = await import(
    pathToFileURL(path.join(root, 'src/lib/unifyNoiseListLeftHeuristic.js'))
      .href
  );
  const { isSpacedLeftAdnominalNoiseEojeol } = await import(
    pathToFileURL(
      path.join(root, 'src/lib/unifyNoiseListAdnominalHeuristic.js'),
    ).href
  );
  const {
    isSpacedClosedConjunctionNoiseEojeol,
    isSpacedClosedVerbalNoiseEojeol,
    isSpacedAdverbHiNoiseEojeol,
    isSpacedAdverbGeNoiseEojeol,
    isSpacedVerbalConnectiveNoiseEojeol,
    isSpacedDependentSuffixNoiseEojeol,
  } = await import(
    pathToFileURL(
      path.join(root, 'src/lib/unifyNoiseListLexicalHeuristic.js'),
    ).href
  );

  function coveredByHeuristic(h) {
    if (isSpacedLeftJosaNoiseEojeol(h)) return 'josa';
    if (isSpacedLeftAdnominalNoiseEojeol(h)) return 'adnominal';
    if (isSpacedClosedConjunctionNoiseEojeol(h)) return 'conjunction';
    if (isSpacedClosedVerbalNoiseEojeol(h)) return 'closedVerbal';
    if (isSpacedAdverbHiNoiseEojeol(h)) return 'adverbHi';
    if (isSpacedAdverbGeNoiseEojeol(h)) return 'adverbGe';
    if (isSpacedVerbalConnectiveNoiseEojeol(h)) return 'verbalConnective';
    if (isSpacedDependentSuffixNoiseEojeol(h)) return 'dependentSuffix';
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const beforeExc = raw.exceptionEojeols.length;
  const beforeVt = raw.verbalTails.length;

  const verbal = new Set(raw.verbalTails.map(hangulOnly).filter(Boolean));
  const removed = [];
  const moved = [];
  const kept = [];

  for (const w of MOVE_TO_VERBAL) {
    const h = hangulOnly(w);
    if (h.length >= 2) {
      verbal.add(h);
      moved.push(h);
    }
  }

  for (const ex of raw.exceptionEojeols.map(hangulOnly).filter(Boolean)) {
    if (MOVE_TO_VERBAL.includes(ex)) {
      removed.push({ ex, why: 'moveVerbal' });
      continue;
    }
    const heur = coveredByHeuristic(ex);
    if (heur) {
      removed.push({ ex, why: heur });
      continue;
    }
    if (verbal.has(ex)) {
      removed.push({ ex, why: 'alreadyVerbalTail' });
      continue;
    }
    kept.push(ex);
  }

  raw.exceptionEojeols = sortExc(kept);
  raw.verbalTails = sortKo([...verbal]);
  raw.updatedAt = new Date().toISOString().slice(0, 10);
  raw.harvestNote =
    'npm run kiwi:harvest-noise-list — 예외·꼬리 갱신. 2026-08-07 예외 재검토: 의≥1·용언꼬리 완전일치·용언 표면→verbalTails';

  fs.writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

  const byWhy = {};
  for (const r of removed) {
    (byWhy[r.why] = byWhy[r.why] || []).push(r.ex);
  }
  console.log(
    JSON.stringify(
      {
        beforeExc,
        afterExc: raw.exceptionEojeols.length,
        beforeVt,
        afterVt: raw.verbalTails.length,
        removed: removed.length,
        movedToVerbal: moved,
        removedByWhy: Object.fromEntries(
          Object.entries(byWhy).map(([k, v]) => [k, v.length]),
        ),
        removedSamples: byWhy,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
