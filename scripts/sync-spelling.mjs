/**
 * Google 시트 → 맞춤법 규칙 JSON
 *
 * 시트 탭 이름: spelling_rules
 * 컬럼: find | replace | enabled | tip | memo | counts_in_quota | visible | divider_group
 *
 * 사용:
 *   SPREADSHEET_ID=xxx npm run sync-spelling
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function loadDotEnv() {
  try {
    const text = await readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    /* .env 없음 */
  }
}

await loadDotEnv();

function spreadsheetIdFromArg(arg) {
  const trimmed = String(arg || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('--id=')) return trimmed.slice(5).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

const cliId = process.argv
  .slice(2)
  .map(spreadsheetIdFromArg)
  .find((id) => id.length > 10);

if (cliId) {
  process.env.SPREADSHEET_ID = cliId;
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID?.trim();
const SHEET_NAME = process.env.SPELLING_SHEET || 'spelling_rules';
const SHEET_GID = process.env.SPELLING_GID?.trim();

const OUTPUTS = [
  path.join(ROOT, 'src/data/spelling-rules.json'),
  path.join(ROOT, 'public/data/spelling-rules.json'),
];
const META_OUT = path.join(ROOT, 'public/data/spelling-rules-meta.json');

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim() !== ''));
}

function stripCellPrefix(value, prefix) {
  const v = String(value || '').trim();
  const lower = v.toLowerCase();
  if (lower.startsWith(prefix + ' ')) return v.slice(prefix.length + 1).trim();
  if (lower === prefix) return '';
  return v;
}

/** 시트 헤더 별칭 (한글·영문) */
const SPELLING_HEADER_ALIASES = {
  메모: 'memo',
};

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const firstCell = rows[0][0]?.trim().toLowerCase() ?? '';
  if (firstCell === 'find') {
    const [headers, ...dataRows] = rows;
    const cleanHeaders = headers.map((h) => {
      const key = h.trim().toLowerCase();
      return SPELLING_HEADER_ALIASES[key] ?? key;
    });

    return dataRows
      .map((row) =>
        cleanHeaders.reduce((obj, header, index) => {
          if (!header) return obj;
          obj[header] = (row[index] || '').trim();
          return obj;
        }, {}),
      )
      .filter((obj) => Object.values(obj).some((v) => v !== ''));
  }

  return rows
    .map((row) => ({
      find: stripCellPrefix(row[0], 'find'),
      replace: stripCellPrefix(row[1], 'replace'),
      enabled: (row[2] || 'true').trim(),
      tip: (row[3] || '').trim(),
      memo: (row[4] || '').trim(),
    }))
    .filter((obj) => obj.find || obj.replace);
}

