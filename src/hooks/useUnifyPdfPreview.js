/**
 * 표기 통일 PDF 미리보기 전용 — ListUI·Navigation과 분리.
 *
 * listReady  → publish(page)
 * chosenChanged → remap()   (enrich 금지)
 * pageChanged → publish(page)
 * clear / hidden → publish 또는 clear
 */
import { useCallback, useRef, useState } from 'react';
import {
  applyUnifyCandidatePreviewChoices,
  buildUnifyCandidatePreviewGroups,
} from '../lib/unifyCandidateDiscover.js';

/**
 * @typedef {import('../lib/unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @param {UnifySpacingCluster} cluster
 * @param {number} pageNum
 */
function clusterHasOccurrenceOnPage(cluster, pageNum) {
  for (const variant of cluster.variants ?? []) {
    const occs = cluster.occurrencesByVariant?.[variant] ?? [];
    for (const o of occs) {
      if (o.pageNum === pageNum) return true;
    }
  }
  return false;
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @param {number} pageNum
 * @param {Set<string>} hidden
 */
function clustersForPage(clusters, pageNum, hidden) {
  return (clusters ?? []).filter((c) => {
    if (hidden.has(c.key)) return false;
    return pageNum <= 0 || clusterHasOccurrenceOnPage(c, pageNum);
  });
}

/**
 * @param {UnifySpacingCluster[]} clusters
 */
function keysSigOf(clusters) {
  return (clusters ?? [])
    .map((c) => c.key)
    .sort()
    .join('\0');
}

/**
 * @param {{
 *   pageTexts?: import('../lib/pdfService.js').PageData[],
 * }} [opts]
 */
export function useUnifyPdfPreview({ pageTexts = [] } = {}) {
  const [groups, setGroups] = useState(
    /** @type {import('../lib/ruleEngine.js').GroupedResult[]} */ ([]),
  );
  const cacheRef = useRef({
    /** @type {import('../lib/ruleEngine.js').GroupedResult[]} */
    groups: [],
    keysSig: '',
    pageNum: 0,
  });
  const snapshotRef = useRef({
    /** @type {UnifySpacingCluster[]} */
    clusters: [],
    /** @type {Map<string, string>} */
    chosenByKey: new Map(),
    /** @type {Set<string>} */
    hiddenKeys: new Set(),
    active: false,
  });
  const pageTextsRef = useRef(pageTexts);
  pageTextsRef.current = pageTexts;

  const clear = useCallback(() => {
    snapshotRef.current = {
      clusters: [],
      chosenByKey: new Map(),
      hiddenKeys: new Set(),
      active: false,
    };
    cacheRef.current = { groups: [], keysSig: '', pageNum: 0 };
    setGroups([]);
  }, []);

  /**
   * 쪽 단위 미리보기 조립. page가 같으면 remap, 다르면 rebuild.
   * @param {number} pageNum
   * @param {UnifySpacingCluster[]} [clusters]
   * @param {Map<string, string>} [chosenByKey]
   * @param {Set<string>} [hiddenKeys]
   */
  const publish = useCallback(
    (pageNum, clusters, chosenByKey, hiddenKeys) => {
      const page = Number(pageNum) || 0;
      const snap = snapshotRef.current;
      const nextClusters =
        clusters !== undefined ? (clusters ?? []) : snap.clusters;
      const nextChosen =
        chosenByKey !== undefined
          ? (chosenByKey ?? new Map())
          : snap.chosenByKey;
      const nextHidden =
        hiddenKeys !== undefined
          ? (hiddenKeys ?? new Set())
          : snap.hiddenKeys;

      snapshotRef.current = {
        clusters: nextClusters,
        chosenByKey: nextChosen,
        hiddenKeys: nextHidden,
        active: true,
      };

      const pageClusters = clustersForPage(nextClusters, page, nextHidden);
      if (!pageClusters.length || page <= 0) {
        cacheRef.current = { groups: [], keysSig: '', pageNum: page };
        setGroups([]);
        return [];
      }

      const keysSig = keysSigOf(pageClusters);
      const cache = cacheRef.current;
      const pageChanged = cache.pageNum !== page;
      const keysChanged = cache.keysSig !== keysSig;
      const canRemap =
        !pageChanged &&
        !keysChanged &&
        cache.groups.length > 0 &&
        cache.groups.every((g) => g.unifyClusterKey);

      /** @type {import('../lib/ruleEngine.js').GroupedResult[]} */
      let nextGroups;
      if (canRemap) {
        nextGroups = applyUnifyCandidatePreviewChoices(
          cache.groups,
          nextChosen,
          pageClusters,
        );
      } else {
        nextGroups = buildUnifyCandidatePreviewGroups(pageClusters, {
          registeredByKey: nextChosen,
          pages: pageTextsRef.current,
          pageNum: page,
        });
      }

      cacheRef.current = {
        groups: nextGroups,
        keysSig,
        pageNum: page,
      };
      setGroups(nextGroups.slice());
      return nextGroups;
    },
    [],
  );

  /**
   * 선택만 반영 — occurrence 재생성 없음.
   * @param {Map<string, string>} chosenByKey
   */
  const remap = useCallback((chosenByKey) => {
    const snap = snapshotRef.current;
    if (!snap.active) return;
    const nextChosen = chosenByKey ?? new Map();
    snap.chosenByKey = nextChosen;
    const cache = cacheRef.current;
    if (!cache.groups.length || cache.pageNum <= 0) {
      publish(cache.pageNum || 1, snap.clusters, nextChosen, snap.hiddenKeys);
      return;
    }
    const pageClusters = clustersForPage(
      snap.clusters,
      cache.pageNum,
      snap.hiddenKeys,
    );
    const nextGroups = applyUnifyCandidatePreviewChoices(
      cache.groups,
      nextChosen,
      pageClusters,
    );
    cacheRef.current = { ...cache, groups: nextGroups };
    setGroups(nextGroups.slice());
  }, [publish]);

  /**
   * PDF 표시 체크 변경 — 현재 쪽 publish.
   * @param {Set<string>} hiddenKeys
   */
  const setHiddenKeys = useCallback(
    (hiddenKeys) => {
      const snap = snapshotRef.current;
      if (!snap.active) return;
      publish(
        cacheRef.current.pageNum || 1,
        snap.clusters,
        snap.chosenByKey,
        hiddenKeys ?? new Set(),
      );
    },
    [publish],
  );

  /**
   * 쪽 이동 — 그 쪽만 rebuild (keys 같으면 pageChanged로 rebuild).
   * @param {number} pageNum
   */
  const onPageChange = useCallback(
    (pageNum) => {
      const snap = snapshotRef.current;
      if (!snap.active) return;
      publish(pageNum, snap.clusters, snap.chosenByKey, snap.hiddenKeys);
    },
    [publish],
  );

  return {
    groups,
    clear,
    publish,
    remap,
    setHiddenKeys,
    onPageChange,
  };
}
