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
 * 로컬 24시간 HH:MM
 * @param {string} iso
 * @returns {string | undefined}
 */
function formatWorkedClock(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
 * }} ProjectWorkSummary
 */

/**
 * @param {import('../lib/projectMeta.js').ProjectContext | undefined} ctx
 * @param {number} [nowMs]
 * @returns {ProjectWorkSummary | null} 표시할 기록이 하나도 없으면 null
 */
export function buildProjectWorkSummary(ctx, nowMs = Date.now()) {
  if (!ctx || typeof ctx !== 'object') return null;

  const hasAny = Boolean(ctx.lastWorkedAt) || Boolean(ctx.pdfFileName);
  if (!hasAny) return null;

  let lastWorked = WORK_SUMMARY_NONE_LABEL;
  if (ctx.lastWorkedAt) {
    const date = formatProjectCardDotDateFromIso(ctx.lastWorkedAt);
    const relative = relativeDaysLabel(ctx.lastWorkedAt, nowMs);
    const clock = formatWorkedClock(ctx.lastWorkedAt);
    if (date) {
      const dayPart = relative ? `${date} (${relative})` : date;
      lastWorked = clock ? `${dayPart} ${clock}` : dayPart;
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

  return { lastWorked, pdf };
}
