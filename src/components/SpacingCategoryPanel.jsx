import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PanelSectionRunButton from './PanelSectionRunButton.jsx';
import {
  SPACING_CATEGORY_DEFS,
  spacingHitsToGroups,
} from '../lib/spacingCategoryRegistry.js';

const YIELD_EVERY_PAGES = 12;

/**
 * @param {{ pageNum: number, index: number, matchedText: string, categoryId?: string }} hit
 */
function hitKey(hit) {
  return `${hit.pageNum}:${hit.index}:${hit.categoryId || ''}:${hit.matchedText}`;
}

/**
 * 띄어쓰기 범주 패널. 체크·결과는 이 안에만 둔다 (useRuleCheck 비사용).
 * @param {{
 *   pageTexts: { pageNum: number, text?: string }[],
 *   formatPageLabel: (pageNum: number) => string,
 *   setCurrentPage: (pageNum: number) => void,
 *   onHighlightChange: (state: {
 *     groups: import('../lib/ruleEngine.js').GroupedResult[],
 *     selected: import('../lib/ruleEngine.js').MatchInstance | null,
 *     done: boolean,
 *   }) => void,
 * }} props
 */
export default function SpacingCategoryPanel({
  pageTexts,
  formatPageLabel,
  setCurrentPage,
  onHighlightChange,
}) {
  const [enabled, setEnabled] = useState(() => {
    /** @type {Record<string, boolean>} */
    const init = {};
    for (const def of SPACING_CATEGORY_DEFS) init[def.id] = false;
    return init;
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(
    /** @type {{ current: number, total: number } | null} */ (null),
  );
  const [hits, setHits] = useState(
    /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string, categoryId: string, label: string }[]} */ (
      []
    ),
  );
  const [selectedKey, setSelectedKey] = useState(/** @type {string | null} */ (null));
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const runIdRef = useRef(0);

  const anyOn = useMemo(
    () => SPACING_CATEGORY_DEFS.some((d) => enabled[d.id]),
    [enabled],
  );

  const groups = useMemo(() => spacingHitsToGroups(hits), [hits]);
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    for (const group of groups) {
      const inst = group.instances[0];
      if (
        inst &&
        hitKey({
          pageNum: inst.pageNum,
          index: inst.index,
          matchedText: inst.matchedText,
          categoryId: group.category,
        }) === selectedKey
      ) {
        return inst;
      }
    }
    return null;
  }, [groups, selectedKey]);

  useEffect(() => {
    onHighlightChange({ groups, selected, done });
  }, [groups, selected, done, onHighlightChange]);

  useEffect(() => {
    runIdRef.current += 1;
    setRunning(false);
    setHits([]);
    setSelectedKey(null);
    setDone(false);
    setProgress(null);
    setNote('');
  }, [pageTexts]);

  const toggle = useCallback((id) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const run = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const activeDefs = SPACING_CATEGORY_DEFS.filter((d) => enabled[d.id]);
    if (!activeDefs.length) {
      setHits([]);
      setSelectedKey(null);
      setProgress(null);
      setDone(true);
      setNote('검사할 항목을 하나 이상 켜 주세요.');
      setRunning(false);
      return;
    }
    if (!pageTexts.length) return;

    setRunning(true);
    setDone(false);
    setNote('');
    setHits([]);
    setSelectedKey(null);
    /** @type {typeof hits} */
    const found = [];
    const total = pageTexts.length;
    for (let i = 0; i < total; i += 1) {
      if (runIdRef.current !== runId) return;
      const page = pageTexts[i];
      const text = String(page?.text ?? '');
      if (text) {
        for (const def of activeDefs) {
          for (const hit of def.findHits(text)) {
            found.push({
              pageNum: page.pageNum,
              ...hit,
              categoryId: def.id,
              label: def.label,
            });
          }
        }
      }
      const last = i === total - 1;
      if (last || i % YIELD_EVERY_PAGES === YIELD_EVERY_PAGES - 1) {
        setProgress({ current: i + 1, total });
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }
    }
    if (runIdRef.current !== runId) return;
    found.sort(
      (a, b) =>
        a.pageNum - b.pageNum ||
        a.index - b.index ||
        a.categoryId.localeCompare(b.categoryId),
    );
    setHits(found);
    const first = found[0] ?? null;
    setSelectedKey(first ? hitKey(first) : null);
    if (first) setCurrentPage(first.pageNum);
    setDone(true);
    setRunning(false);
    setNote(found.length ? '' : '찾은 곳이 없습니다.');
  }, [enabled, pageTexts, setCurrentPage]);

  const progressLabel =
    running && progress
      ? `${progress.current}/${progress.total}쪽`
      : done
        ? `${hits.length}건`
        : '';

  return (
    <div data-spacing-panel="">
      <div className="spelling-tab-layout__run-row">
        <div className="spelling-tab-layout__run-row-actions">
          <PanelSectionRunButton
            label="띄어쓰기 검사"
            processingLabel="검사 중…"
            className="panel-section-run-btn--primary"
            onClick={() => {
              void run();
            }}
            disabled={pageTexts.length === 0}
            isProcessing={running}
            title={
              pageTexts.length === 0
                ? '원고를 올리면 검사할 수 있습니다.'
                : undefined
            }
          />
        </div>
        {progressLabel ? (
          <p className="spacing-category__status" role="status">
            {progressLabel}
          </p>
        ) : null}
      </div>
      <div className="spelling-tab-layout__calibration">
        <div className="spacing-category">
          <ul className="spacing-category__toggles">
            {SPACING_CATEGORY_DEFS.map((def) => (
              <li key={def.id} className="spacing-category__toggle-item">
                <label className="spacing-category__option">
                  <input
                    type="checkbox"
                    checked={Boolean(enabled[def.id])}
                    onChange={() => toggle(def.id)}
                    data-spacing-toggle={def.id}
                  />
                  {def.label}
                </label>
                <p className="spacing-category__hint">{def.tip}</p>
              </li>
            ))}
          </ul>
          {note ? <p className="spacing-category__hint">{note}</p> : null}
          {!anyOn && done && !note ? (
            <p className="spacing-category__hint">검사할 항목을 하나 이상 켜 주세요.</p>
          ) : null}
        </div>
        {hits.length > 0 ? (
          <ul className="spacing-category__hits">
            {hits.map((hit) => {
              const key = hitKey(hit);
              const selectedHit = key === selectedKey;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`spacing-category__hit${selectedHit ? ' is-selected' : ''}`}
                    data-spacing-hit=""
                    onClick={() => {
                      setSelectedKey(key);
                      setCurrentPage(hit.pageNum);
                    }}
                  >
                    <span className="spacing-category__hit-meta">
                      {formatPageLabel(hit.pageNum)} · {hit.label} · 위치 {hit.index}
                    </span>
                    <span className="spacing-category__hit-text">
                      {hit.matchedText} → {hit.suggestedText}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
