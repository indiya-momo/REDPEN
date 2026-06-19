/**
 * Google 시트 bon-bojo 탭 → 본용언+보조용언 시드 JSON
 *
 * caution_rules 와 동일한 열: group_id | item_id | label | stems | tip | enabled
 *   | match_mode | display_label | inventory | except | bon_allow | counts_in_quota
 * match_mode · inventory · except · counts_in_quota 는 검사에 쓰지 않음.
 * bon_allow — 같은 group_id 행을 합쳐 그룹 bonVerbAllow (3음절+ 본용언 허용).
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
  parseBonAllow,
  parseStems,
  parseCsv,
  rowsToObjects,
} from './sheet-csv.mjs';
import { assertValidBonBojoRules } from '../src/lib/validateDataJson.js';
import { partitionBonVerbAllowPhrases } from '../src/lib/bonNounHaeBlocklist.js';

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
  /** @type {Map<string, Set<string>>} */
  const allowByGroup = new Map();
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

    const rowAllow = parseBonAllow(row);
    if (rowAllow?.length && curGroupId) {
      if (!allowByGroup.has(curGroupId)) allowByGroup.set(curGroupId, new Set());
      for (const phrase of rowAllow) allowByGroup.get(curGroupId).add(phrase);
    }

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
    .map((g) => {
      const allow = allowByGroup.get(g.id);
      if (!allow?.size) {
        return { ...g, tip: g.tip || '' };
      }
      const { kept, dropped } = partitionBonVerbAllowPhrases([...allow]);
      if (dropped.length) {
        console.warn(
          `  ! ${g.id} bon_allow 명사+해 제외: ${dropped.join(', ')}`,
        );
      }
      return {
        ...g,
        tip: g.tip || '',
        ...(kept.length ? { bonVerbAllow: kept } : {}),
      };
    });
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
assertValidBonBojoRules(payload, 'sync-bon-bojo output');

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
  const allow =
    g.bonVerbAllow?.length ? ` · allow ${g.bonVerbAllow.length}` : '';
  console.log(`  · ${g.id}: ${labels}${allow}`);
  if (g.bonVerbAllow?.length) {
    console.log(`      ${g.bonVerbAllow.join(', ')}`);
  }
}

for (const out of OUTPUTS) {
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, json, 'utf8');
  console.log(`→ ${path.relative(ROOT, out)}`);
}

console.log('Done. 브라우저 새로고침 후 일관성 → 본용언+보조용언 목록을 확인하세요.');
