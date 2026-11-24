import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchManuscript } from '../lib/manuscriptWorkbench/searchManuscript.js';
import {
  addManualFinding,
  canAddManualFinding,
  manualAddRejectReason,
} from '../lib/manuscriptWorkbench/addManualFinding.js';
import {
  commitEditedManual,
  instanceToEditDraft,
} from '../lib/manuscriptWorkbench/editManualFinding.js';
import {
  countManualInstances,
  removeManualInstance,
} from '../lib/manuscriptWorkbench/findingsSink.js';
import { searchHitsToGroups } from '../lib/manuscriptWorkbench/searchFindings.js';
import {
  isLayoutMarkMode,
  layoutKindFromMode,
  MANUAL_LIST_MODE,
} from '../lib/manuscriptWorkbench/modes.js';
import {
  MANUAL_LONG_RANGE_HINT_CHARS,
  MANUAL_SOURCE,
} from '../lib/manuscriptWorkbench/types.js';
import {
  hydrateManualGroups,
  manualFindingsEqual,
  serializeManualGroups,
} from '../lib/manuscriptWorkbench/persistManualFindings.js';
import {
  appendLayoutMark,
  removeLayoutMarkById,
} from '../lib/layoutMark/addLayoutMark.js';
import { LAYOUT_MARK_LABELS } from '../lib/layoutMark/layoutMarkTypes.js';

/**
 * 원고 작업대 상태. 선택·검색은 setGroups/publish를 부르지 않는다.
 * 수정 리스트는 프로젝트(ruleSet.manualFindings)에 저장한다.
 * @param {{
 *   pageTexts: import('../lib/pdfService.js').PageData[],
 *   currentPage: number,
 *   resetKey?: unknown,
 *   projectId?: string,
 *   savedManualFindings?: unknown,
 *   onManualFindingsChange?: (rows: import('../lib/manuscriptWorkbench/persistManualFindings.js').StoredManualFinding[]) => void,
 *   goToPdfPage: (pageNum: number) => void,
 * }} options
 */
