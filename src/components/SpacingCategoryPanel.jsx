import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PanelSectionRunButton from './PanelSectionRunButton.jsx';
import {
  NUMERAL_SPACING_LABEL,
  findNumeralSpacingHits,
  numeralSpacingGroups,
} from '../lib/numeralSpacing.js';

const YIELD_EVERY_PAGES = 12;

/**
 * @param {{ pageNum: number, index: number, matchedText: string }} hit
 */
function hitKey(hit) {
  return `${hit.pageNum}:${hit.index}:${hit.matchedText}`;
}

/**
 * 띄어쓰기 범주 패널. 체크 상태는 이 안에만 둔다.
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
  const [numeralOn, setNumeralOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(
    /** @type {{ current: number, total: number } | null} */ (null),
  );
  const [hits, setHits] = useState(
    /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string }[]} */ (
      []
    ),
  );
  const [selectedKey, setSelectedKey] = useState(/** @type {string | null} */ (null));
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const runIdRef = useRef(0);

  const groups = useMemo(() => numeralSpacingGroups(hits), [hits]);
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    for (const group of groups) {
      const inst = group.instances[0];
      if (inst && hitKey(inst) === selectedKey) return inst;
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

  const run = useCallback(async () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    if (!numeralOn) {
      setHits([]);
      setSelectedKey(null);
      setProgress(null);
      setDone(true);
      setNote('수사 띄어쓰기를 켜면 검사합니다.');
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
        for (const hit of findNumeralSpacingHits(text)) {
          found.push({ pageNum: page.pageNum, ...hit });
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
    setHits(found);
    const first = found[0] ?? null;
    setSelectedKey(first ? hitKey(first) : null);
    if (first) setCurrentPage(first.pageNum);
    setDone(true);
    setRunning(false);
    setNote(found.length ? '' : '찾은 곳이 없습니다.');
  }, [numeralOn, pageTexts, setCurrentPage]);

  const progressLabel = running && progress
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
            onClick={run}
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
          <label className="spacing-category__option">
            <input
              type="checkbox"
              checked={numeralOn}
              onChange={(event) => setNumeralOn(event.target.checked)}
              data-spacing-numeral-toggle=""
            />
            {NUMERAL_SPACING_LABEL}
          </label>
          <p className="spacing-category__hint">
            한글로 적은 수는 만 단위로만 띄어 씁니다. 예: 천 오백 → 천오백
          </p>
          {note ? <p className="spacing-category__hint">{note}</p> : null}
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
                      {formatPageLabel(hit.pageNum)} · 위치 {hit.index}
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