function parseEnabled(value) {
  const v = String(value ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no' && v !== 'n';
}

function parseCountsInQuota(value) {
  const v = String(value ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no' && v !== 'n';
}

function parseVisible(value) {
  const v = String(value ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no' && v !== 'n';
}

function normalizeDividerGroup(value) {
  const v = String(value ?? '').trim();
  return v || undefined;
}

function expandBulkRow(
  find,
  replace,
  enabled,
  tip,
  memo,
  countsInQuota,
  visible,
  dividerGroup,
) {
  const findParts = find.split(/\s+/).filter(Boolean);
  const replaceParts = replace.split(/\s+/).filter(Boolean);
  if (findParts.length < 2 || findParts.length !== replaceParts.length) {
    return null;
  }
  return findParts.map((f, i) => ({
    find: f,
    replace: replaceParts[i],
    enabled,
    ...(tip ? { tip } : {}),
    ...(memo ? { memo } : {}),
    ...(countsInQuota === false ? { countsInQuota: false } : {}),
    ...(visible === false ? { visible: false } : {}),
    ...(dividerGroup ? { dividerGroup } : {}),
  }));
}

function normalizeRow(row) {
  const find = String(row.find || '').trim();
  const replace = String(row.replace || '').trim();
  if (!find || !replace) return null;
  if (find === replace) return null;

  const enabled = parseEnabled(row.enabled);
  const tip = String(row.tip || '').trim();
  const memo = String(row.memo || '').trim();
  const countsInQuota = parseCountsInQuota(row.counts_in_quota);
  const visible = parseVisible(row.visible);
  const dividerGroup = normalizeDividerGroup(row.divider_group);

  const bulk = expandBulkRow(
    find,
    replace,
    enabled,
    tip,
    memo,
    countsInQuota,
    visible,
    dividerGroup,
  );
  if (bulk) return bulk;

  if (find.split(/\s+/).length > 8) {
    return null;
  }

  return {
    find,
    replace,
    enabled,
    ...(tip ? { tip } : {}),
    ...(memo ? { memo } : {}),
    ...(countsInQuota === false ? { countsInQuota: false } : {}),
    ...(visible === false ? { visible: false } : {}),
    ...(dividerGroup ? { dividerGroup } : {}),
  };
}

async function fetchSheetCsv(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} fetch failed: ${response.status} ${response.statusText}`);
  }
  const csv = await response.text();
  if (csv.includes('<!DOCTYPE html>')) {
    throw new Error(
      `${label}: CSV 대신 HTML이 왔습니다. 시트를 「링크 있는 사용자 · 보기」로 공개했는지 확인하세요.`,
    );
  }
  return csv;
}

async function fetchSheet(sheetName) {
  if (!SPREADSHEET_ID) {
    throw new Error(
      'SPREADSHEET_ID가 없습니다. .env 또는 환경 변수에 시트 ID를 넣으세요.',
    );
  }

  const cacheBust = Date.now().toString();

  // 화면과 동일한 CSV (A2=과반수 이상 한 줄씩). gviz/tq는 여러 칸이 한 줄로 뭉개질 수 있음.
  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  exportUrl.searchParams.set('format', 'csv');
  if (SHEET_GID) {
    exportUrl.searchParams.set('gid', SHEET_GID);
  }
  exportUrl.searchParams.set('_', cacheBust);

  let csv;
  try {
    csv = await fetchSheetCsv(exportUrl.toString(), 'export');
  } catch (exportErr) {
    const gvizUrl = new URL(
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`,
    );
    gvizUrl.searchParams.set('tqx', 'out:csv');
    if (SHEET_GID) {
      gvizUrl.searchParams.set('gid', SHEET_GID);
    } else {
      gvizUrl.searchParams.set('sheet', sheetName);
    }
    gvizUrl.searchParams.set('_', cacheBust);
    console.warn(`export CSV 실패, gviz로 재시도: ${exportErr.message}`);
    csv = await fetchSheetCsv(gvizUrl.toString(), 'gviz');
  }

  return rowsToObjects(parseCsv(csv));
}

async function syncFromCsvFile(csvPath) {
  const csv = await readFile(csvPath, 'utf8');
  if (csv.includes('<!DOCTYPE html>')) {
    throw new Error('CSV 파일이 아닌 HTML입니다.');
  }
  return rowsToObjects(parseCsv(csv));
}

async function main() {
  const csvArg = process.argv.slice(2).find((a) => a.startsWith('--csv='));
  const rows = csvArg
    ? await syncFromCsvFile(path.resolve(ROOT, csvArg.slice(6)))
    : await (async () => {
        const tab = SHEET_GID ? `gid=${SHEET_GID}` : `sheet=${SHEET_NAME}`;
        console.log(`시트: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit (${tab})`);
        return fetchSheet(SHEET_NAME);
      })();
  const skippedBulk = rows.length;
  const rules = rows.flatMap((row) => {
    const normalized = normalizeRow(row);
    if (!normalized) return [];
    return Array.isArray(normalized) ? normalized : [normalized];
  });

  if (!rules.length) {
    throw new Error(
      `${SHEET_NAME} 탭에 유효한 행이 없습니다. find·replace 컬럼을 확인하세요.`,
    );
  }

  const json = `${JSON.stringify(rules, null, 2)}\n`;

  console.log(`CSV ${skippedBulk}행 → 규칙 ${rules.length}개 (find=replace·빈 행 제외)`);
  rules.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.find} → ${r.replace}`);
  });

  for (const out of OUTPUTS) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, json, 'utf8');
    console.log(`→ ${path.relative(ROOT, out)}`);
  }

  let hash = 0;
  const payload = rules
    .map(
      (r) =>
        `${r.find}\0${r.replace}\0${r.tip ?? ''}\0${r.enabled === true ? 1 : 0}\0${
          r.countsInQuota === false ? 0 : 1
        }\0${r.visible === false ? 0 : 1}\0${r.dividerGroup ?? ''}`,
    )
    .join('\n');
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  const fingerprint = `${rules.length}:${hash}`;
  await writeFile(
    META_OUT,
    `${JSON.stringify({ fingerprint, syncedAt: new Date().toISOString(), count: rules.length }, null, 2)}\n`,
    'utf8',
  );
  console.log(`→ ${path.relative(ROOT, META_OUT)} (fingerprint ${fingerprint})`);

  console.log('Done. 브라우저에서 「검사 실행」을 다시 눌러 주세요.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
