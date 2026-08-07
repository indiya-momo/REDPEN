/**
 * unify-noise-list.json → 편집용 엑셀/CSV (구글 시트에 붙여넣기·업로드용)
 *
 *   npm run export-unify-noise-list-sheet
 *   npm run export-unify-noise-list-sheet -- --out=tmp/noise.xlsx
 *   npm run export-unify-noise-list-sheet -- --csv=tmp/noise.csv
 *   npm run export-unify-noise-list-sheet -- --no-kiwi   # 형태소 열 비움(빠름)
 *
 * 열:
 *   kind | surface | kiwi_pattern | kiwi_morph | kiwi_role | note | enabled
 *
 * - kiwi_pattern: 이 kind가 가리키는 Kiwi/tagTemplates 패턴(kind 공통)
 * - kiwi_morph: 실제 Kiwi 분석 (형태/태그+…) — 모델 있을 때만
 * - kiwi_role: 이 행 morph를 한글 태그로 풀어쓴 설명 + kind와의 일치/불일치
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/unify-noise-list.json');
const DEFAULT_XLSX = path.join(
  ROOT,
  'project-docs',
  'unify-noise-list-sheet.xlsx',
);

/** kind → JSON tagTemplates / 수확 기준 패턴 (kiwi_pattern 열) */
const KIND_KIWI = Object.freeze({
  exception: {
    pattern: '(닫힌 표면·예외 Set) — 단일 어절 완전일치',
    roleFallback:
      '띄움 복합 성분이 아닌 어절. morph 없음(--no-kiwi 또는 모델 부재)',
  },
  verbal: {
    pattern: 'NNG+(XSV|VV|VX)+E* 꼬리 · 또는 닫힌 VV/VA/VX/XSV/XSA(+E*) 표면',
    roleFallback: '용언 꼬리(verbalTails). morph 없음',
  },
  copula: {
    pattern: 'N*+VCP+(EF|EC)',
    roleFallback: '이다(VCP) 꼬리(copulaTails). morph 없음',
  },
  hagoJc: {
    pattern: 'NNG+하고/JC',
    roleFallback: '하고/JC 꼬리. morph 없음',
  },
});

/** Kiwi 태그 base → 짧은 한글 이름 */
const TAG_KO = Object.freeze({
  NNG: '일반명사',
  NNP: '고유명사',
  NP: '대명사',
  NNB: '의존명사',
  NR: '수사',
  MM: '관형사',
  MAG: '일반부사',
  MAJ: '접속부사',
  VV: '동사',
  VA: '형용사',
  VX: '보조용언',
  XSV: '동사파생접미',
  XSA: '형용사파생접미',
  VCP: '이다',
  VCN: '부정계사',
  EC: '연결어미',
  EF: '종결어미',
  ETM: '관형형어미',
  EP: '선어말어미',
  ETN: '명사형전성어미',
  JC: '접속조사',
  JKS: '주격조사',
  JKO: '목적격조사',
  JKB: '부사격조사',
  JKV: '호격조사',
  JKQ: '인용격조사',
  JX: '보조사',
  XPN: '체언접두사',
  XSN: '명사파생접미',
  SF: '마침표',
  SP: '쉼표',
  SS: '따옴표',
  SE: '줄임표',
  SO: '붙임표',
  SW: '기타기호',
  SL: '외국어',
  SH: '한자',
  SN: '숫자',
  UN: '분석불가',
  W_SERIAL: '일련번호',
});

function tagBase(tag) {
  return String(tag ?? '').split('-')[0];
}

/**
 * @param {{ str?: string, tag?: string }[]} tokens
 * @returns {'vcp'|'vcn'|'verbal'|'hagoJc'|'adverb'|'nominal'|'derived'|'josa'|'ending'|'other'}
 */
