/**
 * Google 시트 CSV 파싱·fetch 공통 (sync-caution, sync-bon-bojo)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export async function loadDotEnv() {
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

export function parseCsv(csv) {
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

export function rowsToObjects(rows) {
  if (!rows.length) return [];

  const firstCell = rows[0][0]?.trim().toLowerCase() ?? '';
  if (firstCell === 'group_id' || firstCell === 'labels') {
    const [headers, ...dataRows] = rows;
    const cleanHeaders = headers.map((h) => h.trim().toLowerCase());

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

  return [];
}

export function parseCommaList(input) {
  if (!input?.trim()) return [];
  return input
    .split(/[,，\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseEnabled(value) {
  const v = String(value ?? 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

export function parseExcept(row) {
  const raw = String(row.except ?? '').trim();
  if (!raw) return undefined;
  const list = parseCommaList(raw);
  return list.length ? list : undefined;
}

/** bon-bojo 그룹 — 3음절+ 단일어 본용언 화이트리스트 */
export function parseBonAllow(row) {
  const raw = String(
    row.bon_allow ?? row.bonallow ?? row['bon allow'] ?? '',
  ).trim();
  if (!raw) return undefined;
  const list = parseCommaList(raw);
  return list.length ? list : undefined;
}

export function parseStems(row, label) {
  const raw = String(row.stems ?? row.stem ?? '').trim();
  if (!raw) return undefined;
  const list = raw
    .split(/[,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1 && list[0] === label) return undefined;
  return list;
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

/**
 * @param {{ spreadsheetId: string, sheetName?: string, sheetGid?: string }} opts
 */
export async function fetchSheetRows({ spreadsheetId, sheetName, sheetGid }) {
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID가 없습니다. .env에 시트 ID를 넣으세요.');
  }

  const cacheBust = Date.now().toString();

  if (!sheetGid && sheetName) {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&_=${cacheBust}`;
    try {
      const csv = await fetchSheetCsv(gvizUrl, `gviz(${sheetName})`);
      const rows = rowsToObjects(parseCsv(csv));
      if (rows.length) return rows;
    } catch {
      /* export URL로 재시도 */
    }
  }

  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`,
  );
  exportUrl.searchParams.set('format', 'csv');
  if (sheetGid) {
    exportUrl.searchParams.set('gid', sheetGid);
  } else if (sheetName) {
    exportUrl.searchParams.set('sheet', sheetName);
  }
  exportUrl.searchParams.set('_', cacheBust);

  const csv = await fetchSheetCsv(exportUrl.toString(), 'export');
  return rowsToObjects(parseCsv(csv));
}
