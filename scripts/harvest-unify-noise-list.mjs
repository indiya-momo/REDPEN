/**
 * 표기통일 잡음 1차 리스트 수확 — 예외 어절 + 패턴 꼬리(명사 어간 제외).
 * 런타임에 휴리스틱을 늘리기 전에 여기로 표면을 넣는 것이 기본 경로.
 *
 *   npm run kiwi:harvest-noise-list
 *   npm run kiwi:harvest-noise-list -- 가정하고 가치있다고
 *   npm run kiwi:harvest-noise-list -- --add 대부분
 *
 * @see .cursor/rules/unify-noise-list.mdc
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src/data/unify-noise-list.json');

const DEFAULT_SURFACES = [
  '가정하고',
  '예측하고',
  '환경하고',
  '기록하여',
  '기록하다',
  '기록하라',
  '상환하기',
  '규제하려',
  '가치있다고',
  '구성되며',
  '것이고',
  '경제다',
  '학생이며',
  // 세션 수확 후보 (런타임 휴리스틱 대신 꼬리 JSON으로)
  '담당하던',
  '광고니까',
  '결혼하고자',
  '결혼하려고',
  '결혼하였고',
  '결혼했어',
  '들어서',
];

const DEFAULT_EXCEPTION_SPACED = [
  '대부분 공무원',
  '일부 시장',
  '상당수 시장',
  '전체 시장',
  '다수 시장',
  '소수 시장',
  '나머지 시장',
  '정도 시장',
  '기타 시장',
  '가족 모두',
  '가족 끼리',
  '결혼 직전',
  '등이 공무원',
];

function hangulOnly(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

function sortTails(set) {
  return [...set].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
}

function parseArgs(argv) {
  /** @type {string[]} */
  const surfaces = [];
  /** @type {string[]} */
  const manualAdd = [];
  let mode = 'surface';
  for (const a of argv) {
    if (a === '--add') {
      mode = 'add';
      continue;
    }
    if (a.startsWith('-')) continue;
    if (mode === 'add') manualAdd.push(a);
    else surfaces.push(hangulOnly(a));
  }
  return {
    surfaces: surfaces.filter((s) => s.length >= 3),
    manualAdd: manualAdd.map(hangulOnly).filter(Boolean),
  };
}

/**
 * 수확 스크립트 전용 — 브라우저 번들 비포함.
 * @param {{ str?: string, tag?: string }[]} tokens
 */
function extractTail(tokens) {
  if (!tokens?.length) return null;
  const tagBase = (tag) => String(tag ?? '').split('-')[0];
  const isJosa = (tag) => tagBase(tag).startsWith('J');
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
      if (tail.length >= 2) return { kind: 'copula', tail };
    }
  }

  let verbalIdx = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const base = tagBase(tokens[i].tag);
    if (base === 'XSV' || base === 'VV' || base === 'VX') {
      verbalIdx = i;
      break;
    }
  }
  if (verbalIdx > 0) {
    let end = verbalIdx + 1;
    while (end < tokens.length && tagBase(tokens[end].tag).startsWith('E')) {
      end += 1;
    }
    const tail = join(verbalIdx, end);
    if (tail.length >= 2) return { kind: 'verbal', tail };
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (tagBase(tokens[i].tag) === 'JC' && String(tokens[i].str) === '하고') {
      return { kind: 'hagoJc', tail: '하고' };
    }
  }
  void isJosa;
  return null;
}

async function main() {
  const { surfaces: cliSurfaces, manualAdd } = parseArgs(process.argv.slice(2));
  const surfaces = cliSurfaces.length ? cliSurfaces : DEFAULT_SURFACES;
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const exceptions = new Set(
    (raw.exceptionEojeols ?? []).map(hangulOnly).filter(Boolean),
  );
  const verbal = new Set((raw.verbalTails ?? []).map(hangulOnly).filter(Boolean));
  const copula = new Set((raw.copulaTails ?? []).map(hangulOnly).filter(Boolean));
  const hagoJc = new Set((raw.hagoJcTails ?? []).map(hangulOnly).filter(Boolean));

  for (const e of manualAdd) {
    exceptions.add(e);
    console.log(`[exception] --add ${e}`);
  }

  const loadNodeUrl = pathToFileURL(
    path.join(root, 'src/lib/kiwiMorph/loadNode.js'),
  ).href;
  const analyzeUrl = pathToFileURL(
    path.join(root, 'src/lib/kiwiMorph/analyze.js'),
  ).href;
  const excludeUrl = pathToFileURL(
    path.join(root, 'src/lib/kiwiMorph/unifyExclude.js'),
  ).href;

  const { loadKiwiNode, resolveKiwiNodePaths } = await import(loadNodeUrl);
  const { ready } = resolveKiwiNodePaths(root);

  if (!ready) {
    console.warn('[harvest] Kiwi 모델 없음 — --add / 기존 JSON만 유지.');
  } else {
    const kiwi = await loadKiwiNode({ rootDir: root });
    if (kiwi) {
      const { analyzeLine } = await import(analyzeUrl);
      const exclude = await import(excludeUrl);
      for (const surface of surfaces) {
        const analyzed = analyzeLine(surface, { kiwi });
        const hit = extractTail(analyzed?.tokens ?? []);
        if (!hit) {
          console.log(`[miss] ${surface}`);
          continue;
        }
        const tail = hangulOnly(hit.tail);
        if (tail.length < 2) continue;
        const bucket =
          hit.kind === 'copula' ? copula : hit.kind === 'hagoJc' ? hagoJc : verbal;
        const before = bucket.has(tail);
        bucket.add(tail);
        console.log(`[${hit.kind}] ${surface} → ${tail}${before ? '' : ' +'}`);
      }

      for (const pair of DEFAULT_EXCEPTION_SPACED) {
        const left = hangulOnly(pair.split(/\s+/)[0]);
        if (!left || exceptions.has(left)) continue;
        const opts = { kiwi };
        if (exclude.isKiwiNounVerbalConnectiveSurface?.(left, opts)) continue;
        if (exclude.isKiwiCopulaEndingSurface?.(left, opts)) continue;
        if (
          exclude.classifyKiwiSpacedEojeolPos?.(left, opts) === 'noun' &&
          !exclude.isKiwiNounCompoundEojeol?.(left, opts)
        ) {
          exceptions.add(left);
          console.log(`[exception] ${left} ← ${pair}`);
        }
      }
    }
  }

  const next = {
    version: Number(raw.version) || 1,
    updatedAt: new Date().toISOString().slice(0, 10),
    description: raw.description,
    harvestNote: raw.harvestNote,
    exceptionEojeols: [...exceptions].toSorted((a, b) => a.localeCompare(b, 'ko')),
    exceptionNote: raw.exceptionNote,
    verbalTails: sortTails(verbal),
    copulaTails: sortTails(copula),
    hagoJcTails: sortTails(hagoJc),
    bonBojoRefs: Array.isArray(raw.bonBojoRefs) ? raw.bonBojoRefs : [],
    tagTemplates: Array.isArray(raw.tagTemplates) ? raw.tagTemplates : [],
  };
  fs.writeFileSync(jsonPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(
    `[harvest] exceptions=${next.exceptionEojeols.length} verbal=${next.verbalTails.length} copula=${next.copulaTails.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
