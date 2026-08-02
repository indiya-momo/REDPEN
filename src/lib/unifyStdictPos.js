/**
 * 표준국어대사전 품사 2차 — 조회·판정·목록 이동.
 * @see project-docs/unify-stdict-pos-review-design-2026-07-31.md
 */

import { looksLikePredicateKey } from './unifyPredicateBucket.js';
import { classifyUnifyListStem } from './unifyListStemTriage.js';
import { sortClusterGroups } from './unifyCandidateGrouping.js';

/**
 * @param {string} key
 * @returns {string}
 */
export function hangulOnlyKey(key) {
  return String(key ?? '')
    .normalize('NFC')
    .replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * 보조용언 카드는 본용언 쪽만 조회.
 * 띄움이면 첫 어절(`계산해 보자`→`계산해`), 붙임이면 `…해보자`→`…해`.
 * @param {{ key?: string, variants?: string[], auxReview?: { stemSpaced?: string, stemKey?: string } | null }} cluster
 */
export function queryStemForCluster(cluster) {
  if (cluster?.auxReview) {
    const spaced = (cluster.variants ?? []).find((v) => /\s/.test(String(v)));
    if (spaced) {
      const first = String(spaced).trim().split(/\s+/)[0];
      const h = hangulOnlyKey(first);
      if (h.length >= 2) return h;
    }
    const glued = hangulOnlyKey(cluster?.key ?? '');
    // 계산해보자·답해보자 → 계산해·답해 (「보자」 제거)
    if (glued.endsWith('보자') && glued.length > 3) {
      return glued.slice(0, -2);
    }
    const auxGlued = hangulOnlyKey(cluster.auxReview.stemKey ?? '');
    if (
      auxGlued.length >= 2 &&
      glued.endsWith(auxGlued) &&
      glued.length > auxGlued.length
    ) {
      return glued.slice(0, -auxGlued.length);
    }
  }
  return hangulOnlyKey(cluster?.key ?? '') || String(cluster?.key ?? '').trim();
}

/**
 * 활용형 → 사전(기본형) 후보. 용언 경로에서만 사용. 명사에 하다를 붙이지 않음.
 * 예: 날아→날다, 들어→들다, 대어→대다, 밀려→밀리다, 돌아가→돌아가다, 가정해→가정하다
 * @param {string} q
 * @returns {string[]}
 */
export function lemmaCandidatesForConjugation(q) {
  const h = hangulOnlyKey(q);
  if (h.length < 2) return [];
  if (h.endsWith('다')) return [];

  /** @type {string[]} */
  const out = [];
  const push = (lemma) => {
    if (!lemma || lemma === h || lemma.length < 2) return;
    if (!out.includes(lemma)) out.push(lemma);
  };

  // 계산해보자·답해보자 → 계산하다·답하다 (본용언+보조 붙임형)
  if (h.endsWith('해보자') && h.length >= 4) {
    push(`${h.slice(0, -3)}하다`);
    return out;
  }

  if (h.endsWith('해') && h.length >= 3) {
    push(`${h.slice(0, -1)}하다`);
    return out;
  }

  // 돌아가·들어가 — 가다 계열 연결형
  const digraphs = [
    '아가',
    '어가',
    '여가',
    '해가',
    '혀가',
    '워가',
    '와가',
    '려가',
    '져가',
  ];
  for (const d of digraphs) {
    if (h.endsWith(d) && h.length > d.length) {
      push(`${h}다`);
      return out;
    }
  }

  // 밀려·알려 — 리다 활용 (려 ← 리+어)
  if (h.endsWith('려') && h.length >= 2) {
    const stem = h.slice(0, -1);
    push(`${stem}리다`);
    push(`${stem}다`);
    return out;
  }

  // 빠져·깨져 — 지다 활용 (져 ← 지+어). 끝만 떼면 빠다 오생성.
  if (h.endsWith('져') && h.length >= 2) {
    const stem = h.slice(0, -1);
    push(`${stem}지다`);
    push(`${stem}다`);
    return out;
  }

  // 날아·들어·대어·만들어 — 끝 아/어/여… 제거 후 다
  const endSyllables = ['아', '어', '여', '혀', '켜', '펴', '워', '와'];
  for (const end of endSyllables) {
    if (h.endsWith(end) && h.length > end.length) {
      push(`${h.slice(0, -1)}다`);
      return out;
    }
  }

  push(`${h}다`);
  return out;
}

/**
 * 명사 → 어근 그대로. 용언 → 사전형 우선(+ 실패 시 원형).
 * @param {StdictPosTarget} target
 * @returns {string[]}
 */
export function buildStdictQueryList(target) {
  const q = hangulOnlyKey(target.q) || String(target.q ?? '').trim();
  if (!q) return [];
  if (!target.allowLemmaTry) return [q];
  const lemmas = lemmaCandidatesForConjugation(q);
  if (!lemmas.length) return [q];
  return [...lemmas, q];
}

/**
 * @param {unknown} data
 * @returns {{ word: string, pos: string }[]}
 */
export function parseStdictSearchHits(data) {
  if (!data || typeof data !== 'object') return [];
  const root = /** @type {Record<string, unknown>} */ (data);
  if (root.error || root.error_code) return [];
  const channel =
    root.channel && typeof root.channel === 'object'
      ? /** @type {Record<string, unknown>} */ (root.channel)
      : root;
  const itemsRaw = channel.item;
  const list = Array.isArray(itemsRaw)
    ? itemsRaw
    : itemsRaw
      ? [itemsRaw]
      : [];
  /** @type {{ word: string, pos: string }[]} */
  const hits = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const it = /** @type {Record<string, unknown>} */ (raw);
    const word = String(it.word ?? '')
      .replace(/[-^]/g, '')
      .trim();
    const sense = it.sense;
    const senses = Array.isArray(sense) ? sense : sense ? [sense] : [];
    /** @type {string[]} */
    const poses = [];
    // 표준국어대사전 JSON: 품사가 item.pos 에 있고 sense 에는 없을 때가 많음
    if (it.pos) poses.push(String(it.pos).trim());
    for (const s of senses) {
      if (!s || typeof s !== 'object') continue;
      const pos = String(
        /** @type {Record<string, unknown>} */ (s).pos ?? '',
      ).trim();
      if (pos) poses.push(pos);
    }
    const uniquePos = [...new Set(poses.filter(Boolean))];
    for (const pos of uniquePos) {
      hits.push({ word: word || '?', pos });
    }
  }
  const seen = new Set();
  return hits.filter((h) => {
    const k = `${h.word}|${h.pos}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * @param {{ word: string, pos: string }[]} hits
 * @returns {'noun' | 'predicate' | 'mixed' | 'missing'}
 */
export function verdictFromStdictHits(hits) {
  if (!hits?.length) return 'missing';
  const poses = hits.map((h) => h.pos);
  const isPred = poses.some((p) => /동사|형용사|보조/.test(p));
  const isNoun = poses.some((p) =>
    /명사|대명사|수사|의존\s*명사/.test(p),
  );
  if (isPred && isNoun) return 'mixed';
  if (isPred) return 'predicate';
  if (isNoun) return 'noun';
  return 'missing';
}

/**
 * @typedef {{
 *   id: string,
 *   q: string,
 *   allowLemmaTry: boolean,
 *   kind: 'series' | 'cluster',
 *   seriesAffixType?: string,
 *   seriesAffix?: string,
 *   clusterKey?: string,
 *   label: string,
 *   ruleKind: 'certain_noun' | 'ambiguous',
 * }} StdictPosTarget
 */

/**
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @returns {StdictPosTarget[]}
 */
export function enqueueStdictPosTargets(groups) {
  /** @type {StdictPosTarget[]} */
  const out = [];
  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const affix = String(group.affix ?? '');
      const ruleKind =
        group.dictPos === 'predicate'
          ? 'ambiguous'
          : group.dictPos === 'noun'
            ? 'certain_noun'
            : classifyUnifyListStem(affix);
      if (ruleKind === 'drop_rule') continue;
      out.push({
        id: `series:${group.affixType}:${affix}`,
        q: hangulOnlyKey(affix) || affix,
        allowLemmaTry:
          ruleKind === 'ambiguous' || looksLikePredicateKey(affix),
        kind: 'series',
        seriesAffixType: group.affixType,
        seriesAffix: affix,
        label: group.label || `${affix}@`,
        ruleKind: ruleKind === 'ambiguous' ? 'ambiguous' : 'certain_noun',
      });
      continue;
    }
    if (group.type === 'predicate' || group.type === 'single') {
      for (const cluster of group.clusters ?? []) {
        const q = queryStemForCluster(cluster);
        if (!q) continue;
        const ruleKind =
          group.type === 'predicate'
            ? 'ambiguous'
            : classifyUnifyListStem(q) === 'ambiguous'
              ? 'ambiguous'
              : 'certain_noun';
        out.push({
          id: `${group.type}:${cluster.key}`,
          q,
          allowLemmaTry:
            ruleKind === 'ambiguous' ||
            looksLikePredicateKey(q) ||
            Boolean(cluster.auxReview),
          kind: 'cluster',
          clusterKey: cluster.key,
          label: cluster.key,
          ruleKind,
        });
      }
    }
  }
  return out;
}

/**
 * @param {string} q
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function fetchStdictExact(q, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const url = `/api/stdict?q=${encodeURIComponent(q)}`;
  const res = await fetchImpl(url, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 503) {
    return { error: 'STDICT_KEY_MISSING', hits: [] };
  }
  if (!res.ok) {
    return { error: `HTTP_${res.status}`, hits: [] };
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'BAD_JSON', hits: [] };
  }
  return { hits: parseStdictSearchHits(data), error: null };
}

/**
 * @param {StdictPosTarget} target
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function resolveStdictPosForTarget(target, opts = {}) {
  const queries = buildStdictQueryList(target);
  if (!queries.length) {
    return {
      id: target.id,
      q: target.q,
      verdict: /** @type {const} */ ('missing'),
      error: null,
      poses: [],
      label: target.label,
      ruleKind: target.ruleKind,
      kind: target.kind,
      seriesAffixType: target.seriesAffixType,
      seriesAffix: target.seriesAffix,
      clusterKey: target.clusterKey,
    };
  }

  /** @type {{ q: string, verdict: 'noun' | 'predicate' | 'mixed' | 'missing', hits: { word: string, pos: string }[], error: string | null } | null} */
  let fallback = null;

  for (const usedQ of queries) {
    const result = await fetchStdictExact(usedQ, opts);
    if (result.error === 'STDICT_KEY_MISSING') {
      return {
        id: target.id,
        q: usedQ,
        verdict: /** @type {const} */ ('error'),
        error: result.error,
        label: target.label,
        ruleKind: target.ruleKind,
        kind: target.kind,
        seriesAffixType: target.seriesAffixType,
        seriesAffix: target.seriesAffix,
        clusterKey: target.clusterKey,
      };
    }
    const verdict = verdictFromStdictHits(result.hits);
    if (verdict === 'predicate') {
      return {
        id: target.id,
        q: usedQ,
        verdict,
        error: result.error,
        poses: result.hits?.map((h) => h.pos) ?? [],
        label: target.label,
        ruleKind: target.ruleKind,
        kind: target.kind,
        seriesAffixType: target.seriesAffixType,
        seriesAffix: target.seriesAffix,
        clusterKey: target.clusterKey,
      };
    }
    if (verdict === 'missing') continue;
    // 명사·혼재 — 용언 경로면 다음 사전형 후보를 더 보고, 명사 경로는 여기서 확정
    if (!fallback) {
      fallback = {
        q: usedQ,
        verdict,
        hits: result.hits ?? [],
        error: result.error,
      };
    }
    if (!target.allowLemmaTry) break;
  }

  const usedQ = fallback?.q ?? queries[queries.length - 1];
  const verdict = fallback?.verdict ?? 'missing';
  return {
    id: target.id,
    q: usedQ,
    verdict,
    error: fallback?.error ?? null,
    poses: fallback?.hits?.map((h) => h.pos) ?? [],
    label: target.label,
    ruleKind: target.ruleKind,
    kind: target.kind,
    seriesAffixType: target.seriesAffixType,
    seriesAffix: target.seriesAffix,
    clusterKey: target.clusterKey,
  };
}

/**
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, concurrency?: number }} [opts]
 */
export async function runStdictPosReviewOnClusterGroups(groups, opts = {}) {
  const targets = enqueueStdictPosTargets(groups);
  /** @type {Awaited<ReturnType<typeof resolveStdictPosForTarget>>[]} */
  const resolved = [];
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  for (let i = 0; i < targets.length; i += concurrency) {
    const chunk = targets.slice(i, i + concurrency);
    const part = await Promise.all(
      chunk.map((t) => resolveStdictPosForTarget(t, opts)),
    );
    resolved.push(...part);
  }

  /** @type {Map<string, 'predicate'>} */
  const seriesToPredicate = new Map();
  /** @type {Set<string>} */
  const clusterKeysToPredicate = new Set();
  /** @type {{ id: string, label: string, reason?: string }[]} */
  const movedNounToPredicate = [];
  /** @type {{ id: string, label: string, reason?: string }[]} */
  const confirmedNoun = [];
  /** @type {{ id: string, label: string, reason?: string }[]} */
  const confirmedPredicate = [];
  /** @type {{ id: string, label: string, reason?: string }[]} */
  const missing = [];

  for (const r of resolved) {
    if (r.verdict === 'error') continue;
    if (r.verdict === 'missing' || r.verdict === 'mixed') {
      missing.push({
        id: r.id,
        label: r.label,
        reason: r.verdict === 'mixed' ? '혼재' : '미등재',
      });
      continue;
    }
    if (r.verdict === 'noun') {
      confirmedNoun.push({ id: r.id, label: r.label });
      continue;
    }
    // predicate
    if (r.kind === 'series' && r.seriesAffix != null && r.seriesAffixType) {
      const sid = `series:${r.seriesAffixType}:${r.seriesAffix}`;
      seriesToPredicate.set(sid, 'predicate');
      if (r.ruleKind === 'certain_noun') {
        movedNounToPredicate.push({
          id: r.id,
          label: r.label,
          reason: `사전 ${r.q}`,
        });
      } else {
        confirmedPredicate.push({
          id: r.id,
          label: r.label,
          reason: `사전 ${r.q}`,
        });
      }
    } else if (r.clusterKey) {
      clusterKeysToPredicate.add(r.clusterKey);
      if (r.ruleKind === 'certain_noun') {
        movedNounToPredicate.push({
          id: r.id,
          label: r.label,
          reason: `사전 ${r.q}`,
        });
      } else {
        confirmedPredicate.push({
          id: r.id,
          label: r.label,
          reason: `사전 ${r.q}`,
        });
      }
    }
  }

  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const next = [];
  /** @type {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} */
  const movedClusters = [];

  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const sid = `series:${group.affixType}:${group.affix}`;
      if (seriesToPredicate.has(sid)) {
        next.push({ ...group, dictPos: 'predicate' });
      } else {
        next.push(group);
      }
      continue;
    }
    if (group.type === 'single') {
      /** @type {typeof group.clusters} */
      const stay = [];
      for (const c of group.clusters ?? []) {
        if (clusterKeysToPredicate.has(c.key)) movedClusters.push(c);
        else stay.push(c);
      }
      if (stay.length) {
        next.push({ type: 'single', clusters: stay });
      }
      continue;
    }
    if (group.type === 'predicate') {
      next.push(group);
    }
  }

  if (movedClusters.length) {
    const existingPred = next.find((g) => g.type === 'predicate');
    if (existingPred && existingPred.type === 'predicate') {
      existingPred.clusters = [...existingPred.clusters, ...movedClusters];
    } else {
      next.push({ type: 'predicate', clusters: movedClusters });
    }
  }

  return {
    groups: sortClusterGroups(next),
    summary: {
      ran: true,
      reviewed: resolved.filter((r) => r.verdict !== 'error').length,
      failed: resolved.filter((r) => r.verdict === 'error').length,
      movedNounToPredicate,
      confirmedNoun,
      confirmedPredicate,
      missing,
      ...(resolved.some((r) => r.error === 'STDICT_KEY_MISSING')
        ? { error: 'STDICT_KEY_MISSING' }
        : {}),
    },
    marks: {
      seriesIds: [...seriesToPredicate.keys()],
      clusterKeys: [...clusterKeysToPredicate],
    },
  };
}

/**
 * 찾기 후 재구성되는 그룹에 사전 용언 마크를 다시 적용.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ seriesIds?: string[], clusterKeys?: string[] }} marks
 */
export function applyStdictPosMarksToGroups(groups, marks = {}) {
  const seriesSet = new Set(marks.seriesIds ?? []);
  const keySet = new Set(marks.clusterKeys ?? []);
  if (!seriesSet.size && !keySet.size) return groups ?? [];

  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const next = [];
  /** @type {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} */
  const movedClusters = [];

  for (const group of groups ?? []) {
    if (group.type === 'series') {
      const sid = `series:${group.affixType}:${group.affix}`;
      if (seriesSet.has(sid)) {
        next.push({ ...group, dictPos: 'predicate' });
      } else {
        next.push(group);
      }
      continue;
    }
    if (group.type === 'single') {
      /** @type {typeof group.clusters} */
      const stay = [];
      for (const c of group.clusters ?? []) {
        if (keySet.has(c.key)) movedClusters.push(c);
        else stay.push(c);
      }
      if (stay.length) next.push({ type: 'single', clusters: stay });
      continue;
    }
    if (group.type === 'predicate') next.push(group);
  }

  if (movedClusters.length) {
    const existingPred = next.find((g) => g.type === 'predicate');
    if (existingPred && existingPred.type === 'predicate') {
      const seen = new Set(existingPred.clusters.map((c) => c.key));
      existingPred.clusters = [
        ...existingPred.clusters,
        ...movedClusters.filter((c) => !seen.has(c.key)),
      ];
    } else {
      next.push({ type: 'predicate', clusters: movedClusters });
    }
  }

  return sortClusterGroups(next);
}
