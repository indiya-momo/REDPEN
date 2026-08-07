/**
 * 표기통일 잡음 1차 리스트 — 구글 시트 / CSV / 엑셀 → unify-noise-list.json
 *
 * 탭(기본 `unify_noise_list`) 열:
 *   kind | surface | kiwi_pattern | kiwi_morph | kiwi_role | note | enabled
 *
 * kind:
 *   exception  → exceptionEojeols
 *   verbal     → verbalTails  (별칭: verbalTail, verbalTails)
 *   copula     → copulaTails
 *   hagoJc     → hagoJcTails
 *
 * kiwi_* 열은 참고용(export가 채움). sync 시 kind·surface·enabled만 반영.
 * enabled: 비우면 Y. false/0/n 이면 제외.
 * bonBojoRefs·tagTemplates 는 JSON에 있던 값을 유지한다.
 *
 *   npm run sync-unify-noise-list
 *   npm run sync-unify-noise-list -- --csv=path/to.csv
 *   npm run sync-unify-noise-list -- --xlsx=path/to.xlsx
 *   SPREADSHEET_ID=… UNIFY_NOISE_SHEET=unify_noise_list npm run sync-unify-noise-list
 *
 * @see .cursor/rules/unify-noise-list.mdc
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchSheetRows,
  loadDotEnv,
  parseCsv,
  parseEnabled,
  rowsToObjects,
} from './sheet-csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'src/data/unify-noise-list.json');

const KIND_TO_BUCKET = Object.freeze({
  exception: 'exceptionEojeols',
  exceptioneojeol: 'exceptionEojeols',
  exceptioneojeols: 'exceptionEojeols',
  verbal: 'verbalTails',
  verbaltail: 'verbalTails',
  verbaltails: 'verbalTails',
  copula: 'copulaTails',
  copulatail: 'copulaTails',
  copulatails: 'copulaTails',
  hagojc: 'hagoJcTails',
  hagotail: 'hagoJcTails',
  hagojctails: 'hagoJcTails',
});

function hangulOnly(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/gu, '');
}

function sortExceptions(set) {
  return [...set].toSorted((a, b) => a.localeCompare(b, 'ko'));
}

function sortTails(set) {
  return [...set].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
}

function spreadsheetIdFromArg(arg) {
  const trimmed = String(arg || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('--id=')) return trimmed.slice(5).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

function argValue(prefix) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

/**
 * enabled 열 — 비우면 포함(true). caution sync와 달리 기본 ON.
 * @param {string | undefined} value
 */
function parseRowEnabled(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  return parseEnabled(raw);
}

/**
 * @param {Record<string, string>[]} rows
 */
function bucketsFromRows(rows) {
  /** @type {Record<string, Set<string>>} */
  const buckets = {
    exceptionEojeols: new Set(),
    verbalTails: new Set(),
    copulaTails: new Set(),
    hagoJcTails: new Set(),
  };
  let skipped = 0;
  let disabled = 0;
  let unknownKind = 0;

  for (const row of rows) {
    const kindRaw = String(row.kind ?? row.type ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_\s-]+/g, '');
    const bucket = KIND_TO_BUCKET[kindRaw];
    if (!bucket) {
      unknownKind += 1;
      continue;
    }
    if (!parseRowEnabled(row.enabled ?? row.active)) {
      disabled += 1;
      continue;
    }
    const surface = hangulOnly(row.surface ?? row.eojeol ?? row.word ?? '');
    if (!surface) {
      skipped += 1;
      continue;
    }
    if (bucket !== 'exceptionEojeols' && surface.length < 2) {
      skipped += 1;
      continue;
    }
    buckets[bucket].add(surface);
  }

  return { buckets, skipped, disabled, unknownKind };
}

/**
 * @param {string} xlsxPath
 * @returns {Promise<Record<string, string>[]>}
 */
