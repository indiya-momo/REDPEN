/**
 * 예외 어절을 Kiwi·휴리스틱으로 분류 — 이동/삭제 후보 산출.
 * node scripts/audit-unify-noise-exceptions.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src/data/unify-noise-list.json');

const VERBAL_TAIL_HARVEST_BLOCKLIST = new Set(['대한', '고서']);

function hangulOnly(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

function extractTail(tokens) {
  if (!tokens?.length) return null;
  const tagBase = (tag) => String(tag ?? '').split('-')[0];
  const join = (from, to) =>
    tokens
      .slice(from, to)
      .map((t) => String(t.str ?? ''))
      .join('')
      .normalize('NFC');

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const a = tagBase(tokens[i].tag);
    const b = tagBase(tokens[i + 1].tag);
    if (a === 'VCP' && (b === 'EF' || b === 'EC')) {
      let end = i + 2;
      while (end < tokens.length && tagBase(tokens[end].tag).startsWith('E')) {
        end += 1;
      }
      const tail = join(i, end);
      if (tail.length >= 2) return { kind: 'copula', tail, tokens };
    }
  }

  let verbalIdx = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tagBase(tokens[i].tag);
    if (t === 'VV' || t === 'VA' || t === 'VX' || t === 'XSV' || t === 'XSA') {
      verbalIdx = i;
      break;
    }
  }
  if (verbalIdx >= 0) {
    let end = verbalIdx + 1;
    while (end < tokens.length && tagBase(tokens[end].tag).startsWith('E')) {
      end += 1;
    }
    // include ETM etc.
    while (
      end < tokens.length &&
      /^(E|VCP)/.test(tagBase(tokens[end].tag))
    ) {
      end += 1;
    }
    const tail = join(verbalIdx, end);
    // Prefer full surface if analysis is mostly verbal
    const full = join(0, tokens.length);
    const used =
      verbalIdx === 0 || hangulOnly(full) === hangulOnly(tail)
        ? full.length >= 2
          ? full
          : tail
        : tail;
    if (used.length >= 2) return { kind: 'verbal', tail: hangulOnly(used), tokens };
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (tagBase(tokens[i].tag) === 'JC' && String(tokens[i].str) === '하고') {
      return { kind: 'hagoJc', tail: '하고', tokens };
    }
  }
  return null;
}

function summarizeTags(tokens) {
  return (tokens ?? [])
    .map((t) => `${t.str}/${String(t.tag ?? '').split('-')[0]}`)
    .join('+');
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const exceptions = (raw.exceptionEojeols ?? []).map(hangulOnly).filter(Boolean);
  const verbalSet = new Set((raw.verbalTails ?? []).map(hangulOnly));
  const copulaSet = new Set((raw.copulaTails ?? []).map(hangulOnly));

  const { loadKiwiNode, resolveKiwiNodePaths } = await import(
    pathToFileURL(path.join(root, 'src/lib/kiwiMorph/loadNode.js')).href
  );
  const { analyzeLine } = await import(
    pathToFileURL(path.join(root, 'src/lib/kiwiMorph/analyze.js')).href
  );
  const {
    isSpacedLeftJosaNoiseEojeol,
  } = await import(
    pathToFileURL(
      path.join(root, 'src/lib/unifyNoiseListLeftHeuristic.js'),
    ).href
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

  const { ready } = resolveKiwiNodePaths(root);
  if (!ready) {
    console.error('Kiwi 모델 없음');
    process.exit(1);
  }
  const kiwi = await loadKiwiNode({ rootDir: root });

  /** @type {Record<string, any[]>} */
  const buckets = {
    removeHeuristic: [],
    moveVerbalTail: [],
    moveCopulaTail: [],
    keepException: [],
    blocked: [],
    alreadyInTails: [],
  };

  for (const ex of exceptions) {
    const heur = coveredByHeuristic(ex);
    if (heur) {
      buckets.removeHeuristic.push({ ex, heur });
      continue;
    }
    if (verbalSet.has(ex) || [...verbalSet].some((t) => ex.endsWith(t) && ex.length > t.length && hangulOnly(ex.slice(0, -t.length)).length >= 1 && t.length >= 2)) {
      // exact in verbal already?
      if (verbalSet.has(ex)) {
        buckets.alreadyInTails.push({ ex, kind: 'verbal' });
        continue;
      }
    }
    if (copulaSet.has(ex)) {
      buckets.alreadyInTails.push({ ex, kind: 'copula' });
      continue;
    }

    const analyzed = analyzeLine(ex, { kiwi });
    const tokens = analyzed?.tokens ?? [];
    const tags = summarizeTags(tokens);
    const hit = extractTail(tokens);
    const tagBases = tokens.map((t) => String(t.tag ?? '').split('-')[0]);

    // Pure adverb / determiner / interjection / noun → keep exception
    const onlyFunc =
      tokens.length >= 1 &&
      tokens.every((t) =>
        /^(MAG|MAJ|MM|IC|J|XPN|XSN|NNB|NP)/.test(
          String(t.tag ?? '').split('-')[0],
        ),
      );

    if (VERBAL_TAIL_HARVEST_BLOCKLIST.has(ex)) {
      buckets.blocked.push({ ex, tags });
      continue;
    }

    if (hit && (hit.kind === 'verbal' || hit.kind === 'copula')) {
      const tail = hangulOnly(hit.tail);
      // Short colliding tails — keep as exception surface instead of generalizing short stem
      const shortRisky =
        tail.length <= 2 ||
        VERBAL_TAIL_HARVEST_BLOCKLIST.has(tail) ||
        // whole-surface harvest as closed verbalTail (preferred over short stem)
        true;

      // Prefer adding full exception surface as verbalTail (closed) when analysis is verbal
      const surfaceIsVerbal =
        tagBases.some((t) => /^(VV|VA|VX|XSV|XSA)/.test(t)) &&
        !tagBases.every((t) => /^(N|MM|MAG|MAJ|IC)/.test(t));

      if (surfaceIsVerbal && ex.length >= 2) {
        // Check noun collision risk for short endings if we only add short tail
        const useTail = hangulOnly(hit.tail) === ex ? ex : ex;
        buckets.moveVerbalTail.push({
          ex,
          tail: useTail,
          extracted: tail,
          tags,
          kind: hit.kind,
        });
        continue;
      }
      if (hit.kind === 'copula') {
        buckets.moveCopulaTail.push({ ex, tail, tags });
        continue;
      }
    }

    if (onlyFunc) {
      buckets.keepException.push({ ex, tags, reason: 'func' });
      continue;
    }

    // VV+ETM etc. without extractTail hit
    if (tagBases.some((t) => /^(VV|VA|VX|XSV|XSA)/.test(t))) {
      buckets.moveVerbalTail.push({
        ex,
        tail: ex,
        extracted: hit?.tail ?? '',
        tags,
        kind: 'verbal-fallback',
      });
      continue;
    }

    buckets.keepException.push({
      ex,
      tags,
      reason: 'other',
    });
  }

  const out = {
    counts: Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => [k, v.length]),
    ),
    ...buckets,
  };
  const outPath = path.join(root, 'tmp/noise-exception-audit.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out.counts, null, 2));
  console.log('wrote', outPath);
  console.log(
    'removeHeuristic sample',
    buckets.removeHeuristic.slice(0, 15).map((x) => `${x.ex}(${x.heur})`),
  );
  console.log(
    'moveVerbalTail sample',
    buckets.moveVerbalTail.slice(0, 20).map((x) => `${x.ex}←${x.tags}`),
  );
  console.log(
    'keepException sample',
    buckets.keepException.slice(0, 20).map((x) => `${x.ex}←${x.tags}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
