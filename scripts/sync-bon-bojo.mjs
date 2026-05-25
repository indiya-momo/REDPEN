/**
 * Google 시트 bon-bojo 탭 → 본용언+보조용언 시드 JSON
 *
 * caution_rules 와 동일한 열: group_id | item_id | label | stems | tip | enabled
 *   | match_mode | display_label | inventory | except | counts_in_quota
 * match_mode · inventory · except · counts_in_quota 는 일관성 시드에 쓰지 않음(무시).
 *
 * label / stems → tail_word (보, 해 보). display_label → 일관성 목록 표시명.
 *
 * npm run sync-bon-bojo
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchSheetRows,
  loadDotEnv,
  parseEnabled,
  parseExcept,
  parseStems,
  parseCsv,
  rowsToObjects,
} from './sheet-csv.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OUTPUTS = [
  path.join(ROOT, 'src/data/bon-bojo-rules.json'),
  path.join(ROOT, 'public/data/bon-bojo-rules.json'),
];

function normalizeGroupId(id) {
  return String(id || '').trim();
}

function normalizeItemId(id) {
  return String(id || '')
    .trim()
    .replace(/^verv-/, 'verb-');
}

function itemFromRow(row, label, itemId) {
  const displayLabel = String(row.display_label ?? row.displaylabel ?? '').trim();
  const stems = parseStems(row, label);
  const except = parseExcept(row);
  return {
    id: itemId,
    label,
    enabled: parseEnabled(row.enabled),
    ...(stems ? { stems } : {}),
    ...(displayLabel ? { displayLabel } : {}),
    ...(except ? { except } : {}),
  };
}

/**
 * @param {Record<string, string>[]} rows
 */
function rowsToBonBojoGroups(rows) {
  if (!rows.length) return [];

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
    .map((g) => ({ ...g, tip: g.tip || '' }));
}

async function loadExistingGroupUiMeta() {
  const map = new Map();
  try {
    const raw = await readFile(OUTPUTS[0], 'utf8');
    const parsed = JSON.parse(raw);
    for (const g of parsed.groups ?? []) {
      if (!g?.id) continue;
      /** @type {{ title?: string }} */
      const meta = {};
      if (typeof g.title === 'string' && g.title.trim()) {
        meta.title = g.title.trim();
      }
      if (Object.keys(meta).length) map.set(g.id, meta);
    }
  } catch {
    /* 첫 싱크 */
  }
  return map;
}

function mergeGroupUiMeta(groups, metaMap) {
  return groups.map((g) => {
    const prev = metaMap.get(g.id);
    if (!prev) return g;
    return { ...g, ...prev };
  });
}

await loadDotEnv();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID?.trim();
const SHEET_NAME = process.env.BON_BOJO_SHEET || 'bon-bojo';
const SHEET_GID = process.env.BON_BOJO_GID?.trim();

const csvArg = process.argv.slice(2).find((a) => a.startsWith('--csv='));
const rows = csvArg
  ? rowsToObjects(parseCsv(await readFile(path.resolve(ROOT, csvArg.slice(6)), 'utf8')))
  : await (async () => {
      const tab = SHEET_GID ? `gid=${SHEET_GID}` : `sheet=${SHEET_NAME}`;
      console.log(
        `시트: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit (${tab})`,
      );
      return fetchSheetRows({
        spreadsheetId: SPREADSHEET_ID,
        sheetName: SHEET_NAME,
        sheetGid: SHEET_GID,
      });
    })();

const uiMeta = await loadExistingGroupUiMeta();
const groups = mergeGroupUiMeta(rowsToBonBojoGroups(rows), uiMeta);

if (!groups.length) {
  throw new Error(
    `${SHEET_NAME} 탭에 유효한 행이 없습니다. group_id·label 컬럼을 확인하세요.`,
  );
}

const payload = { groups };
const json = `${JSON.stringify(payload, null, 2)}\n`;
let tailCount = 0;
for (const g of groups) {
  for (const it of g.items) {
    const tails = it.stems?.length ? it.stems.length + 1 : 1;
    tailCount += tails;
  }
}

console.log(`CSV ${rows.length}행 → 그룹 ${groups.length}개 · tail ${tailCount}개`);
for (const g of groups) {
  const labels = g.items.map((i) => i.displayLabel || i.label).join(', ');
  console.log(`  · ${g.id}: ${labels}`);
}

for (const out of OUTPUTS) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, json, 'utf8');
  console.log(`→ ${path.relative(ROOT, out)}`);
}

console.log('Done. 브라우저 새로고침 후 일관성 → 본용언+보조용언 목록을 확인하세요.');