async function rowsFromXlsx(xlsxPath) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws =
    wb.getWorksheet('unify_noise_list') ||
    wb.worksheets.find((s) => /noise|잡음/i.test(s.name)) ||
    wb.worksheets[0];
  if (!ws) throw new Error(`엑셀에 시트가 없습니다: ${xlsxPath}`);

  /** @type {string[][]} */
  const matrix = [];
  ws.eachRow((row) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cell.text != null ? String(cell.text) : '';
    });
    matrix.push(values.map((v) => String(v ?? '').trim()));
  });
  return rowsToObjects(matrix);
}

await loadDotEnv();

const cliId = process.argv
  .slice(2)
  .map(spreadsheetIdFromArg)
  .find((id) => id.length > 10);
if (cliId) process.env.SPREADSHEET_ID = cliId;

const SPREADSHEET_ID = process.env.SPREADSHEET_ID?.trim();
const SHEET_NAME = process.env.UNIFY_NOISE_SHEET || 'unify_noise_list';
const SHEET_GID = process.env.UNIFY_NOISE_GID?.trim();
const csvArg = argValue('--csv=');
const xlsxArg = argValue('--xlsx=');

async function loadRows() {
  if (xlsxArg) {
    const p = path.resolve(ROOT, xlsxArg);
    console.log(`엑셀: ${p}`);
    return rowsFromXlsx(p);
  }
  if (csvArg) {
    const p = path.resolve(ROOT, csvArg);
    console.log(`CSV: ${p}`);
    return rowsToObjects(parseCsv(await readFile(p, 'utf8')));
  }
  if (!SPREADSHEET_ID) {
    throw new Error(
      '입력이 없습니다. --xlsx= / --csv= 또는 .env SPREADSHEET_ID 를 넣으세요.',
    );
  }
  const tab = SHEET_GID ? `gid=${SHEET_GID}` : `sheet=${SHEET_NAME}`;
  console.log(
    `시트: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit (${tab})`,
  );
  return fetchSheetRows({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    sheetGid: SHEET_GID,
  });
}

const existing = JSON.parse(await readFile(JSON_PATH, 'utf8'));
const rows = await loadRows();
if (!rows.length) {
  throw new Error(
    '유효한 행이 없습니다. 첫 행 헤더에 kind | surface | enabled 가 있는지 확인하세요. (kiwi_* 는 참고용)',
  );
}

const { buckets, skipped, disabled, unknownKind } = bucketsFromRows(rows);
const exceptionEojeols = sortExceptions(buckets.exceptionEojeols);
const verbalTails = sortTails(buckets.verbalTails);
const copulaTails = sortTails(buckets.copulaTails);
const hagoJcTails = sortTails(buckets.hagoJcTails);

if (exceptionEojeols.length < 10) {
  throw new Error(
    `exception 행이 너무 적습니다 (${exceptionEojeols.length}). 잘못된 탭·필터를 의심하세요.`,
  );
}

const today = new Date().toISOString().slice(0, 10);
const next = {
  ...existing,
  updatedAt: today,
  harvestNote: `npm run sync-unify-noise-list — 시트/엑셀 동기화 (${today})`,
  exceptionEojeols,
  verbalTails,
  copulaTails,
  hagoJcTails,
  bonBojoRefs: existing.bonBojoRefs,
  tagTemplates: existing.tagTemplates,
};

await writeFile(JSON_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

console.log(
  [
    `wrote ${path.relative(ROOT, JSON_PATH)}`,
    `exception ${exceptionEojeols.length}`,
    `verbalTails ${verbalTails.length}`,
    `copulaTails ${copulaTails.length}`,
    `hagoJc ${hagoJcTails.length}`,
    disabled ? `disabled ${disabled}` : '',
    skipped ? `skipped ${skipped}` : '',
    unknownKind ? `unknownKind ${unknownKind}` : '',
  ]
    .filter(Boolean)
    .join(' · '),
);
console.log('이어서: npx vitest run src/lib/unifyNoiseList.test.js src/lib/unifyNoiseRegressionCorpus.test.js');
