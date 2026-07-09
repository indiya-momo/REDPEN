import { mergeWorkHistories } from './projectWorkHistory.js';

/** @typedef {{
 *   pdfFileName?: string,
 *   pdfPageCount?: number,
 *   pdfSizeBytes?: number,
 *   pdfLinked?: boolean,
 *   lastWorkedAt?: string,
 *   lastSpellingFindingCount?: number,
 *   lastEditorReviewFindingCount?: number,
 *   lastBuiltinSpellingFindingCount?: number,
 *   lastConsistencyFindingCount?: number,
 *   lastConsistencyFindCount?: number,
 *   lastConsistencyUnifyCount?: number,
 *   lastConsistencyCommonStringCount?: number,
 *   lastBonBojoFindingCount?: number,
 *   formatLabel?: string,
 * }} ProjectContext */

export const MAX_PROJECT_FORMAT_LABEL_LENGTH = 16;

export const MAX_PROJECT_TAGS = 3;
export const MAX_PROJECT_TAG_LENGTH = 24;
export const MAX_PROJECT_MEMO_LENGTH = 200;
/** 기둥(맞춤법·본용언)별 메모 길이 상한 — 프로젝트 메모와 동일 */
export const MAX_PROJECT_PILLAR_MEMO_LENGTH = 200;

/** @typedef {{ spelling?: string, consistency?: string, auxiliary?: string }} ProjectPillarMemos */

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
 * 기둥별 메모 정규화 — 각 칸을 다듬고, 내용이 하나도 없으면 undefined.
 * @param {unknown} raw
 * @returns {ProjectPillarMemos | undefined}
 */
