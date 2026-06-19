/**
 * caution 시트 행별 sync 결과 감사 (일회성 점검)
 * node scripts/audit-caution-sheet.mjs
 */
import { readFile } from 'node:fs/promises';
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
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* */
  }
}

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

function rowsToObjects(rows) {
  const firstCell = rows[0][0]?.trim().toLowerCase() ?? '';
  if (firstCell !== 'group_id' && firstCell !== 'labels') return [];
  const [headers, ...dataRows] = rows;
  const cleanHeaders = headers.map((h) => h.trim().toLowerCase());
  return dataRows.map((row, index) => {
    const obj = { __row: index + 2 };
    cleanHeaders.forEach((header, i) => {
      if (!header) return;
      obj[header] = (row[i] || '').trim();
    });
    return obj;
  });
}

const SKIP = new Set(['verb-bon', 'verb-special', 'verb-or']);
const ALIASES = { 'particle-or': 'particle-josa' };

function normGroup(id) {
  const t = String(id || '').trim();
  return ALIASES[t] || t;
}

await loadDotEnv();
const id = process.env.SPREADSHEET_ID;
const gid = process.env.CAUTION_GID;
const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
const res = await fetch(url);
const csv = await res.text();
const rows = rowsToObjects(parseCsv(csv));

let curGroup = '';
const report = [];

for (const row of rows) {
  const next = normGroup(row.group_id);
  if (next) curGroup = next;
  const label = String(row.label || '').trim();
  const gidNorm = normGroup(curGroup);
  const issues = [];

  if (SKIP.has(gidNorm)) {
    issues.push('SKIP(verb→일관성)');
  } else if (!label) {
    issues.push('SKIP(label없음)');
  } else if (!curGroup) {
    issues.push('SKIP(group_id없음)');
  } else {
    issues.push('SYNC');
  }

  if (row.match_mode?.includes(' ')) issues.push('match_mode앞뒤공백');
  if (row.counts_in_quota && row.counts_in_quota !== 'FALSE' && row.counts_in_quota !== 'TRUE') {
    issues.push('counts_in_quota값확인');
  }
  if (row.counts_in_quota) issues.push('counts_in_quota→코드미구현');
  if (row.except) issues.push(`except=${row.except}`);
  if (row.stems && !row.label) issues.push(`stems만=${row.stems.slice(0, 40)}`);

  report.push({
    row: row.__row,
    group: row.group_id || `(↑${curGroup})`,
    item_id: row.item_id || '',
    label: label || '(비움)',
    match_mode: row.match_mode || '',
    display_label: row.display_label || '',
    status: issues.join(' · '),
  });
}

console.log(`시트 데이터 행: ${report.length}\n`);
for (const r of report) {
  console.log(
    `${r.row}\t${r.status}\t${r.group}\t${r.item_id}\t${r.label}\t${r.match_mode}\t${r.display_label}`,
  );
}

const synced = report.filter((r) => r.status.startsWith('SYNC'));
const skipped = report.filter((r) => !r.status.startsWith('SYNC'));
console.log(`\n요약: SYNC 후보 ${synced.length} · 제외/스킵 ${skipped.length}`);
