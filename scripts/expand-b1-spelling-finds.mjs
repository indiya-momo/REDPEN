/**
 * B1 finds 전개 — Kiwi joinSent로 관형·연결 표면을 같은 행 finds에 합침.
 *
 *   npm run kiwi:expand-b1-finds
 *
 * @see project-docs/b1-stem-finds-expand-design-2026-08-06.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  b1ExpandSkipReason,
  expandB1SpellingRow,
} from '../src/lib/b1StemFindsExpand.js';
import { buildSpellingRulesMeta } from '../src/lib/spellingRulesFingerprint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC_JSON = path.join(root, 'src/data/spelling-rules.json');
const PUBLIC_JSON = path.join(root, 'public/data/spelling-rules.json');
const META_JSON = path.join(root, 'public/data/spelling-rules-meta.json');

/**
 * 전개 후 데이터로 메타 지문을 다시 계산(syncedAt은 시트 싱크 시각이라 그대로 둠).
 * @param {object[]} rows
 */
function writeSpellingMeta(rows) {
  let syncedAt = new Date().toISOString();
  try {
    const prev = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
    if (typeof prev?.syncedAt === 'string' && prev.syncedAt) syncedAt = prev.syncedAt;
  } catch {
    /* 메타 없음 — 지금 시각 */
  }
  const meta = buildSpellingRulesMeta(rows, syncedAt);
  fs.writeFileSync(META_JSON, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`[expand-b1] meta fingerprint ${meta.fingerprint}`);
}

async function main() {
  const loadNodeUrl = pathToFileURL(
    path.join(root, 'src/lib/kiwiMorph/loadNode.js'),
  ).href;
  const { loadKiwiNode, resolveKiwiNodePaths } = await import(loadNodeUrl);
  const paths = resolveKiwiNodePaths(root);
  if (!paths.ready) {
    console.error(
      '[expand-b1] Kiwi 모델 없음. tmp/kiwi-models/models/cong/base 를 확인하세요.',
    );
    process.exit(1);
  }

  const kiwi = await loadKiwiNode({ rootDir: root, register: false });
  if (!kiwi?.joinSent) {
    console.error('[expand-b1] kiwi.joinSent 없음');
    process.exit(1);
  }

  const rules = JSON.parse(fs.readFileSync(SRC_JSON, 'utf8'));
  if (!Array.isArray(rules)) {
    console.error('[expand-b1] spelling-rules.json 배열이 아닙니다');
    process.exit(1);
  }

  /** 다른 행이 이미 찾을 말로 가진 표면은 전개로 넣지 않는다(중복 find·잘못된 교정 방지). */
  /** @type {Map<string, Set<number>>} */
  const ownersByForm = new Map();
  rules.forEach((r, idx) => {
    const forms = [r?.find, ...(Array.isArray(r?.finds) ? r.finds : [])];
    for (const f of forms) {
      const k = String(f ?? '').trim();
      if (!k) continue;
      if (!ownersByForm.has(k)) ownersByForm.set(k, new Set());
      ownersByForm.get(k).add(idx);
    }
  });
  const ownedByOtherRow = (form, idx) =>
    [...(ownersByForm.get(form) ?? [])].some((o) => o !== idx);

  let changedRows = 0;
  let skipped = 0;
  const next = rules.map((row, idx) => {
    if (String(row?.dividerGroup ?? '').trim() !== 'B1') return row;
    const reason = b1ExpandSkipReason(row);
    if (reason && reason !== 'not-B1') {
      skipped += 1;
      console.log(`[skip] ${row.find} (${reason})`);
      return row;
    }
    const result = expandB1SpellingRow(row, kiwi);
    if (result.skip) {
      skipped += 1;
      console.log(`[skip] ${row.find} (${result.skip})`);
      return row;
    }
    if (!result.changed) return row;
    const dropped = (result.added ?? []).filter((f) => ownedByOtherRow(f, idx));
    if (dropped.length) {
      console.log(`[expand-skip-dup] ${row.find}: ${dropped.join(', ')} (다른 행 find)`);
      result.added = result.added.filter((f) => !dropped.includes(f));
      result.row = {
        ...result.row,
        finds: (result.row.finds ?? []).filter((f) => !dropped.includes(f)),
      };
      if (!result.added.length) return row;
    }
    changedRows += 1;
    const addPreview = (result.added ?? []).slice(0, 8).join(', ');
    console.log(
      `[expand] ${row.find} +${result.added?.length ?? 0}` +
        (addPreview ? ` (${addPreview}${(result.added?.length ?? 0) > 8 ? '…' : ''})` : ''),
    );
    return result.row;
  });

  const json = `${JSON.stringify(next, null, 2)}\n`;
  fs.writeFileSync(SRC_JSON, json, 'utf8');
  fs.writeFileSync(PUBLIC_JSON, json, 'utf8');
  writeSpellingMeta(next);
  console.log(
    `[expand-b1] done — changed=${changedRows} skippedB1=${skipped} total=${next.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
