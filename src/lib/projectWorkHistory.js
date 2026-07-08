/**
 * 프로젝트 검수 진행 이력 — 검수 1회(세션)마다 지적 건수를 한 줄씩 쌓는 장부.
 * 같은 세션 안(90초 이내) 재기록은 마지막 줄을 갱신한다.
 */

export const MAX_WORK_HISTORY_ENTRIES = 60;
/** 그래프에 표시할 최근 검수 세션 수 */
export const WORK_CHART_SESSION_COUNT = 3;
/** 꺾은선을 그릴 최소 세션 수 */
export const WORK_CHART_MIN_SESSIONS_FOR_LINE = 2;
/** 같은 세션으로 묶는 최대 간격(ms) — 검수 중 건수 갱신만 덮어쓴다 */
export const SESSION_COALESCE_MS = 90 * 1000;

/** @typedef {{
 *   at: string,
 *   editorReview?: number,
 *   spelling?: number,
 *   consistency?: number,
 *   consistencyFind?: number,
 *   consistencyUnify?: number,
 *   consistencyCommonString?: number,
 *   bonBojo?: number,
 * }} WorkHistoryEntry */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} value */
function normalizeCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

/** @param {unknown} value */
function normalizeAt(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) return undefined;
  return trimmed;
}

/**
 * @param {string} dateKey 'YYYY-MM-DD'
 * @returns {string}
 */
function legacyDateToAt(dateKey) {
  return `${dateKey}T12:00:00.000Z`;
}

/**
 * @param {WorkHistoryEntry} entry
 * @returns {number}
 */
function entryTimeMs(entry) {
  return Date.parse(entry.at);
}

/**
 * @param {WorkHistoryEntry} a
 * @param {WorkHistoryEntry} b
 * @returns {WorkHistoryEntry}
 */
function mergeEntryCounts(a, b) {
  /** @type {WorkHistoryEntry} */
  const out = { at: b.at };
  const editorReview = b.editorReview ?? a.editorReview;
  const spelling = b.spelling ?? a.spelling;
  const consistency = b.consistency ?? a.consistency;
  const consistencyFind = b.consistencyFind ?? a.consistencyFind;
  const consistencyUnify = b.consistencyUnify ?? a.consistencyUnify;
  const consistencyCommonString =
    b.consistencyCommonString ?? a.consistencyCommonString;
  const bonBojo = b.bonBojo ?? a.bonBojo;
  if (editorReview !== undefined) out.editorReview = editorReview;
  if (spelling !== undefined) out.spelling = spelling;
  if (consistency !== undefined) out.consistency = consistency;
  if (consistencyFind !== undefined) out.consistencyFind = consistencyFind;
  if (consistencyUnify !== undefined) out.consistencyUnify = consistencyUnify;
  if (consistencyCommonString !== undefined) {
    out.consistencyCommonString = consistencyCommonString;
  }
  if (bonBojo !== undefined) out.bonBojo = bonBojo;
  return out;
}

/**
 * @param {WorkHistoryEntry} last
 * @param {string} nextAt
 */
function shouldUpdateLastSession(last, nextAt) {
  const lastMs = entryTimeMs(last);
  const nextMs = Date.parse(nextAt);
  if (!Number.isFinite(lastMs) || !Number.isFinite(nextMs)) return false;
  return nextMs >= lastMs && nextMs - lastMs < SESSION_COALESCE_MS;
}

/**
 * ISO 시각 → 로컬 기준 'YYYY-MM-DD' 날짜 키.
 * @param {string | undefined} iso
 * @returns {string | undefined}
 */
