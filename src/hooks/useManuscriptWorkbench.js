import { useCallback, useEffect, useMemo, useState } from 'react';
import { searchManuscript } from '../lib/manuscriptWorkbench/searchManuscript.js';
import {
  addManualFinding,
  canAddManualFinding,
  manualAddRejectReason,
} from '../lib/manuscriptWorkbench/addManualFinding.js';
import { removeManualInstance } from '../lib/manuscriptWorkbench/findingsSink.js';
import { searchHitsToGroups } from '../lib/manuscriptWorkbench/searchFindings.js';
import {
  MANUAL_LONG_RANGE_HINT_CHARS,
  MANUAL_SOURCE,
} from '../lib/manuscriptWorkbench/types.js';

/**
 * 원고 작업대 상태. 선택·검색은 setGroups/publish를 부르지 않는다.
 * @param {{
 *   pageTexts: import('../lib/pdfService.js').PageData[],
 *   currentPage: number,
 *   resetKey?: unknown,
 *   goToPdfPage: (pageNum: number) => void,
 * }} options
 */
export function useManuscriptWorkbench({
  pageTexts,
  currentPage,
  resetKey,
  goToPdfPage,
}) {
  const [mode, setMode] = useState(/** @type {string | null} */ (null));
  const [query, setQuery] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [hits, setHits] = useState(/** @type {import('../lib/manuscriptWorkbench/types.js').TextHit[]} */ ([]));
  const [activeHit, setActiveHit] = useState(
    /** @type {import('../lib/manuscriptWorkbench/types.js').TextHit | null} */ (null),
  );
  const [manualGroups, setManualGroups] = useState(
    /** @type {import('../lib/ruleEngine.js').GroupedResult[]} */ ([]),
  );
  const [draft, setDraft] = useState(
    /** @type {import('../lib/manuscriptWorkbench/types.js').TextHit | null} */ (null),
  );
  const [replace, setReplace] = useState('');
  const [tip, setTip] = useState('');

  useEffect(() => {
    setManualGroups([]);
    setHits([]);
    setActiveHit(null);
    setDraft(null);
    setQuery('');
    setReplace('');
    setTip('');
    setMode(null);
    setSearchAttempted(false);
    setSearchedQuery('');
  }, [resetKey]);

  const updateQuery = useCallback((next) => {
    setQuery(next);
    setSearchAttempted(false);
  }, []);

  const runSearch = useCallback(() => {
    const q = String(query ?? '').trim();
    const next = searchManuscript(pageTexts, q);
    setHits(next);
    setSearchedQuery(q);
    setSearchAttempted(true);
    const first = next[0] ?? null;
    setActiveHit(first);
    if (first) goToPdfPage(first.pageNum);
  }, [pageTexts, query, goToPdfPage]);

  const pickHit = useCallback(
    (hit) => {
      if (!hit) return;
      setActiveHit(hit);
      goToPdfPage(hit.pageNum);
      if (mode === 'manual-add') setDraft(hit);
    },
    [goToPdfPage, mode],
  );

  const onTextSelected = useCallback((hit) => {
    if (!hit) return;
    setDraft(hit);
    setActiveHit(hit);
    setMode((prev) => prev ?? 'manual-add');
  }, []);

  const cancelTextSelection = useCallback(() => {
    setDraft(null);
    setActiveHit(null);
  }, []);

  const draftPage = useMemo(() => {
    if (!draft) return null;
    return (pageTexts ?? []).find((p) => p.pageNum === draft.pageNum) ?? null;
  }, [draft, pageTexts]);

  const commitBlockedReason = useMemo(() => {
    if (!draft) return '';
    return manualAddRejectReason(
      { ...draft, replace, tip, source: MANUAL_SOURCE },
      draftPage,
    );
  }, [draft, replace, tip, draftPage]);

  const canCommit = Boolean(draft) && !commitBlockedReason;

  const longRangeHint = Boolean(
    draft && draft.end - draft.start >= MANUAL_LONG_RANGE_HINT_CHARS,
  );

  const commitManual = useCallback(() => {
    if (!draft) return;
    const page = (pageTexts ?? []).find((p) => p.pageNum === draft.pageNum);
    const manual = {
      ...draft,
      replace,
      tip,
      source: MANUAL_SOURCE,
    };
    if (!canAddManualFinding(manual, page)) return;
    setManualGroups((groups) => addManualFinding(groups, manual, page));
    setReplace('');
    setTip('');
    setDraft(null);
    setActiveHit(null);
  }, [draft, replace, tip, pageTexts]);

  const removeManual = useCallback((inst) => {
    setManualGroups((groups) => removeManualInstance(groups, inst));
  }, []);

  const searchGroups = useMemo(
    () => searchHitsToGroups(hits, searchedQuery),
    [hits, searchedQuery],
  );

  const previewPageHighlights = useMemo(() => {
    const hit = draft;
    if (!hit || hit.pageNum !== currentPage) return [];
    return [
      {
        start: hit.start,
        end: hit.end,
        primary: true,
        id: 'manuscript-preview',
        tip: '',
        matchedText: hit.matchedText,
        pillarClass:
          'pdf-highlight--pillar-spelling pdf-highlight--search-preview',
      },
    ];
  }, [draft, currentPage]);

  const currentPageHasText = useMemo(() => {
    const page = (pageTexts ?? []).find((p) => p.pageNum === currentPage);
    const refs = page?.itemRefs ?? [];
    const text = String(page?.text ?? page?.visualText ?? '');
    return refs.length > 0 && text.length > 0;
  }, [pageTexts, currentPage]);

  return {
    mode,
    setMode,
    query,
    setQuery: updateQuery,
    searchAttempted,
    hits,
    activeHit,
    runSearch,
    pickHit,
    draft,
    replace,
    setReplace,
    tip,
    setTip,
    commitManual,
    canCommit,
    commitBlockedReason,
    longRangeHint,
    onTextSelected,
    cancelTextSelection,
    manualGroups,
    searchGroups,
    removeManual,
    previewPageHighlights,
    currentPageHasText,
    persistNotice: manualGroups.length > 0,
    textLayerEnabled: mode === 'manual-add',
  };
}