export function normalizeProjectPillarMemos(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = /** @type {Record<string, unknown>} */ (raw);
  /** @type {ProjectPillarMemos} */
  const out = {};
  for (const key of /** @type {const} */ (['spelling', 'consistency', 'auxiliary'])) {
    const value = source[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = trimmed.slice(0, MAX_PROJECT_PILLAR_MEMO_LENGTH);
  }
  return Object.keys(out).length ? out : undefined;
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

  const editorReviewCount = source.lastEditorReviewFindingCount;
  if (
    typeof editorReviewCount === 'number' &&
    Number.isFinite(editorReviewCount) &&
    editorReviewCount >= 0
  ) {
    ctx.lastEditorReviewFindingCount = Math.floor(editorReviewCount);
  }

  const builtinSpellingCount = source.lastBuiltinSpellingFindingCount;
  if (
    typeof builtinSpellingCount === 'number' &&
    Number.isFinite(builtinSpellingCount) &&
    builtinSpellingCount >= 0
  ) {
    ctx.lastBuiltinSpellingFindingCount = Math.floor(builtinSpellingCount);
  }

  const consistencyCount = source.lastConsistencyFindingCount;
  if (
    typeof consistencyCount === 'number' &&
    Number.isFinite(consistencyCount) &&
    consistencyCount >= 0
  ) {
    ctx.lastConsistencyFindingCount = Math.floor(consistencyCount);
  }

  const consistencyFindCount = source.lastConsistencyFindCount;
  if (
    typeof consistencyFindCount === 'number' &&
    Number.isFinite(consistencyFindCount) &&
    consistencyFindCount >= 0
  ) {
    ctx.lastConsistencyFindCount = Math.floor(consistencyFindCount);
  }

  const consistencyUnifyCount = source.lastConsistencyUnifyCount;
  if (
    typeof consistencyUnifyCount === 'number' &&
    Number.isFinite(consistencyUnifyCount) &&
    consistencyUnifyCount >= 0
  ) {
    ctx.lastConsistencyUnifyCount = Math.floor(consistencyUnifyCount);
  }

  const consistencyCommonStringCount = source.lastConsistencyCommonStringCount;
  if (
    typeof consistencyCommonStringCount === 'number' &&
    Number.isFinite(consistencyCommonStringCount) &&
    consistencyCommonStringCount >= 0
  ) {
    ctx.lastConsistencyCommonStringCount = Math.floor(consistencyCommonStringCount);
  }

  const bonBojoCount = source.lastBonBojoFindingCount;
  if (
    typeof bonBojoCount === 'number' &&
    Number.isFinite(bonBojoCount) &&
    bonBojoCount >= 0
  ) {
    ctx.lastBonBojoFindingCount = Math.floor(bonBojoCount);
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

/** @param {string | undefined} iso */
export function metaUpdatedAtMs(iso) {
  const ms = Date.parse(String(iso ?? ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * 규칙(savedAt) 병합 후 프로젝트 메타(tags·memo·교차·판형)를 잃지 않게 합친다.
 *
 * @param {import('./ruleSetsStorage.js').RuleSet} primary
 * @param {import('./ruleSetsStorage.js').RuleSet | undefined} secondary
 * @returns {import('./ruleSetsStorage.js').RuleSet}
 */
export function mergeRuleSetProjectMeta(primary, secondary) {
  if (!secondary || primary.id !== secondary.id) {
    return {
      ...primary,
      tags: normalizeProjectTags(primary.tags),
      memo: normalizeProjectMemo(primary.memo),
      pillarMemos: normalizeProjectPillarMemos(primary.pillarMemos),
      projectContext: normalizeProjectContext(primary.projectContext),
      workHistory: mergeWorkHistories(primary.workHistory, undefined),
    };
  }

  const primaryMetaMs = metaUpdatedAtMs(primary.metaUpdatedAt);
  const secondaryMetaMs = metaUpdatedAtMs(secondary.metaUpdatedAt);

  /** @type {string[]} */
  let tags;
  /** @type {string | undefined} */
  let memo;
  /** @type {ProjectPillarMemos | undefined} */
  let pillarMemos;
  /** @type {ProjectContext | undefined} */
  let projectContext;
  /** @type {string | undefined} */
  let metaUpdatedAt;

  if (primaryMetaMs > secondaryMetaMs) {
    tags = normalizeProjectTags(primary.tags);
    memo = normalizeProjectMemo(primary.memo);
    pillarMemos = normalizeProjectPillarMemos(primary.pillarMemos);
    projectContext = normalizeProjectContext(primary.projectContext);
    metaUpdatedAt = primary.metaUpdatedAt;
  } else if (secondaryMetaMs > primaryMetaMs) {
    tags = normalizeProjectTags(secondary.tags);
    memo = normalizeProjectMemo(secondary.memo);
    pillarMemos = normalizeProjectPillarMemos(secondary.pillarMemos);
    projectContext = normalizeProjectContext(secondary.projectContext);
    metaUpdatedAt = secondary.metaUpdatedAt;
  } else {
    const primaryTags = normalizeProjectTags(primary.tags);
    const secondaryTags = normalizeProjectTags(secondary.tags);
    tags = primaryTags.length ? primaryTags : secondaryTags;
    memo =
      normalizeProjectMemo(primary.memo) ??
      normalizeProjectMemo(secondary.memo);
    pillarMemos =
      normalizeProjectPillarMemos(primary.pillarMemos) ??
      normalizeProjectPillarMemos(secondary.pillarMemos);
    projectContext = normalizeProjectContext(
      mergeProjectContext(secondary.projectContext, primary.projectContext),
    );
    metaUpdatedAt = primary.metaUpdatedAt ?? secondary.metaUpdatedAt;
  }

  return {
    ...primary,
    tags,
    ...(memo !== undefined ? { memo } : {}),
    ...(pillarMemos !== undefined ? { pillarMemos } : {}),
    ...(projectContext !== undefined ? { projectContext } : {}),
    ...(metaUpdatedAt ? { metaUpdatedAt } : {}),
    workHistory: mergeWorkHistories(primary.workHistory, secondary.workHistory),
  };
}

/**
 * PDF가 열려 있을 때 RuleSet 저장·작업 갱신용 스냅샷.
 *
 * @param {{
 *   pdfFileName?: string | null,
 *   pdfPageCount?: number,
 *   pdfSizeBytes?: number | null,
 *   lastSpellingFindingCount?: number,
 *   lastEditorReviewFindingCount?: number,
 *   lastBuiltinSpellingFindingCount?: number,
 *   lastConsistencyFindingCount?: number,
 *   lastConsistencyFindCount?: number,
 *   lastConsistencyUnifyCount?: number,
 *   lastConsistencyCommonStringCount?: number,
 *   lastBonBojoFindingCount?: number,
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
    lastEditorReviewFindingCount: input.lastEditorReviewFindingCount,
    lastBuiltinSpellingFindingCount: input.lastBuiltinSpellingFindingCount,
    lastConsistencyFindingCount: input.lastConsistencyFindingCount,
    lastConsistencyFindCount: input.lastConsistencyFindCount,
    lastConsistencyUnifyCount: input.lastConsistencyUnifyCount,
    lastConsistencyCommonStringCount: input.lastConsistencyCommonStringCount,
    lastBonBojoFindingCount: input.lastBonBojoFindingCount,
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
 *   editorReviewFindingCount?: number,
 *   builtinSpellingFindingCount?: number,
 *   consistencyFindingCount?: number,
 *   consistencyFindCount?: number,
 *   consistencyUnifyCount?: number,
 *   consistencyCommonStringCount?: number,
 *   bonBojoFindingCount?: number,
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
    lastEditorReviewFindingCount: input.spellingCheckDone
      ? input.editorReviewFindingCount
      : undefined,
    lastBuiltinSpellingFindingCount: input.spellingCheckDone
      ? input.builtinSpellingFindingCount
      : undefined,
    lastConsistencyFindingCount: input.consistencyCheckDone
      ? input.consistencyFindingCount
      : undefined,
    lastConsistencyFindCount: input.consistencyCheckDone
      ? input.consistencyFindCount
      : undefined,
    lastConsistencyUnifyCount: input.consistencyCheckDone
      ? input.consistencyUnifyCount
      : undefined,
    lastConsistencyCommonStringCount: input.consistencyCheckDone
      ? input.consistencyCommonStringCount
      : undefined,
    lastBonBojoFindingCount: input.consistencyCheckDone
      ? input.bonBojoFindingCount
      : undefined,
  });
  if (snapshot) return snapshot;

  /** @type {ProjectContext} */
  const patch = {};
  if (input.spellingCheckDone) {
    patch.lastSpellingFindingCount = input.spellingFindingCount;
    patch.lastEditorReviewFindingCount = input.editorReviewFindingCount;
    patch.lastBuiltinSpellingFindingCount = input.builtinSpellingFindingCount;
  }
  if (input.consistencyCheckDone) {
    patch.lastConsistencyFindingCount = input.consistencyFindingCount;
    patch.lastConsistencyFindCount = input.consistencyFindCount;
    patch.lastConsistencyUnifyCount = input.consistencyUnifyCount;
    patch.lastConsistencyCommonStringCount = input.consistencyCommonStringCount;
    patch.lastBonBojoFindingCount = input.bonBojoFindingCount;
  }
  return Object.keys(patch).length ? normalizeProjectContext(patch) : undefined;
}