export function workHistoryDateKeyFromIso(iso) {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return undefined;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 손상·중복 항목을 정리하고 시각순으로 정렬한다. 유효 항목이 없으면 undefined.
 * legacy `date` 필드는 `at`으로 승격한다. 같은 legacy 날짜는 탭별 병합 후 1세션.
 *
 * @param {unknown} raw
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function normalizeWorkHistory(raw) {
  if (!Array.isArray(raw)) return undefined;

  /** @type {WorkHistoryEntry[]} */
  const withAt = [];
  /** @type {Map<string, WorkHistoryEntry>} */
  const legacyByDate = new Map();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const source = /** @type {Record<string, unknown>} */ (item);
    const spelling = normalizeCount(source.spelling);
    const editorReview = normalizeCount(source.editorReview);
    const consistency = normalizeCount(source.consistency);
    const consistencyFind = normalizeCount(source.consistencyFind);
    const consistencyUnify = normalizeCount(source.consistencyUnify);
    const consistencyCommonString = normalizeCount(source.consistencyCommonString);
    const bonBojo = normalizeCount(source.bonBojo);
    if (
      editorReview === undefined &&
      spelling === undefined &&
      consistency === undefined &&
      consistencyFind === undefined &&
      consistencyUnify === undefined &&
      consistencyCommonString === undefined &&
      bonBojo === undefined
    ) {
      continue;
    }

    const at = normalizeAt(source.at);
    if (at) {
      /** @type {WorkHistoryEntry} */
      const entry = { at };
      if (editorReview !== undefined) entry.editorReview = editorReview;
      if (spelling !== undefined) entry.spelling = spelling;
      if (consistency !== undefined) entry.consistency = consistency;
      if (consistencyFind !== undefined) entry.consistencyFind = consistencyFind;
      if (consistencyUnify !== undefined) entry.consistencyUnify = consistencyUnify;
      if (consistencyCommonString !== undefined) {
        entry.consistencyCommonString = consistencyCommonString;
      }
      if (bonBojo !== undefined) entry.bonBojo = bonBojo;
      withAt.push(entry);
      continue;
    }

    const date = typeof source.date === 'string' ? source.date : '';
    if (!DATE_KEY_RE.test(date)) continue;
    const prev = legacyByDate.get(date);
    /** @type {WorkHistoryEntry} */
    const entry = { at: legacyDateToAt(date) };
    const nextEditorReview = editorReview ?? prev?.editorReview;
    const nextSpelling = spelling ?? prev?.spelling;
    const nextConsistency = consistency ?? prev?.consistency;
    const nextConsistencyFind = consistencyFind ?? prev?.consistencyFind;
    const nextConsistencyUnify = consistencyUnify ?? prev?.consistencyUnify;
    const nextConsistencyCommonString =
      consistencyCommonString ?? prev?.consistencyCommonString;
    const nextBonBojo = bonBojo ?? prev?.bonBojo;
    if (nextEditorReview !== undefined) entry.editorReview = nextEditorReview;
    if (nextSpelling !== undefined) entry.spelling = nextSpelling;
    if (nextConsistency !== undefined) entry.consistency = nextConsistency;
    if (nextConsistencyFind !== undefined) entry.consistencyFind = nextConsistencyFind;
    if (nextConsistencyUnify !== undefined) entry.consistencyUnify = nextConsistencyUnify;
    if (nextConsistencyCommonString !== undefined) {
      entry.consistencyCommonString = nextConsistencyCommonString;
    }
    if (nextBonBojo !== undefined) entry.bonBojo = nextBonBojo;
    legacyByDate.set(date, entry);
  }

  const out = [...withAt, ...legacyByDate.values()]
    .sort((a, b) => entryTimeMs(a) - entryTimeMs(b))
    .slice(-MAX_WORK_HISTORY_ENTRIES);
  return out.length ? out : undefined;
}

