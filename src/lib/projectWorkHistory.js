/**
 * 프로젝트 검수 진행 이력 — 검수를 마칠 때마다 날짜별 지적 건수를 한 줄씩 쌓는 장부.
 * 같은 날짜에 여러 번 검수하면 그날 값(탭별)을 덮어쓴다.
 */

export const MAX_WORK_HISTORY_ENTRIES = 60;

/** @typedef {{ date: string, spelling?: number, consistency?: number }} WorkHistoryEntry */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} value */
function normalizeCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

/** @param {number} n */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * ISO 시각 → 로컬 기준 'YYYY-MM-DD' 날짜 키.
 * @param {string | undefined} iso
 * @returns {string | undefined}
 */
export function workHistoryDateKeyFromIso(iso) {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 손상·중복 항목을 정리하고 날짜순으로 정렬한다. 유효 항목이 없으면 undefined.
 * 같은 날짜가 여럿이면 뒤의 값이 앞의 값을 탭별로 덮어쓴다.
 *
 * @param {unknown} raw
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function normalizeWorkHistory(raw) {
  if (!Array.isArray(raw)) return undefined;

  /** @type {Map<string, WorkHistoryEntry>} */
  const byDate = new Map();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const source = /** @type {Record<string, unknown>} */ (item);
    const date = typeof source.date === 'string' ? source.date : '';
    if (!DATE_KEY_RE.test(date)) continue;
    const spelling = normalizeCount(source.spelling);
    const consistency = normalizeCount(source.consistency);
    if (spelling === undefined && consistency === undefined) continue;

    const prev = byDate.get(date);
    /** @type {WorkHistoryEntry} */
    const entry = { date };
    const nextSpelling = spelling ?? prev?.spelling;
    const nextConsistency = consistency ?? prev?.consistency;
    if (nextSpelling !== undefined) entry.spelling = nextSpelling;
    if (nextConsistency !== undefined) entry.consistency = nextConsistency;
    byDate.set(date, entry);
  }

  const out = [...byDate.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-MAX_WORK_HISTORY_ENTRIES);
  return out.length ? out : undefined;
}

/**
 * 검수 완료 1건을 이력에 기입한다. 건수가 하나도 없으면 기존 이력만 정리해 돌려준다.
 *
 * @param {unknown} history 기존 이력(손상 가능)
 * @param {{ spelling?: number, consistency?: number }} counts
 * @param {string} [atIso] 기록 시각(기본: 지금)
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function appendWorkHistoryEntry(history, counts, atIso) {
  const date = workHistoryDateKeyFromIso(atIso ?? new Date().toISOString());
  const spelling = normalizeCount(counts?.spelling);
  const consistency = normalizeCount(counts?.consistency);
  const base = Array.isArray(history) ? history : [];
  if (!date || (spelling === undefined && consistency === undefined)) {
    return normalizeWorkHistory(base);
  }

  /** @type {WorkHistoryEntry} */
  const entry = { date };
  if (spelling !== undefined) entry.spelling = spelling;
  if (consistency !== undefined) entry.consistency = consistency;
  return normalizeWorkHistory([...base, entry]);
}

/**
 * 두 이력을 날짜 기준으로 합친다. 같은 날짜는 primary 값이 우선한다.
 *
 * @param {unknown} primary
 * @param {unknown} secondary
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function mergeWorkHistories(primary, secondary) {
  const a = Array.isArray(secondary) ? secondary : [];
  const b = Array.isArray(primary) ? primary : [];
  // normalize는 뒤의 값을 우선하므로 secondary → primary 순서로 잇는다.
  return normalizeWorkHistory([...a, ...b]);
}

/**
 * 그래프 표시용 이력 — 이력이 비어 있으면 마지막 스냅샷 1점으로 대신한다.
 *
 * @param {unknown} history
 * @param {import('./projectMeta.js').ProjectContext | undefined} ctx
 * @returns {WorkHistoryEntry[] | undefined}
 */
export function buildDisplayWorkHistory(history, ctx) {
  const normalized = normalizeWorkHistory(history);
  if (normalized?.length) return normalized;
  if (!ctx?.lastWorkedAt) return undefined;
  return appendWorkHistoryEntry(
    undefined,
    {
      spelling: ctx.lastSpellingFindingCount,
      consistency: ctx.lastConsistencyFindingCount,
    },
    ctx.lastWorkedAt,
  );
}
