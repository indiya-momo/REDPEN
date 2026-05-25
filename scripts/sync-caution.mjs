/**
 * Google 시트 → 주의(검사·하이라이트) 규칙 JSON
 *
 * 시트 탭: caution_rules (또는 .env CAUTION_SHEET / CAUTION_GID)
 *
 * 표기 A — 그룹당 여러 행 (tip은 첫 행만 써도 됨, 아래 행은 비워도 forward-fill)
 *   group_id | item_id (또는 id) | label | stems | tip | enabled | match_mode | display_label | inventory
 *   stems: 쉼표 구분 어간 (예: 주,준 → ^주다 한 칸에 주다·준다)
 *   inventory: TRUE = 시트 추적용 변이형(체크 없음). 비우면 stems 묶음에 포함된 어간 행은 자동 추적 처리
 *   match_mode: spaced-before = 앞말+공백+label. spaced-stem = 앞말+공백+label+어미. fixed-phrase = 문구 그대로 (예: stems 해 보,해 본 → 해 보다·해 본다만). 비우면 any-before
 *
 * 표기 B — 한 행에 여러 label
 *   group_id | labels | tip | enabled
 *
 * 사용:
 *   npm run sync-caution
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OUTPUTS = [
  path.join(ROOT, 'src/data/caution-rules.json'),
  path.join(ROOT, 'public/data/caution-rules.json'),
];

/** 시트에 섞여 들어온 그룹 이름을 앱 규칙과 맞춤 */
const GROUP_ID_ALIASES = {
  'verb-special': 'verb-bon',
  'verb-or': 'verb-bon',
  'particle-or': 'particle-josa',
};

function normalizeGroupId(id) {
  const trimmed = String(id || '').trim();
  return GROUP_ID_ALIASES[trimmed] || trimmed;
}

function normalizeItemId(id) {
  return String(id || '')
    .trim()
    .replace(/^verv-/, 'verb-');
}

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
  return match ? match[1] : '';
}

const cliId = process.argv
  .slice(2)
  .map(spreadsheetIdFromArg)
  .find((id) => id.length > 10);