function morphFamily(tokens) {
  const tags = (tokens ?? []).map((t) => tagBase(t.tag));
  if (tags.includes('VCN')) return 'vcn';
  if (tags.includes('VCP')) return 'vcp';
  if (
    tags.some((t) =>
      t === 'XSV' || t === 'VV' || t === 'VX' || t === 'VA' || t === 'XSA',
    )
  ) {
    return 'verbal';
  }
  if (
    tags.includes('JC') &&
    (tokens ?? []).some((t) => String(t.str) === '하고')
  ) {
    return 'hagoJc';
  }
  if (tags.includes('XSN') || tags.includes('XPN')) return 'derived';
  if (tags.every((t) => t === 'MAG' || t === 'MAJ')) return 'adverb';
  if (tags.every((t) => t.startsWith('N') || t === 'MM' || t === 'NR')) {
    return 'nominal';
  }
  if (tags.every((t) => t.startsWith('J'))) return 'josa';
  if (tags.every((t) => t.startsWith('E'))) return 'ending';
  return 'other';
}

const FAMILY_KO = Object.freeze({
  vcp: '이다(VCP)',
  vcn: '아니다(VCN)',
  verbal: '용언(VV/VA/VX/XS*)',
  hagoJc: '하고/JC',
  adverb: '부사',
  nominal: '체언·관형',
  derived: '체언파생(XPN/XSN)',
  josa: '조사',
  ending: '어미만',
  other: '기타',
});

/**
 * morph 토큰 → kiwi_role (행별 구체 설명)
 * @param {string} kind
 * @param {{ str?: string, tag?: string }[] | null | undefined} tokens
 */
function describeKiwiRole(kind, tokens) {
  const fallback = KIND_KIWI[kind]?.roleFallback ?? '';
  if (!tokens?.length) return fallback;

  const chain = tokens
    .map((t) => {
      const b = tagBase(t.tag);
      return `${TAG_KO[b] ?? b}(${b})`;
    })
    .join('+');

  const family = morphFamily(tokens);
  const famKo = FAMILY_KO[family] ?? family;

  /** @type {string} */
  let vs;
  if (kind === 'copula') {
    if (family === 'vcp') vs = 'kind=copula와 일치(이다/VCP)';
    else if (family === 'vcn') {
      vs = 'kind=copula이나 morph는 부정계사(VCN) — 이다(VCP) 아님';
    } else {
      vs = `kind=copula이나 morph는 ${famKo} — 이다(VCP) 아님`;
    }
  } else if (kind === 'verbal') {
    if (family === 'verbal') vs = 'kind=verbal과 일치(용언 꼬리)';
    else vs = `kind=verbal이나 morph는 ${famKo}`;
  } else if (kind === 'hagoJc') {
    if (family === 'hagoJc') vs = 'kind=hagoJc와 일치';
    else vs = `kind=hagoJc이나 morph는 ${famKo}`;
  } else if (kind === 'exception') {
    vs = '예외 Set 완전일치 DROP';
    if (family === 'vcp' || family === 'vcn' || family === 'verbal') {
      vs += ` · morph는 ${famKo}(꼬리 버킷 후보)`;
    } else {
      vs += ` · morph=${famKo}`;
    }
  } else {
    vs = `kind=${kind} · morph=${famKo}`;
  }

  return `${chain} · ${vs}`;
}

const HEADERS = [
  'kind',
  'surface',
  'kiwi_pattern',
  'kiwi_morph',
  'kiwi_role',
  'note',
  'enabled',
];