export function useManuscriptWorkbench({
  pageTexts,
  currentPage,
  resetKey,
  projectId,
  savedManualFindings,
  onManualFindingsChange,
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
  const [editingTarget, setEditingTarget] = useState(
    /** @type {{ pageNum: number, index: number } | null} */ (null),
  );
  const [layoutMarks, setLayoutMarks] = useState(
    /** @type {import('../lib/layoutMark/layoutMarkTypes.js').LayoutMark[]} */ ([]),
  );

  const persistRef = useRef(onManualFindingsChange);
  persistRef.current = onManualFindingsChange;
  const skipPersistRef = useRef(true);
  const lastSerializedRef = useRef('');
  const hydratedProjectRef = useRef(/** @type {string | null} */ (null));
  const groupsCountRef = useRef(0);
  groupsCountRef.current = countManualInstances(manualGroups);

  useEffect(() => {
    setLayoutMarks([]);
  }, [resetKey]);

  useEffect(() => {
    const id = String(projectId ?? '');
    skipPersistRef.current = true;
    hydratedProjectRef.current = id;
    const next = hydrateManualGroups(savedManualFindings);
    lastSerializedRef.current = JSON.stringify(serializeManualGroups(next));
    setManualGroups(next);
  }, [projectId]);

  useEffect(() => {
    const stored = serializeManualGroups(manualGroups);
    const key = JSON.stringify(stored);
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      lastSerializedRef.current = key;
      return;
    }
    if (key === lastSerializedRef.current) return;
    lastSerializedRef.current = key;
    persistRef.current?.(stored);
  }, [manualGroups]);

  useEffect(() => {
    const id = String(projectId ?? '');
    if (hydratedProjectRef.current !== id) return;
    if (groupsCountRef.current > 0) return;
    if (manualFindingsEqual(savedManualFindings, [])) return;
    skipPersistRef.current = true;
    const next = hydrateManualGroups(savedManualFindings);
    lastSerializedRef.current = JSON.stringify(serializeManualGroups(next));
    setManualGroups(next);
  }, [projectId, savedManualFindings]);

  useEffect(() => {
    setHits([]);
    setActiveHit(null);
    setDraft(null);
    setQuery('');
    setReplace('');
    setTip('');
    setEditingTarget(null);
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

  const onTextSelected = useCallback(
    (hit) => {
      if (!hit) return;
      const kind = layoutKindFromMode(mode);
      if (kind) {
        const page = (pageTexts ?? []).find((p) => p.pageNum === hit.pageNum);
        setLayoutMarks((prev) => {
          const next = appendLayoutMark(
            prev,
            { pageNum: hit.pageNum, index: hit.start, kind },
            page,
          );
          return next ?? prev;
        });
        setActiveHit(hit);
        return;
      }
      setDraft(hit);
      setActiveHit(hit);
      setMode((prev) => prev ?? 'manual-add');
    },
    [mode, pageTexts],
  );

  const cancelTextSelection = useCallback(() => {
    setDraft((prev) => (prev?.fromHighlight ? prev : null));
    setActiveHit((prev) => (prev?.fromHighlight ? prev : null));
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

  const changeMode = useCallback((next) => {
    setMode(next);
    if (next === 'manual-add') {
      setEditingTarget(null);
      setDraft(null);
      setActiveHit(null);
      setReplace('');
      setTip('');
      return;
    }
    setEditingTarget(null);
  }, []);

  const beginEditManual = useCallback(
    (inst) => {
      const edit = instanceToEditDraft(inst);
      if (!edit) return;
      setDraft(edit.draft);
      setActiveHit(edit.draft);
      setReplace(edit.replace);
      setTip(edit.tip);
      setEditingTarget(edit.editingTarget);
      setMode('manual-add');
      goToPdfPage(edit.draft.pageNum);
    },
    [goToPdfPage],
  );

  const openManualFromOverlay = useCallback(
    (inst) => {
      let edit = instanceToEditDraft(inst);
      if (!edit) {
        const matchedText = String(inst?.matchedText ?? inst?.find ?? '').trim();
        const pageNum = Number(inst?.pageNum);
        if (!matchedText || !Number.isFinite(pageNum)) return;
        const startRaw = Number(inst?.start ?? inst?.index);
        const start = Number.isFinite(startRaw) ? startRaw : 0;
        const endRaw = Number(inst?.end);
        const end =
          Number.isFinite(endRaw) && endRaw > start
            ? endRaw
            : start + matchedText.length;
        edit = {
          draft: {
            pageNum,
            start,
            end,
            matchedText,
            fromHighlight: true,
          },
          replace: String(inst?.suggestedText ?? inst?.replace ?? ''),
          tip: String(inst?.tip ?? ''),
          editingTarget: {
            pageNum,
            index: Number.isFinite(Number(inst?.index))
              ? Number(inst.index)
              : start,
          },
        };
      }
      const already = (manualGroups ?? []).some((group) =>
        (group.instances ?? []).some(
          (row) =>
            Number(row.pageNum) === edit.editingTarget.pageNum &&
            Number(row.index) === edit.editingTarget.index,
        ),
      );
      setDraft(edit.draft);
      setActiveHit(edit.draft);
      setReplace(edit.replace);
      setTip(edit.tip);
      setEditingTarget(already ? edit.editingTarget : null);
      setMode('manual-add');
      goToPdfPage(edit.draft.pageNum);
    },
    [goToPdfPage, manualGroups],
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
    const target = editingTarget;
    setManualGroups((groups) =>
      target
        ? commitEditedManual(groups, target, manual, page)
        : addManualFinding(groups, manual, page),
    );
    setReplace('');
    setTip('');
    setDraft(null);
    setActiveHit(null);
    setEditingTarget(null);
    setMode(MANUAL_LIST_MODE);
  }, [draft, replace, tip, pageTexts, editingTarget]);

  const removeManual = useCallback((inst) => {
    setManualGroups((groups) => {
      const next = removeManualInstance(groups, inst);
      if (countManualInstances(next) === 0) {
        setMode((prev) => (prev === MANUAL_LIST_MODE ? null : prev));
      }
      return next;
    });
  }, []);

  const searchGroups = useMemo(
    () => searchHitsToGroups(hits, searchedQuery),
    [hits, searchedQuery],
  );

  const previewPageHighlights = useMemo(() => {
    /** @type {object[]} */
    const rows = [];
    const hit = draft;
    if (hit && hit.pageNum === currentPage) {
      rows.push({
        start: hit.start,
        end: hit.end,
        primary: true,
        id: 'manuscript-preview',
        tip: '',
        matchedText: hit.matchedText,
        pillarClass:
          'pdf-highlight--pillar-spelling pdf-highlight--search-preview',
      });
    }
    for (const m of layoutMarks) {
      if (Number(m.pageNum) !== currentPage) continue;
      const w = String(m.after ?? '');
      if (!w) continue;
      rows.push({
        start: m.index,
        end: m.index + w.length,
        primary: false,
        id: `layout-${m.id}`,
        tip: LAYOUT_MARK_LABELS[m.kind] ?? m.kind,
        matchedText: w,
        layoutKind: m.kind,
        pillarClass:
          `pdf-highlight--layout-mark pdf-highlight--layout-${m.kind} pdf-highlight--search-preview`,
      });
    }
    return rows;
  }, [draft, currentPage, layoutMarks]);

  const removeLayoutMark = useCallback((id) => {
    setLayoutMarks((prev) => removeLayoutMarkById(prev, id));
  }, []);

  const currentPageHasText = useMemo(() => {
    const page = (pageTexts ?? []).find((p) => p.pageNum === currentPage);
    const refs = page?.itemRefs ?? [];
    const text = String(page?.text ?? page?.visualText ?? '');
    return refs.length > 0 && text.length > 0;
  }, [pageTexts, currentPage]);

  return {
    mode,
    setMode: changeMode,
    beginEditManual,
    openManualFromOverlay,
    editing: Boolean(editingTarget),
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
    layoutMarks,
    removeLayoutMark,
    previewPageHighlights,
    currentPageHasText,
    persistNotice: false,
    textLayerEnabled: mode === 'manual-add' || isLayoutMarkMode(mode),
  };
}
