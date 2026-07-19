/**
 * Google 시트 → 맞춤법 규칙 JSON
 *
 * 시트 탭 이름: spelling_rules
 * 컬럼: find | replace | enabled | tip | memo | counts_in_quota | visible | divider_group | divider_label | overlay_replace
 *   - divider_label: 묶음 이름(예: 사이시옷 법칙). 빈 칸 또는 "-"는 이름 없음으로 처리.
 *   - rule_id · finds · display_label: 이형태 묶음(한 행·한 체크). finds는 쉼표 구분.
 *   - 동기화 시 규칙 순서는 시트 행 순서를 그대로 유지한다.
 *
 * 사용:
 *   SPREADSHEET_ID=xxx npm run sync-spelling
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidSpellingRules } from '../src/lib/validateDataJson.js';
import { parseSpellingFindsColumn } from '../src/lib/spellingRuleEntry.js';

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
  묶음: 'divider_label',
  묶음이름: 'divider_label',
  묶음명: 'divider_label',
  'divider label': 'divider_label',
  규칙id: 'rule_id',
  'rule id': 'rule_id',
  이형태: 'finds',
  표시이름: 'display_label',
  'display label': 'display_label',
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

function normalizeOverlayReplace(value) {
  const v = String(value ?? '').trim();
  return v || undefined;
}

function normalizeDividerGroup(value) {
  const v = String(value ?? '').trim();
  return v || undefined;
}

/** 묶음 이름: 빈 칸·"-"(이름 미정 자리표시)는 이름 없음으로 처리 */
function normalizeDividerLabel(value) {
  const v = String(value ?? '').trim();
  if (!v || v === '-') return undefined;
  return v;
}

/** 묶음 C — 구 시트에 group 없이 옛 라벨만 있는 행 보정용 */
const FOREIGN_NOUN_DIVIDER_GROUP = 'C';
const LEGACY_FOREIGN_NOUN_LABELS = new Set([
  '잘못된 외래어표기',
  '잘못된 외래어 표기(명사)',
  '잘못된 외래어 표기(영어)',
]);

function needsLegacyForeignNounGroup(rule) {
  if (String(rule.dividerGroup ?? '').trim()) return false;
  const label = normalizeDividerLabel(rule.dividerLabel);
  return label != null && LEGACY_FOREIGN_NOUN_LABELS.has(label);
}

/**
 * 시트 행 순서 유지. legacy 외래어 명사 묶음에 dividerGroup만 보정.
 * @param {ReturnType<typeof normalizeRow> extends (infer R)[] ? NonNullable<R> : never} rules
 */
function postProcessSpellingRules(rules) {
  for (const rule of rules) {
    if (needsLegacyForeignNounGroup(rule)) {
      rule.dividerGroup = FOREIGN_NOUN_DIVIDER_GROUP;
    }
  }
  return rules;
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
  const dividerLabel = normalizeDividerLabel(row.divider_label);
  const overlayReplace = normalizeOverlayReplace(row.overlay_replace);
  const ruleId = String(row.rule_id || '').trim() || undefined;
  const displayLabel = String(row.display_label || '').trim() || undefined;
  const finds = parseSpellingFindsColumn(row.finds, find);

  const shared = {
    enabled,
    ...(tip ? { tip } : {}),
    ...(memo ? { memo } : {}),
    ...(countsInQuota === false ? { countsInQuota: false } : {}),
    ...(visible === false ? { visible: false } : {}),
    ...(dividerGroup ? { dividerGroup } : {}),
    ...(dividerLabel ? { dividerLabel } : {}),
    ...(overlayReplace ? { overlayReplace } : {}),
    ...(ruleId ? { ruleId } : {}),
    ...(displayLabel ? { displayLabel } : {}),
  };

  if (finds) {
    return {
      find,
      replace,
      finds,
      ...shared,
    };
  }

  if (find.split(/\s+/).length > 8) {
    return null;
  }

  return {
    find,
    replace,
    ...shared,
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

/**
 * 시트 중복 find / find+replace는 첫 행만 남기고 나머지는 건너뛴다.
 * 동기화는 중단하지 않고, 경고로 알려 준다.
 * @param {import('../src/lib/ruleTypes.js').Rule[]} rules
 * @returns {{ rules: import('../src/lib/ruleTypes.js').Rule[], warnings: string[] }}
 */
function dedupeSpellingRulesKeepFirst(rules) {
  const seenFindForms = new Map();
  const seenFindReplace = new Set();
  /** @type {import('../src/lib/ruleTypes.js').Rule[]} */
  const out = [];
  /** @type {string[]} */
  const warnings = [];

  rules.forEach((row, index) => {
    const forms =
      Array.isArray(row.finds) && row.finds.length >= 2
        ? row.finds.map((f) => String(f).trim()).filter(Boolean)
        : row.find
          ? [String(row.find).trim()]
          : [];

    const dupForm = forms.find((form) => seenFindForms.has(form));
    if (dupForm) {
      const prev = seenFindForms.get(dupForm);
      warnings.push(
        `규칙 ${index + 1} 건너뜀: find "${dupForm}" 중복 (이미 규칙 ${prev + 1}에 있음) — ${row.find} → ${row.replace}`,
      );
      return;
    }

    const isVariantBundle = Array.isArray(row.finds) && row.finds.length >= 2;
    if (!isVariantBundle && row.find && row.replace) {
      const key = `${String(row.find).trim()}\0${String(row.replace).trim()}`;
      if (seenFindReplace.has(key)) {
        warnings.push(
          `규칙 ${index + 1} 건너뜀: find+replace 중복 — ${row.find} → ${row.replace}`,
        );
        return;
      }
      seenFindReplace.add(key);
    }

    forms.forEach((form) => {
      if (!seenFindForms.has(form)) seenFindForms.set(form, index);
    });
    out.push(row);
  });

  return { rules: out, warnings };
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
  let rules = postProcessSpellingRules(
    rows.flatMap((row) => {
      const normalized = normalizeRow(row);
      if (!normalized) return [];
      return Array.isArray(normalized) ? normalized : [normalized];
    }),
  );

  if (!rules.length) {
    throw new Error(
      `${SHEET_NAME} 탭에 유효한 행이 없습니다. find·replace 컬럼을 확인하세요.`,
    );
  }

  const deduped = dedupeSpellingRulesKeepFirst(rules);
  if (deduped.warnings.length) {
    console.warn(
      `\n⚠ 시트 중복 ${deduped.warnings.length}건 — 첫 번째만 유지하고 동기화 계속합니다.`,
    );
    for (const w of deduped.warnings) {
      console.warn(`  - ${w}`);
    }
    console.warn('');
  }
  rules = deduped.rules;

  assertValidSpellingRules(rules, 'sync-spelling output');

  const json = `${JSON.stringify(rules, null, 2)}\n`;

  console.log(`CSV ${skippedBulk}행 → 규칙 ${rules.length}개 (find=replace·빈 행 제외)`);
  rules.forEach((r, i) => {
    const label =
      r.finds?.length >= 2
        ? `${r.finds.join('·')} → ${r.replace}`
        : `${r.find} → ${r.replace}`;
    console.log(`  ${i + 1}. ${label}`);
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
        }\0${r.visible === false ? 0 : 1}\0${r.dividerGroup ?? ''}\0${r.dividerLabel ?? ''}\0${r.overlayReplace ?? ''}\0${r.ruleId ?? ''}\0${
          r.finds?.length >= 2 ? r.finds.join('\u0001') : ''
        }\0${r.displayLabel ?? ''}`,
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
