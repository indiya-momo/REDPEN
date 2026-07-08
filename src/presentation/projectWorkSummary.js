/**
 * 작업 이력 탭 — 마지막 작업 스냅샷(projectContext)을 표시용 문구로 변환.
 * 저장 구조는 건드리지 않고 읽기만 한다.
 */
import { formatProjectCardDotDateFromIso } from './projectCardViewModel.js';

export const WORK_SUMMARY_NONE_LABEL = '기록 없음';

/**
 * @param {string} iso
 * @param {number} nowMs
 * @returns {string | undefined}
 */
function relativeDaysLabel(iso, nowMs) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const diffDays = Math.floor((nowMs - ms) / 86_400_000);
  if (diffDays <= 0) return '오늘';
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

/**
 * @param {number | undefined} bytes
 * @returns {string | undefined}
 */
export function formatPdfSizeLabel(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return undefined;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))}KB`;
}

/**
 * @typedef {{
 *   lastWorked: string,
 *   pdf: string,
 *   findings: string,
 * }} ProjectWorkSummary
 */

/**
 * @param {import('../lib/projectMeta.js').ProjectContext | undefined} ctx
 * @param {number} [nowMs]
 * @returns {ProjectWorkSummary | null} 표시할 기록이 하나도 없으면 null
 */
export function buildProjectWorkSummary(ctx, nowMs = Date.now()) {
  if (!ctx || typeof ctx !== 'object') return null;

  const hasSpelling = typeof ctx.lastSpellingFindingCount === 'number';
  const hasConsistency = typeof ctx.lastConsistencyFindingCount === 'number';
  const hasAny =
    Boolean(ctx.lastWorkedAt) ||
    Boolean(ctx.pdfFileName) ||
    hasSpelling ||
    hasConsistency;
  if (!hasAny) return null;

  let lastWorked = WORK_SUMMARY_NONE_LABEL;
  if (ctx.lastWorkedAt) {
    const date = formatProjectCardDotDateFromIso(ctx.lastWorkedAt);
    const relative = relativeDaysLabel(ctx.lastWorkedAt, nowMs);
    if (date) {
      lastWorked = relative ? `${date} (${relative})` : date;
    }
  }

  /** @type {string[]} */
  const pdfParts = [];
  if (ctx.pdfFileName) pdfParts.push(ctx.pdfFileName);
  if (typeof ctx.pdfPageCount === 'number') {
    pdfParts.push(`${ctx.pdfPageCount}쪽`);
  }
  const sizeLabel = formatPdfSizeLabel(ctx.pdfSizeBytes);
  if (sizeLabel) pdfParts.push(sizeLabel);
  const pdf = pdfParts.length ? pdfParts.join(' · ') : WORK_SUMMARY_NONE_LABEL;

  /** @type {string[]} */
  const findingParts = [];
  if (hasSpelling) findingParts.push(`맞춤법 ${ctx.lastSpellingFindingCount}건`);
  if (hasConsistency) {
    findingParts.push(`표기 통일 ${ctx.lastConsistencyFindingCount}건`);
  }
  const findings = findingParts.length
    ? findingParts.join(' · ')
    : WORK_SUMMARY_NONE_LABEL;

  return { lastWorked, pdf, findings };
}