if (cliId) {
  process.env.SPREADSHEET_ID = cliId;
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID?.trim();
const SHEET_NAME = process.env.CAUTION_SHEET || 'caution_rules';
const SHEET_GID = process.env.CAUTION_GID?.trim();

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

function parseCommaList(input) {
  if (!input?.trim()) return [];
  return input
    .split(/[,，\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEnabled(value) {
  const v = String(value ?? 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

/** @param {string} [value] */
function parseMatchMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'spaced-stem' || v === 'stem' || v === 'spaced-compound') {
    return 'spaced-stem';
  }
  if (v === 'spaced-before' || v === 'spaced' || v === 'space') {
    return 'spaced-before';
  }
  if (
    v === 'fixed-phrase' ||
    v === 'fixed' ||
    v === 'phrase' ||
    v === 'fixedphrase'
  ) {
    return 'fixed-phrase';
  }
  return 'any-before';
}

/**
 * @param {Record<string, string>} row
 * @param {string} label
 */
function parseStems(row, label) {
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

function parseInventoryOnly(row, matchMode) {
  const v = String(
    row.inventory ?? row.track ?? row.variant ?? row.inventory_only ?? '',
  )
    .trim()
    .toLowerCase();
  if (v === 'true' || v === '1' || v === 'y' || v === 'yes') return true;
  const mode = String(matchMode ?? '').toLowerCase();
  return mode === 'track' || mode === 'inventory' || mode === 'variant';
}

/** @param {ReturnType<typeof itemFromRow>[]} items */
function markInventoryItems(items) {
  const covered = new Set();
  for (const it of items) {
    if (it.inventoryOnly) continue;
    const bundled =
      Boolean(it.displayLabel?.trim()) ||
      (Array.isArray(it.stems) && it.stems.length > 1);
    if (!bundled) continue;
    for (const s of it.stems?.length ? it.stems : [it.label]) {
      covered.add(s);
    }
  }

  return items.map((it) => {
    if (it.inventoryOnly === true) return it;
    const bundled =
      Boolean(it.displayLabel?.trim()) ||
      (Array.isArray(it.stems) && it.stems.length > 1);
    if (bundled) return { ...it, inventoryOnly: false };

    const label = String(it.label || '').trim();
    let inventoryOnly = false;
    if (covered.has(label)) inventoryOnly = true;
    else {
      for (const s of covered) {
        if (label.startsWith(s)) {
          inventoryOnly = true;
          break;
        }
      }
    }
    return { ...it, inventoryOnly };
  });
}

function itemFromRow(row, label, itemId) {
  const rawMode = String(row.match_mode ?? row.matchmode ?? '').trim();
  const inventoryOnly = parseInventoryOnly(row, rawMode);
  const matchMode = inventoryOnly ? 'any-before' : parseMatchMode(rawMode);
  const displayLabel = String(row.display_label ?? row.displaylabel ?? '').trim();
  const stems = parseStems(row, label);
  return {
    id: itemId,
    label,
    enabled: parseEnabled(row.enabled),
    matchMode,
    inventoryOnly,
    ...(stems ? { stems } : {}),
    ...(displayLabel ? { displayLabel } : {}),
  };
}

/**
 * @param {Record<string, string>[]} rows
 */
function rowsToCautionGroups(rows) {
  if (!rows.length) return [];

  const hasLabelsColumn = rows.some((r) => String(r.labels ?? '').trim());

  if (hasLabelsColumn) {
    return rows
      .map((row) => {
        const groupId = normalizeGroupId(row.group_id || row.groupid);
        const tip = String(row.tip || '').trim();
        const labels = parseCommaList(row.labels);
        if (!groupId || !tip || !labels.length) return null;

        const enabledDefault = parseEnabled(row.enabled);
        return {
          id: groupId,
          tip,
          items: labels.map((label) =>
            itemFromRow(row, label, `${groupId}-${label}`),
          ),
        };
      })
      .filter(Boolean);
  }

  const groups = new Map();
  let curGroupId = '';
  let curTip = '';

  for (const row of rows) {
    const nextGroupId = normalizeGroupId(row.group_id || row.groupid);
    if (nextGroupId && nextGroupId !== curGroupId) {
      curGroupId = nextGroupId;
      curTip = String(row.tip || '').trim();
    } else if (nextGroupId) {
      curGroupId = nextGroupId;
    }
    if (row.tip?.trim()) curTip = row.tip.trim();

    const label = String(row.label || '').trim();
    if (!label || !curGroupId) continue;

    const itemId =
      normalizeItemId(row.item_id || row.itemid || row.id) ||
      `${curGroupId}-${label}`;

    if (!groups.has(curGroupId)) {
      groups.set(curGroupId, { id: curGroupId, tip: curTip, items: [] });
    }
    const group = groups.get(curGroupId);
    if (curTip) group.tip = curTip;

    group.items.push(itemFromRow(row, label, itemId));
  }

  return [...groups.values()]
    .filter((g) => g.items.length)
    .map((g) => ({
      ...g,
      tip: g.tip || '',
      items: markInventoryItems(g.items),
    }))
    .filter((g) => g.items.length);
}

/** @returns {Promise<Map<string, { title?: string, hideGroupTitle?: boolean, tipInline?: boolean }>>} */
async function loadExistingGroupUiMeta() {
  const map = new Map();
  try {
    const raw = await readFile(OUTPUTS[0], 'utf8');
    const parsed = JSON.parse(raw);
    for (const g of parsed.groups ?? []) {
      if (!g?.id) continue;
      /** @type {{ title?: string, hideGroupTitle?: boolean, tipInline?: boolean }} */
      const meta = {};
      if (typeof g.title === 'string' && g.title.trim()) {
        meta.title = g.title.trim();
      }
      if (g.hideGroupTitle === true) meta.hideGroupTitle = true;
      if (g.tipInline === true) meta.tipInline = true;
      if (Object.keys(meta).length) map.set(g.id, meta);
    }
  } catch {
    /* 첫 싱크 */
  }
  return map;
}

/**
 * @param {ReturnType<typeof rowsToCautionGroups>} groups
 * @param {Map<string, { title?: string, hideGroupTitle?: boolean, tipInline?: boolean }>} metaMap
 */
function mergeGroupUiMeta(groups, metaMap) {
  return groups.map((g) => {
    const prev = metaMap.get(g.id);
    if (!prev) return g;
    return { ...g, ...prev };
  });
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

async function fetchSheet() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID가 없습니다. .env에 시트 ID를 넣으세요.');
  }

  const cacheBust = Date.now().toString();

  if (!SHEET_GID && SHEET_NAME) {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}&_=${cacheBust}`;
    try {
      const csv = await fetchSheetCsv(gvizUrl, `gviz(${SHEET_NAME})`);
      const rows = rowsToObjects(parseCsv(csv));
      if (rows.length) return rows;
    } catch {
      /* export URL로 재시도 */
    }
  }

  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export`,
  );
  exportUrl.searchParams.set('format', 'csv');
  if (SHEET_GID) {
    exportUrl.searchParams.set('gid', SHEET_GID);
  } else if (SHEET_NAME) {
    exportUrl.searchParams.set('sheet', SHEET_NAME);
  }
  exportUrl.searchParams.set('_', cacheBust);

  const csv = await fetchSheetCsv(exportUrl.toString(), 'export');
  return rowsToObjects(parseCsv(csv));
}

async function main() {
  const csvArg = process.argv.slice(2).find((a) => a.startsWith('--csv='));
  const rows = csvArg
    ? rowsToObjects(parseCsv(await readFile(path.resolve(ROOT, csvArg.slice(6)), 'utf8')))
    : await (async () => {
        const tab = SHEET_GID ? `gid=${SHEET_GID}` : `sheet=${SHEET_NAME}`;
        console.log(
          `시트: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit (${tab})`,
        );
        return fetchSheet();
      })();

  const uiMeta = await loadExistingGroupUiMeta();
  const groups = mergeGroupUiMeta(rowsToCautionGroups(rows), uiMeta);

  if (!groups.length) {
    throw new Error(
      `${SHEET_NAME} 탭에 유효한 행이 없습니다. group_id·label(또는 labels) 컬럼을 확인하세요.`,
    );
  }

  const payload = { groups };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);

  console.log(`CSV ${rows.length}행 → 그룹 ${groups.length}개 · 항목 ${itemCount}개`);
  for (const g of groups) {
    const labels = g.items.map((i) => i.label).join(', ');
    console.log(`  · ${g.id}: ${labels}`);
  }

  for (const out of OUTPUTS) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, json, 'utf8');
    console.log(`→ ${path.relative(ROOT, out)}`);
  }

  console.log('Done. 브라우저 새로고침 후 주의 체크 상태를 확인하세요.');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