function argValue(prefix) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function csvEscape(cell) {
  const s = String(cell ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {{ str?: string, tag?: string }[]} tokens
 */
function summarizeMorph(tokens) {
  return (tokens ?? [])
    .map((t) => `${t.str}/${String(t.tag ?? '').split('-')[0]}`)
    .join('+');
}

/**
 * @returns {Promise<((surface: string) => { morph: string, tokens: { str?: string, tag?: string }[] }) | null>}
 */
async function loadMorphLookup() {
  if (hasFlag('--no-kiwi')) {
    console.log('[export] --no-kiwi — kiwi_morph/role(morph) 열을 비웁니다.');
    return null;
  }
  try {
    const { loadKiwiNode, resolveKiwiNodePaths } = await import(
      pathToFileURL(path.join(ROOT, 'src/lib/kiwiMorph/loadNode.js')).href,
    );
    const { ready } = resolveKiwiNodePaths(ROOT);
    if (!ready) {
      console.warn('[export] Kiwi 모델 없음 — kiwi_morph 비움. (tmp/kiwi-models)');
      return null;
    }
    const kiwi = await loadKiwiNode({ rootDir: ROOT });
    if (!kiwi) {
      console.warn('[export] Kiwi load 실패 — kiwi_morph 비움.');
      return null;
    }
    const { analyzeLine } = await import(
      pathToFileURL(path.join(ROOT, 'src/lib/kiwiMorph/analyze.js')).href,
    );
    /** @type {Map<string, { morph: string, tokens: { str?: string, tag?: string }[] }>} */
    const cache = new Map();
    return (surface) => {
      const key = String(surface ?? '');
      if (cache.has(key)) return cache.get(key);
      const analyzed = analyzeLine(key, { kiwi });
      const tokens = analyzed?.tokens ?? [];
      const morph = summarizeMorph(tokens);
      const packed = { morph, tokens };
      cache.set(key, packed);
      return packed;
    };
  } catch (err) {
    console.warn(
      '[export] Kiwi 분석 생략:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * @param {Record<string, string>[]} rows
 */
function toCsv(rows) {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push(HEADERS.map((h) => csvEscape(r[h] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

const data = JSON.parse(await readFile(JSON_PATH, 'utf8'));
const morphOf = await loadMorphLookup();

/**
 * @param {string} kind
 * @param {string} surface
 */
function makeRow(kind, surface) {
  const meta = KIND_KIWI[kind] ?? { pattern: '', roleFallback: '' };
  const packed = morphOf ? morphOf(surface) : null;
  return {
    kind,
    surface,
    kiwi_pattern: meta.pattern,
    kiwi_morph: packed?.morph ?? '',
    kiwi_role: describeKiwiRole(kind, packed?.tokens),
    note: '',
    enabled: 'Y',
  };
}

/** @type {Record<string, string>[]} */
const rows = [];
for (const surface of data.exceptionEojeols ?? []) {
  rows.push(makeRow('exception', surface));
}
for (const surface of data.verbalTails ?? []) {
  rows.push(makeRow('verbal', surface));
}
for (const surface of data.copulaTails ?? []) {
  rows.push(makeRow('copula', surface));
}
for (const surface of data.hagoJcTails ?? []) {
  rows.push(makeRow('hagoJc', surface));
}

const withMorph = rows.filter((r) => r.kiwi_morph).length;
if (morphOf) {
  console.log(`[export] kiwi_morph ${withMorph}/${rows.length}`);
}

const csvOut = argValue('--csv=');
const xlsxOut = argValue('--out=') || (csvOut ? '' : DEFAULT_XLSX);

if (csvOut) {
  const p = path.resolve(ROOT, csvOut);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, toCsv(rows), 'utf8');
  console.log(`wrote ${path.relative(ROOT, p)} (${rows.length} rows)`);
}

if (xlsxOut) {
  const ExcelJS = (await import('exceljs')).default;
  const p = path.resolve(ROOT, xlsxOut);
  await mkdir(path.dirname(p), { recursive: true });
  const wb = new ExcelJS.Workbook();
  wb.creator = '인디야';
  const ws = wb.addWorksheet('unify_noise_list');
  ws.columns = [
    { header: 'kind', key: 'kind', width: 12 },
    { header: 'surface', key: 'surface', width: 18 },
    { header: 'kiwi_pattern', key: 'kiwi_pattern', width: 42 },
    { header: 'kiwi_morph', key: 'kiwi_morph', width: 36 },
    { header: 'kiwi_role', key: 'kiwi_role', width: 72 },
    { header: 'note', key: 'note', width: 28 },
    { header: 'enabled', key: 'enabled', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);

  const guide = wb.addWorksheet('_readme');
  guide.getColumn(1).width = 78;
  const guideLines = [
    '표기통일 잡음 1차 리스트 편집 시트',
    '',
    '【편집하는 열】 kind · surface · note · enabled',
    '【참고 열(sync 시 무시)】 kiwi_pattern · kiwi_morph · kiwi_role',
    '',
    'kiwi_role = 이 행의 morph를 한글 태그로 풀어쓴 것 + kind와의 일치/불일치',
    '  예) 부정계사(VCN)+연결어미(EC) · kind=copula이나 morph는 부정계사(VCN) — 이다(VCP) 아님',
    '  예) 이다(VCP)+연결어미(EC) · kind=copula와 일치(이다/VCP)',
    '',
    'kind',
    '  exception — 예외 어절 완전일치 (exceptionEojeols)',
    '  verbal    — 용언·하다 꼬리 (verbalTails) ≈ NNG+(XSV|VV|VX)+E*',
    '  copula    — 이다 꼬리 (copulaTails) ≈ N*+VCP+(EF|EC)',
    '  hagoJc    — 하고/JC (hagoJcTails)',
    '',
    'kiwi_morph 예: 대부분/MAG · 있/VV+다고/EC · 이/VCP+고/EC',
    '  → export 시 Kiwi 모델로 채움. 비어 있으면 npm run export… (모델: tmp/kiwi-models)',
    '  → --no-kiwi 로 형태소 없이 빠르게 뽑을 수 있음',
    '',
    '주요 태그(참고)',
    '  NNG 일반명사  NP 대명사  NNB 의존명사  MM 관형사  MAG 일반부사  MAJ 접속부사',
    '  VV/VA/VX 동사·형용사·보조용언  XSV/XSA 하다류 접미  VCP 이다',
    '  EC 연결어미  EF 종결어미  ETM 관형형어미  J* 조사',
    '',
    'sync: npm run sync-unify-noise-list [--xlsx=…]',
    '회귀: npx vitest run src/lib/unifyNoiseList.test.js src/lib/unifyNoiseRegressionCorpus.test.js',
  ];
  guideLines.forEach((line, i) => {
    guide.getCell(i + 1, 1).value = line;
  });

  const legend = wb.addWorksheet('_kiwi_legend');
  legend.columns = [
    { header: 'kind', key: 'kind', width: 12 },
    { header: 'json_field', key: 'json_field', width: 18 },
    { header: 'kiwi_pattern', key: 'kiwi_pattern', width: 48 },
    { header: 'tagTemplates_id', key: 'tagTemplates_id', width: 24 },
  ];
  legend.getRow(1).font = { bold: true };
  legend.addRow({
    kind: 'exception',
    json_field: 'exceptionEojeols',
    kiwi_pattern: KIND_KIWI.exception.pattern,
    tagTemplates_id: '(없음 — Set 완전일치)',
  });
  legend.addRow({
    kind: 'verbal',
    json_field: 'verbalTails',
    kiwi_pattern: KIND_KIWI.verbal.pattern,
    tagTemplates_id: 'noun-verbal-connective',
  });
  legend.addRow({
    kind: 'copula',
    json_field: 'copulaTails',
    kiwi_pattern: KIND_KIWI.copula.pattern,
    tagTemplates_id: 'copula-ending',
  });
  legend.addRow({
    kind: 'hagoJc',
    json_field: 'hagoJcTails',
    kiwi_pattern: KIND_KIWI.hagoJc.pattern,
    tagTemplates_id: 'noun-hago-jc',
  });

  await wb.xlsx.writeFile(p);
  console.log(`wrote ${path.relative(ROOT, p)} (${rows.length} rows)`);
}

if (!csvOut && !xlsxOut) {
  throw new Error('--csv= 또는 --out= 경로가 필요합니다.');
}
