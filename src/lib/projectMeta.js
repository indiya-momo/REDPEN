/** @typedef {{
 *   pdfFileName?: string,
 *   pdfPageCount?: number,
 *   pdfSizeBytes?: number,
 *   pdfLinked?: boolean,
 *   lastWorkedAt?: string,
 *   lastSpellingFindingCount?: number,
 *   lastConsistencyFindingCount?: number,
 *   proofRevision?: string,
 *   formatLabel?: string,
 * }} ProjectContext */

export const MAX_PROJECT_PROOF_REVISION_LENGTH = 12;
export const MAX_PROJECT_FORMAT_LABEL_LENGTH = 16;

export const MAX_PROJECT_TAGS = 3;
export const MAX_PROJECT_TAG_LENGTH = 24;
export const MAX_PROJECT_MEMO_LENGTH = 200;

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeProjectTags(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const tag = String(item ?? '').trim();
    if (!tag || tag.length > MAX_PROJECT_TAG_LENGTH) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_PROJECT_TAGS) break;
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {string | undefined}
 */
export function normalizeProjectMemo(raw) {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_PROJECT_MEMO_LENGTH);
}

/**
 * @param {unknown} raw
 * @returns {ProjectContext | undefined}
 */
export function normalizeProjectContext(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = /** @type {Record<string, unknown>} */ (raw);
  /** @type {ProjectContext} */
  const ctx = {};

  if (typeof source.pdfFileName === 'string') {
    const name = source.pdfFileName.trim();
    if (name) ctx.pdfFileName = name;
  }

  const pageCount = source.pdfPageCount;
  if (
    typeof pageCount === 'number' &&
    Number.isFinite(pageCount) &&
    pageCount >= 1
  ) {
    ctx.pdfPageCount = Math.floor(pageCount);
  }

  const sizeBytes = source.pdfSizeBytes;
  if (typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes >= 0) {
    ctx.pdfSizeBytes = Math.floor(sizeBytes);
  }

  if (typeof source.lastWorkedAt === 'string') {
    const iso = source.lastWorkedAt.trim();
    if (iso && !Number.isNaN(Date.parse(iso))) {
      ctx.lastWorkedAt = iso;
    }
  }

  const spellCount = source.lastSpellingFindingCount;
  if (typeof spellCount === 'number' && Number.isFinite(spellCount) && spellCount >= 0) {
    ctx.lastSpellingFindingCount = Math.floor(spellCount);
  }

  const consistencyCount = source.lastConsistencyFindingCount;
  if (
    typeof consistencyCount === 'number' &&
    Number.isFinite(consistencyCount) &&
    consistencyCount >= 0
  ) {
    ctx.lastConsistencyFindingCount = Math.floor(consistencyCount);
  }

  if (typeof source.proofRevision === 'string') {
    const revision = source.proofRevision.trim();
    if (revision) {
      ctx.proofRevision = revision.slice(0, MAX_PROJECT_PROOF_REVISION_LENGTH);
    }
  }

  if (typeof source.formatLabel === 'string') {
    const format = source.formatLabel.trim();
    if (format) {
      ctx.formatLabel = format.slice(0, MAX_PROJECT_FORMAT_LABEL_LENGTH);
    }
  }

  if (source.pdfLinked === false) {
    ctx.pdfLinked = false;
  } else if (ctx.pdfFileName || ctx.pdfPageCount) {
    ctx.pdfLinked = true;
  }

  return Object.keys(ctx).length ? ctx : undefined;
}

/**
 * @param {ProjectContext | undefined} existing
 * @param {Partial<ProjectContext> | undefined} patch
 * @returns {ProjectContext | undefined}
 */
export function mergeProjectContext(existing, patch) {
  if (!patch || typeof patch !== 'object') {
    return normalizeProjectContext(existing);
  }
  return normalizeProjectContext({
    ...(existing ?? {}),
    ...patch,
  });
}

/**
 * PDF가 열려 있을 때 RuleSet 저장·작업 갱신용 스냅샷.
 *
 * @param {{
 *   pdfFileName?: string | null,
 *   pdfPageCount?: number,
 *   pdfSizeBytes?: number | null,
 *   lastSpellingFindingCount?: number,
 *   lastConsistencyFindingCount?: number,
 * }} input
 * @returns {ProjectContext | undefined}
 */
export function buildProjectContextSnapshot(input) {
  const fileName = String(input.pdfFileName ?? '').trim();
  const pageCount = input.pdfPageCount;
  const hasPdf =
    fileName.length > 0 &&
    typeof pageCount === 'number' &&
    Number.isFinite(pageCount) &&
    pageCount >= 1;
  if (!hasPdf) return undefined;

  return normalizeProjectContext({
    pdfFileName: fileName,
    pdfPageCount: Math.floor(pageCount),
    pdfSizeBytes:
      typeof input.pdfSizeBytes === 'number' && input.pdfSizeBytes >= 0
        ? Math.floor(input.pdfSizeBytes)
        : undefined,
    lastWorkedAt: new Date().toISOString(),
    lastSpellingFindingCount: input.lastSpellingFindingCount,
    lastConsistencyFindingCount: input.lastConsistencyFindingCount,
    pdfLinked: true,
  });
}

/**
 * 검수 화면 — PDF 스냅샷 또는 검수 건수만 갱신할 패치.
 *
 * @param {{
 *   pdfFileName?: string | null,
 *   pdfPageCount?: number,
 *   pdfSizeBytes?: number | null,
 *   spellingCheckDone?: boolean,
 *   consistencyCheckDone?: boolean,
 *   spellingFindingCount?: number,
 *   consistencyFindingCount?: number,
 * }} input
 * @returns {ProjectContext | undefined}
 */
export function buildProjectContextWorkPatch(input) {
  const snapshot = buildProjectContextSnapshot({
    pdfFileName: input.pdfFileName,
    pdfPageCount: input.pdfPageCount,
    pdfSizeBytes: input.pdfSizeBytes,
    lastSpellingFindingCount: input.spellingCheckDone
      ? input.spellingFindingCount
      : undefined,
    lastConsistencyFindingCount: input.consistencyCheckDone
      ? input.consistencyFindingCount
      : undefined,
  });
  if (snapshot) return snapshot;

  /** @type {ProjectContext} */
  const patch = {};
  if (input.spellingCheckDone) {
    patch.lastSpellingFindingCount = input.spellingFindingCount;
  }
  if (input.consistencyCheckDone) {
    patch.lastConsistencyFindingCount = input.consistencyFindingCount;
  }
  return Object.keys(patch).length ? normalizeProjectContext(patch) : undefined;
}
