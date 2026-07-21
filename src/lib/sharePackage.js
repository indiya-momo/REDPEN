/**
 * 공유 패키지 도메인 — 기준+검수결과 스냅숏 (PDF 바이너리 없음).
 */
import {
  CHECK_RESULT_RETENTION_MS,
  CHECK_RESULT_SOFT_BYTE_LIMIT,
  estimateJsonBytes,
} from './checkResultSnapshot.js';
import { canAddCriteriaPreset, formatCriteriaPresetLimitMessage, getMaxCriteriaPresets } from './criteriaPresetLimit.js';
import { buildCriteriaCheckpoint } from './criteriaCheckpoint.js';
import { normalizeRuleSet } from './ruleSetNormalize.js';
import { newId } from './ruleSetsStorage.js';

export const SHARE_PACKAGE_SCHEMA_VERSION = 1;
export const SHARE_PACKAGE_COLLECTION = 'sharePackages';

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function buildSharePackageUrl(packageId, date = new Date()) {
  const id = String(packageId ?? '').trim();
  if (!id) return '';
  if (typeof window === 'undefined' || !window.location) {
    return `?share=${encodeURIComponent(id)}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('share', id);
  void date;
  return url.toString();
}

/**
 * RuleSet → 공유용 criteria 슬라이스 (원고 바이트 없음).
 * @param {import('./ruleSetsStorage.js').RuleSet} ruleSet
 */
export function extractShareCriteria(ruleSet) {
  const set = ruleSet && typeof ruleSet === 'object' ? ruleSet : {};
  return {
    builtInEnabled: structuredClone(set.builtInEnabled ?? {}),
    cautionEnabled: structuredClone(set.cautionEnabled ?? {}),
    customRules: structuredClone(set.customRules ?? []),
    globalExcludePhrases: [...(set.globalExcludePhrases ?? [])],
    consistencyDecisions: structuredClone(set.consistencyDecisions ?? []),
    cautionRulesFingerprint: set.cautionRulesFingerprint,
    cautionEnabledPolicyVersion: set.cautionEnabledPolicyVersion,
    compoundMigrateVersion: set.compoundMigrateVersion,
    spellingRulesFingerprint: set.spellingRulesFingerprint,
    bonBojoRulesFingerprint: set.bonBojoRulesFingerprint,
  };
}

/**
 * @param {Record<string, unknown>} raw
 */
export function sanitizeCheckResultForShare(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind === 'consistency' ? 'consistency' : raw.kind === 'spelling' ? 'spelling' : null;
  if (!kind) return null;
  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    kind,
    createdAt: Number(raw.createdAt) || 0,
    expiresAt: Number(raw.expiresAt) || 0,
    projectId: String(raw.projectId ?? ''),
    pdfFileName: String(raw.pdfFileName ?? ''),
    sheetName: String(raw.sheetName ?? ''),
    filename: String(raw.filename ?? ''),
    summaryLine: String(raw.summaryLine ?? ''),
    summary:
      raw.summary && typeof raw.summary === 'object' && !Array.isArray(raw.summary)
        ? raw.summary
        : {},
    rows: Array.isArray(raw.rows) ? raw.rows : [],
    truncated: Boolean(raw.truncated),
    rowCount: Number(raw.rowCount ?? (Array.isArray(raw.rows) ? raw.rows.length : 0)),
  };
}

/**
 * @param {{
 *   ruleSet: import('./ruleSetsStorage.js').RuleSet,
 *   checkResults?: Array<Record<string, unknown>>,
 *   createdByUid: string,
 *   now?: number,
 *   softByteLimit?: number,
 * }} args
 */
export function buildSharePackagePayload({
  ruleSet,
  checkResults = [],
  createdByUid,
  now = Date.now(),
  softByteLimit = CHECK_RESULT_SOFT_BYTE_LIMIT,
}) {
  const uid = String(createdByUid ?? '').trim();
  const set = ruleSet;
  if (!uid || !set?.id || !set.savedAt) return null;

  const title = String(set.name ?? '').trim() || '프로젝트';
  /** @type {ReturnType<typeof sanitizeCheckResultForShare>[]} */
  const cleaned = [];
  for (const row of checkResults) {
    const item = sanitizeCheckResultForShare(row);
    if (!item) continue;
    if (!Number.isFinite(item.expiresAt) || item.expiresAt <= now) continue;
    cleaned.push(item);
  }

  const base = {
    schemaVersion: SHARE_PACKAGE_SCHEMA_VERSION,
    createdAt: now,
    expiresAt: now + CHECK_RESULT_RETENTION_MS,
    createdByUid: uid,
    sourceProjectId: String(set.id),
    sourceName: title,
    meta: {
      title,
      tags: Array.isArray(set.tags) ? [...set.tags] : [],
      memo: typeof set.memo === 'string' ? set.memo : '',
      formatLabel:
        typeof set.projectContext?.formatLabel === 'string'
          ? set.projectContext.formatLabel
          : typeof set.formatLabel === 'string'
            ? set.formatLabel
            : '',
      pillarMemos:
        set.pillarMemos && typeof set.pillarMemos === 'object'
          ? structuredClone(set.pillarMemos)
          : undefined,
    },
    criteria: extractShareCriteria(set),
    checkResults: cleaned,
    truncated: false,
  };

  let results = [...cleaned];
  let truncated = false;
  while (
    results.length > 0 &&
    estimateJsonBytes({ ...base, checkResults: results, truncated: true }) >
      softByteLimit
  ) {
    results = results.slice(0, -1);
    truncated = true;
  }

  return {
    ...base,
    checkResults: results,
    truncated,
  };
}

/**
 * 공유 패키지 → 열람·적용용 임시 RuleSet (저장 전 미리보기).
 * @param {Record<string, unknown>} pkg
 * @returns {import('./ruleSetsStorage.js').RuleSet | null}
 */
export function buildRuleSetFromSharePackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return null;
  const criteria = pkg.criteria;
  if (!criteria || typeof criteria !== 'object') return null;

  const sourceName =
    String(pkg.sourceName ?? pkg.meta?.title ?? '').trim() || '공유 프로젝트';
  const draft = normalizeRuleSet({
    id: String(pkg.sourceProjectId ?? pkg.id ?? 'share-preview'),
    name: sourceName.slice(0, 80),
    builtInEnabled: criteria.builtInEnabled ?? {},
    cautionEnabled: criteria.cautionEnabled ?? {},
    customRules: criteria.customRules ?? [],
    globalExcludePhrases: criteria.globalExcludePhrases ?? [],
    consistencyDecisions: criteria.consistencyDecisions ?? [],
    cautionRulesFingerprint: criteria.cautionRulesFingerprint,
    cautionEnabledPolicyVersion: criteria.cautionEnabledPolicyVersion,
    compoundMigrateVersion: criteria.compoundMigrateVersion,
    spellingRulesFingerprint: criteria.spellingRulesFingerprint,
    bonBojoRulesFingerprint: criteria.bonBojoRulesFingerprint,
    savedAt:
      typeof pkg.createdAt === 'number'
        ? new Date(pkg.createdAt).toISOString()
        : new Date().toISOString(),
    tags: Array.isArray(pkg.meta?.tags) ? [...pkg.meta.tags] : [],
    memo: typeof pkg.meta?.memo === 'string' ? pkg.meta.memo : '',
    pillarMemos:
      pkg.meta?.pillarMemos && typeof pkg.meta.pillarMemos === 'object'
        ? structuredClone(pkg.meta.pillarMemos)
        : undefined,
    projectContext: {
      formatLabel:
        typeof pkg.meta?.formatLabel === 'string' ? pkg.meta.formatLabel : '',
    },
  });

  return normalizeRuleSet({
    ...draft,
    criteriaCheckpoint: buildCriteriaCheckpoint(draft),
  });
}

/**
 * 공유 패키지 criteria → 수신자 RuleSet (저장 프리셋).
 * @param {Record<string, unknown>} pkg
 * @param {import('./ruleSetsStorage.js').RuleSet[]} existingSets
 * @param {string} [uid]
 * @param {string} [email]
 * @param {unknown} [plan]
 */
export function planApplySharePackage(
  pkg,
  existingSets,
  uid = '',
  email = '',
  plan,
) {
  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, reason: 'invalid' };
  }
  const criteria = pkg.criteria;
  if (!criteria || typeof criteria !== 'object') {
    return { ok: false, reason: 'invalid' };
  }
  const expiresAt = Number(pkg.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const sourceName =
    String(pkg.sourceName ?? pkg.meta?.title ?? '').trim() || '공유 프로젝트';
  const name = `공유 · ${sourceName}`.slice(0, 80);
  const sets = existingSets ?? [];

  if (!canAddCriteriaPreset(sets, name, uid, email, plan)) {
    const maxSlots = getMaxCriteriaPresets(uid, email, plan);
    return {
      ok: false,
      reason: 'slot_limit',
      message: formatCriteriaPresetLimitMessage(maxSlots),
    };
  }

  const conflict = sets.find((s) => (s.name || '').trim() === name);
  const finalName = conflict
    ? `${name} (${Date.now().toString(36).slice(-4)})`
    : name;

  const nowIso = new Date().toISOString();
  const draft = normalizeRuleSet({
    id: newId(),
    name: finalName,
    builtInEnabled: criteria.builtInEnabled ?? {},
    cautionEnabled: criteria.cautionEnabled ?? {},
    customRules: criteria.customRules ?? [],
    globalExcludePhrases: criteria.globalExcludePhrases ?? [],
    consistencyDecisions: criteria.consistencyDecisions ?? [],
    cautionRulesFingerprint: criteria.cautionRulesFingerprint,
    cautionEnabledPolicyVersion: criteria.cautionEnabledPolicyVersion,
    compoundMigrateVersion: criteria.compoundMigrateVersion,
    spellingRulesFingerprint: criteria.spellingRulesFingerprint,
    bonBojoRulesFingerprint: criteria.bonBojoRulesFingerprint,
    savedAt: nowIso,
    tags: Array.isArray(pkg.meta?.tags) ? [...pkg.meta.tags] : [],
    memo: typeof pkg.meta?.memo === 'string' ? pkg.meta.memo : '',
    pillarMemos:
      pkg.meta?.pillarMemos && typeof pkg.meta.pillarMemos === 'object'
        ? structuredClone(pkg.meta.pillarMemos)
        : undefined,
    projectContext: {
      formatLabel:
        typeof pkg.meta?.formatLabel === 'string' ? pkg.meta.formatLabel : '',
      lastWorkedAt: nowIso,
    },
  });

  const nextSet = normalizeRuleSet({
    ...draft,
    criteriaCheckpoint: buildCriteriaCheckpoint(draft),
  });

  return {
    ok: true,
    next: [...sets, nextSet],
    newSetId: nextSet.id,
    label: nextSet.name,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} pkg
 * @param {number} [now]
 */
export function isSharePackageExpired(pkg, now = Date.now()) {
  const expiresAt = Number(pkg?.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
