/** 검수 결과 스냅숏 도메인 — Firestore 저장용 순수 JSON. */

export const CHECK_RESULT_SCHEMA_VERSION = 1;
export const CHECK_RESULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Firestore 1MiB 대비 여유 (UTF-16/JSON 오버헤드 감안) */
export const CHECK_RESULT_SOFT_BYTE_LIMIT = 900_000;

/**
 * @param {unknown} value
 * @returns {number}
 */
export function estimateJsonBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * @param {'spelling' | 'consistency'} kind
 * @returns {string}
 */
function defaultFilename(kind) {
  return kind === 'consistency' ? '표기통일_검사결과.xlsx' : '맞춤법_검사결과.xlsx';
}

/**
 * export 조판 모델 → 저장용 스냅숏.
 * 활성 projectId 없으면 null (저장 스킵).
 *
 * @param {{
 *   kind: 'spelling' | 'consistency',
 *   projectId: string | null | undefined,
 *   pdfFileName?: string | null,
 *   exportModel: {
 *     sheetName?: string,
 *     filename?: string,
 *     summaryLine: string,
 *     summary: object,
 *     rows: object[],
 *   },
 *   now?: number,
 *   softByteLimit?: number,
 * }} args
 * @returns {null | {
 *   schemaVersion: number,
 *   kind: 'spelling' | 'consistency',
 *   createdAt: number,
 *   expiresAt: number,
 *   projectId: string,
 *   pdfFileName: string,
 *   sheetName: string,
 *   filename: string,
 *   summaryLine: string,
 *   summary: object,
 *   rows: object[],
 *   truncated: boolean,
 *   rowCount: number,
 * }}
 */
export function buildCheckResultSnapshot({
  kind,
  projectId,
  pdfFileName = '',
  exportModel,
  now = Date.now(),
  softByteLimit = CHECK_RESULT_SOFT_BYTE_LIMIT,
}) {
  const pid = String(projectId ?? '').trim();
  if (!pid || !exportModel) return null;
  if (kind !== 'spelling' && kind !== 'consistency') return null;

  const base = {
    schemaVersion: CHECK_RESULT_SCHEMA_VERSION,
    kind,
    createdAt: now,
    expiresAt: now + CHECK_RESULT_RETENTION_MS,
    projectId: pid,
    pdfFileName: String(pdfFileName ?? '').trim(),
    sheetName: exportModel.sheetName || (kind === 'consistency' ? '표기 통일 확인' : '맞춤법 확인'),
    filename: exportModel.filename || defaultFilename(kind),
    summaryLine: String(exportModel.summaryLine ?? ''),
    summary: exportModel.summary && typeof exportModel.summary === 'object'
      ? exportModel.summary
      : {},
    rows: Array.isArray(exportModel.rows) ? [...exportModel.rows] : [],
    truncated: false,
  };

  let rows = base.rows;
  let truncated = false;
  while (
    rows.length > 0 &&
    estimateJsonBytes({ ...base, rows, truncated: true }) > softByteLimit
  ) {
    rows = rows.slice(0, -1);
    truncated = true;
  }

  return {
    ...base,
    rows,
    truncated,
    rowCount: rows.length,
  };
}

/**
 * 스냅숏 → 엑셀 인쇄용 export 모델.
 * @param {{
 *   kind: 'spelling' | 'consistency',
 *   sheetName?: string,
 *   filename?: string,
 *   summaryLine?: string,
 *   summary?: object,
 *   rows?: object[],
 * }} snapshot
 */
export function exportModelFromSnapshot(snapshot) {
  if (!snapshot || (snapshot.kind !== 'spelling' && snapshot.kind !== 'consistency')) {
    return null;
  }
  return {
    kind: snapshot.kind,
    sheetName:
      snapshot.sheetName ||
      (snapshot.kind === 'consistency' ? '표기 통일 확인' : '맞춤법 확인'),
    filename: snapshot.filename || defaultFilename(snapshot.kind),
    summaryLine: String(snapshot.summaryLine ?? ''),
    summary: snapshot.summary && typeof snapshot.summary === 'object' ? snapshot.summary : {},
    rows: Array.isArray(snapshot.rows) ? snapshot.rows : [],
  };
}

/**
 * @param {number} expiresAt
 * @param {number} [now]
 * @returns {number}
 */
export function remainingRetentionDays(expiresAt, now = Date.now()) {
  const ms = Number(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