/**
 * 검수 완료 1건을 이력에 기입한다. 건수가 하나도 없으면 기존 이력만 정리해 돌려준다.
 *
 * @param {unknown} history 기존 이력(손상 가능)
 * @param {{ 
 *   editorReview?: number,
 *   spelling?: number,
 *   consistency?: number,
 *   consistencyFind?: number,
 *   consistencyUnify?: number,
 *   consistencyCommonString?: number,
 *   bonBojo?: number,
 * }} counts
 * @param {string} [atIso] 기록 시각(기본: 지금)
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function appendWorkHistoryEntry(history, counts, atIso) {
  const at = normalizeAt(atIso) ?? new Date().toISOString();
  const editorReview = normalizeCount(counts?.editorReview);
  const spelling = normalizeCount(counts?.spelling);
  const consistency = normalizeCount(counts?.consistency);
  const consistencyFind = normalizeCount(counts?.consistencyFind);
  const consistencyUnify = normalizeCount(counts?.consistencyUnify);
  const consistencyCommonString = normalizeCount(counts?.consistencyCommonString);
  const bonBojo = normalizeCount(counts?.bonBojo);
  const base = normalizeWorkHistory(history) ?? [];
  if (
    editorReview === undefined &&
    spelling === undefined &&
    consistency === undefined &&
    consistencyFind === undefined &&
    consistencyUnify === undefined &&
    consistencyCommonString === undefined &&
    bonBojo === undefined
  ) {
    return base.length ? base : undefined;
  }

  /** @type {WorkHistoryEntry} */
  const entry = { at };
  if (editorReview !== undefined) entry.editorReview = editorReview;
  if (spelling !== undefined) entry.spelling = spelling;
  if (consistency !== undefined) entry.consistency = consistency;
  if (consistencyFind !== undefined) entry.consistencyFind = consistencyFind;
  if (consistencyUnify !== undefined) entry.consistencyUnify = consistencyUnify;
  if (consistencyCommonString !== undefined) {
    entry.consistencyCommonString = consistencyCommonString;
  }
  if (bonBojo !== undefined) entry.bonBojo = bonBojo;

  const last = base[base.length - 1];
  if (last && shouldUpdateLastSession(last, at)) {
    return normalizeWorkHistory([
      ...base.slice(0, -1),
      mergeEntryCounts(last, entry),
    ]);
  }
  return normalizeWorkHistory([...base, entry]);
}

/**
 * 두 이력을 시각 기준으로 합친다. 같은 `at`은 primary 값이 우선한다.
 *
 * @param {unknown} primary
 * @param {unknown} secondary
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function mergeWorkHistories(primary, secondary) {
  const a = normalizeWorkHistory(secondary) ?? [];
  const b = normalizeWorkHistory(primary) ?? [];
  if (!a.length && !b.length) return undefined;

  /** @type {Map<string, WorkHistoryEntry>} */
  const byAt = new Map();
  for (const entry of a) byAt.set(entry.at, entry);
  for (const entry of b) {
    const prev = byAt.get(entry.at);
    byAt.set(entry.at, prev ? mergeEntryCounts(prev, entry) : entry);
  }
  return normalizeWorkHistory([...byAt.values()]);
}

/**
 * 그래프용 — 최근 N개 검수 세션.
 *
 * @param {unknown} history
 * @param {number} [count]
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function selectRecentWorkSessions(history, count = WORK_CHART_SESSION_COUNT) {
  const normalized = normalizeWorkHistory(history);
  if (!normalized?.length) return undefined;
  return normalized.slice(-Math.max(1, count));
}

/**
 * 그래프 표시용 이력 — 이력이 비어 있으면 마지막 스냅샷 1점으로 대신한다.
 *
 * @param {unknown} history
 * @param {import('./projectMeta.js').ProjectContext | undefined} ctx
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function buildDisplayWorkHistory(history, ctx) {
  const recent = selectRecentWorkSessions(history);
  if (recent?.length) return recent;
  if (!ctx?.lastWorkedAt) return undefined;
  return appendWorkHistoryEntry(
    undefined,
    {
      editorReview: ctx.lastEditorReviewFindingCount,
      spelling: ctx.lastBuiltinSpellingFindingCount ?? ctx.lastSpellingFindingCount,
      consistencyFind: ctx.lastConsistencyFindCount,
      consistencyUnify: ctx.lastConsistencyUnifyCount,
      consistencyCommonString: ctx.lastConsistencyCommonStringCount,
      consistency: ctx.lastConsistencyFindingCount,
      bonBojo: ctx.lastBonBojoFindingCount,
    },
    ctx.lastWorkedAt,
  );
}
