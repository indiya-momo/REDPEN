import { Minus, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isLayoutMarkMode,
  MANUAL_LIST_MODE,
} from '../lib/manuscriptWorkbench/modes.js';
import { LAYOUT_MARK_LABELS } from '../lib/layoutMark/layoutMarkTypes.js';
import { countManualInstances } from '../lib/manuscriptWorkbench/findingsSink.js';
import {
  MANUAL_ADD_CANCEL_HINT,
  MANUAL_ADD_HINT,
  MANUAL_ADD_HINT_REST,
  MANUAL_LONG_RANGE_HINT,
  MANUAL_PERSIST_NOTICE,
  MANUAL_SEARCH_EMPTY,
  manualListButtonLabel,
} from '../lib/manuscriptWorkbench/types.js';
import {
  formatReplaceDiff,
  manualUserMemo,
} from '../lib/manuscriptWorkbench/textPartDiff.js';
import {
  SPACE_VISIBLE_CHAR,
  decodeSpacesVisible,
  encodeSpacesVisible,
} from '../lib/spaceVisibleText.js';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import ManuscriptToolboxRail, {
  readRailPlacement,
} from './ManuscriptToolboxRail.jsx';

function SpaceMarks({ text }) {
  const encoded = encodeSpacesVisible(text ?? '');
  if (!encoded) return null;
  return Array.from(encoded, (ch, i) =>
    ch === SPACE_VISIBLE_CHAR ? (
      <span key={i} className="manuscript-toolbox__space-mark">
        {SPACE_VISIBLE_CHAR}
      </span>
    ) : (
      ch
    ),
  );
}

export default function ManuscriptToolbox(props) {
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const slotRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const railRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [placement, setPlacement] = useState(readRailPlacement);
  const manualCount = countManualInstances(props.manualGroups);
  const layoutCount = (props.layoutMarks ?? []).length;
  const listCount = manualCount + layoutCount;
  const layoutMode = isLayoutMarkMode(props.mode);
  const panelOpen =
    props.mode === 'search' ||
    props.mode === 'manual-add' ||
    props.mode === MANUAL_LIST_MODE;
  const panelAnchorRef = placement.docked ? rootRef : railRef;

  return (
    <div className="manuscript-toolbox" ref={rootRef}>
      <ManuscriptToolboxRail
        mode={props.mode}
        onModeChange={props.onModeChange}
        placement={placement}
        setPlacement={setPlacement}
        slotRef={slotRef}
        railRef={railRef}
      />
      <ListModeButton
        count={listCount}
        mode={props.mode}
        onModeChange={props.onModeChange}
      />
      {props.persistNotice && !panelOpen ? (
        <p className="manuscript-toolbox__persist manuscript-toolbox__persist--float" role="status">
          {MANUAL_PERSIST_NOTICE}
        </p>
      ) : null}
      {layoutMode ? (
        <p className="manuscript-toolbox__persist manuscript-toolbox__persist--float" role="status">
          {props.mode === 'layout-indent' || props.mode === 'layout-paraGap'
            ? '줄의 첫 어절만 찍을 수 있습니다.'
            : '본문에서 어절을 드래그해 찍습니다.'}{' '}
          조판 {layoutCount}건
        </p>
      ) : null}
      {panelOpen ? (
        <ToolboxPanel
          {...props}
          listCount={listCount}
          manualCount={manualCount}
          layoutCount={layoutCount}
          anchorRef={panelAnchorRef}
          railPlacement={placement}
        />
      ) : null}
    </div>
  );
}

function FindingsCountCircle({ count }) {
  const n = Number(count) || 0;
  return (
    <span className="result-findings-count-circle" aria-label={`${n}건`}>
      {n}
    </span>
  );
}

function ListModeButton({ count, mode, onModeChange }) {
  const on = mode === MANUAL_LIST_MODE;
  const empty = count <= 0;
  const className = on
    ? 'pdf-work-pane__aux-btn manuscript-toolbox__mode manuscript-toolbox__mode--on'
    : 'pdf-work-pane__aux-btn manuscript-toolbox__mode';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={manualListButtonLabel(count)}
      disabled={empty}
      onClick={() => {
        if (empty) return;
        onModeChange(on ? null : MANUAL_LIST_MODE);
      }}
    >
      수정 리스트
      {empty ? null : <FindingsCountCircle count={count} />}
    </button>
  );
}

function ToolboxPanel(props) {
  const listOpen = props.mode === MANUAL_LIST_MODE;
  const [pos, setPos] = useState(
    /** @type {{ left: number, bottom: number } | null} */ (null),
  );
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const onDragStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    e.preventDefault();
    const startX = e.clientX - offset.x;
    const startY = e.clientY - offset.y;
    const move = (ev) => setOffset({ x: ev.clientX - startX, y: ev.clientY - startY });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useLayoutEffect(() => {
    const anchor = props.anchorRef?.current;
    if (!anchor) return undefined;

    const place = () => {
      const box = anchor.getBoundingClientRect();
      setPos({
        left: Math.max(8, Math.min(box.left, window.innerWidth - 368)),
        bottom: Math.max(8, window.innerHeight - box.top + 8),
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [
    props.anchorRef,
    props.mode,
    listOpen,
    props.railPlacement?.docked,
    props.railPlacement?.x,
    props.railPlacement?.y,
  ]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      className={`manuscript-toolbox__panel manuscript-toolbox__panel--portal${
        listOpen ? ' manuscript-toolbox__panel--list' : props.mode === 'search' ? ' manuscript-toolbox__panel--search' : ''
      }`}
      style={{
        left: `${pos.left}px`,
        bottom: `${pos.bottom}px`,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      onPointerDown={onDragStart}
      role="region"
      aria-label={listOpen ? '수정 리스트' : '원고 작업대'}
    >
      {props.persistNotice && !listOpen ? (
        <p className="manuscript-toolbox__persist" role="status">
          {MANUAL_PERSIST_NOTICE}
        </p>
      ) : null}
      {props.mode === 'search' ? <SearchPanel {...props} /> : null}
      {props.mode === 'manual-add' ? <ManualAddPanel {...props} /> : null}
      {listOpen ? (
        <ManualListPanel {...props} onModeChange={props.onModeChange} />
      ) : null}
    </div>,
    document.body,
  );
}

function SearchPanel(props) {
  return <SearchForm {...props} />;
}

function ManualAddPanel(props) {
  return <ManualForm {...props} />;
}

function submitSearch(e, onSearch) {
  e.preventDefault();
  onSearch();
}

function SearchForm({
  query,
  onQueryChange,
  onSearch,
  searchAttempted,
  hitCount = 0,
}) {
  const searched = searchAttempted && query && query.trim();
  const hint = searched
    ? hitCount > 0
      ? ''
      : MANUAL_SEARCH_EMPTY
    : '';
  return (
    <div>
      <SearchFields query={query} onQueryChange={onQueryChange} onSearch={onSearch} />
      {hint ? <p className="manuscript-toolbox__hint">{hint}</p> : null}
    </div>
  );
}

function SearchFields({ query, onQueryChange, onSearch }) {
  return (
    <form className="manuscript-toolbox__search" onSubmit={(e) => submitSearch(e, onSearch)}>
      <input
        className="manuscript-toolbox__input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="원고에서 찾기"
      />
      <button type="submit" className="pdf-work-pane__aux-btn manuscript-toolbox__commit">찾기</button>
    </form>
  );
}

function ManualForm(props) {
  return <ManualBody {...props} />;
}

function ManualBody({
  currentPageHasText,
  draft,
  replace,
  onReplaceChange,
  tip,
  onTipChange,
  onCommit,
  canCommit,
  commitBlockedReason,
  longRangeHint,
  editing = false,
  onModeChange,
}) {
  const hint = currentPageHasText ? (
    <>
      {MANUAL_ADD_HINT}({MANUAL_ADD_CANCEL_HINT})
      <br />
      {MANUAL_ADD_HINT_REST}
    </>
  ) : (
    '이 페이지는 선택할 텍스트가 없습니다. 스캔본은 읽지 않습니다.'
  );
  return (
    <div>
      <div className="manuscript-toolbox__form-head">
        <p className="manuscript-toolbox__hint">{hint}</p>
        <button
          type="button"
          className="pdf-work-pane__aux-btn pdf-work-pane__aux-btn--icon manuscript-toolbox__list-dock"
          onClick={() => onModeChange?.(null)}
          aria-label="창 닫기"
        >
          <X size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <DraftFields
        draft={draft}
        replace={replace}
        onReplaceChange={onReplaceChange}
        tip={tip}
        onTipChange={onTipChange}
        onCommit={onCommit}
        canCommit={canCommit}
        commitBlockedReason={commitBlockedReason}
        longRangeHint={longRangeHint}
        editing={editing}
      />
    </div>
  );
}

/** 빈 수정 안내. 버튼 비활성은 유지하고, 창 아래 상태 문구로는 보여 주지 않는다. */
const BLANK_REPLACE_STATUS_HINT = '수정을 입력하세요.';

const DRAFT_ROWS_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  columnGap: 8,
  rowGap: 8,
  alignItems: 'center',
};

const DRAFT_LABEL_STYLE = {
  margin: 0,
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
};

function DraftFields({
  draft,
  replace,
  onReplaceChange,
  tip,
  onTipChange,
  onCommit,
  canCommit,
  commitBlockedReason,
  longRangeHint,
  editing = false,
}) {
  const showCommitReason =
    Boolean(commitBlockedReason) &&
    commitBlockedReason !== BLANK_REPLACE_STATUS_HINT;
  return (
    <div className="manuscript-toolbox__draft">
      <p className="manuscript-toolbox__found">
        원본: {draft?.matchedText ? <SpaceMarks text={draft.matchedText} /> : ''}
      </p>
      <p className="manuscript-toolbox__found">
        수정: {replace ? <SpaceMarks text={replace} /> : ''}
        {' '}
        ({formatReplaceDiff(draft?.matchedText, replace)})
      </p>
      {longRangeHint ? (
        <p className="manuscript-toolbox__hint">{MANUAL_LONG_RANGE_HINT}</p>
      ) : null}
      <div className="manuscript-toolbox__draft-rows" style={DRAFT_ROWS_STYLE}>
        <label
          htmlFor="manuscript-toolbox-replace"
          className="manuscript-toolbox__field-label"
          style={{ ...DRAFT_LABEL_STYLE, gridColumn: 1, gridRow: 1 }}
        >
          수정
        </label>
        <span
          className="manuscript-toolbox__space-field"
          style={{ gridColumn: '2 / -1', gridRow: 1, minWidth: 0 }}
        >
          <span className="manuscript-toolbox__space-mirror" aria-hidden>
            <SpaceMarks text={replace} />
          </span>
          <input
            id="manuscript-toolbox-replace"
            className="manuscript-toolbox__input manuscript-toolbox__space-field-input"
            value={encodeSpacesVisible(replace)}
            onChange={(e) => onReplaceChange(decodeSpacesVisible(e.target.value))}
            autoComplete="off"
            spellCheck={false}
            aria-label="수정"
          />
        </span>
        <label
          htmlFor="manuscript-toolbox-tip"
          className="manuscript-toolbox__field-label"
          style={{ ...DRAFT_LABEL_STYLE, gridColumn: 1, gridRow: 2 }}
        >
          메모
        </label>
        <input
          id="manuscript-toolbox-tip"
          className="manuscript-toolbox__input"
          style={{ gridColumn: 2, gridRow: 2, minWidth: 0, width: '100%' }}
          value={tip}
          onChange={(e) => onTipChange(e.target.value)}
          aria-label="메모"
        />
        <button
          type="button"
          className="pdf-work-pane__aux-btn manuscript-toolbox__commit"
          style={{ gridColumn: 3, gridRow: 2 }}
          onClick={onCommit}
          disabled={!canCommit}
        >
          {editing ? '리스트에 반영' : '리스트에 추가'}
        </button>
      </div>
      {showCommitReason ? (
        <p className="manuscript-toolbox__hint">{commitBlockedReason}</p>
      ) : null}
    </div>
  );
}

function ManualListPanel({
  manualGroups,
  layoutMarks,
  listCount,
  manualCount,
  layoutCount,
  formatPageLabel,
  onSelectInstance,
  onRemoveManualInstance,
  onRemoveLayoutMark,
  onModeChange,
}) {
  const pageLabel = formatPageLabel ?? formatSystemPageLabel;
  const rows = [];
  for (const group of manualGroups ?? []) {
    for (const inst of group.instances ?? []) {
      rows.push({ group, inst });
    }
  }
  const marks = layoutMarks ?? [];
  return (
    <div>
      <div className="manuscript-toolbox__list-head">
        <p className="manuscript-toolbox__list-title">
          수정 리스트
          <FindingsCountCircle count={listCount} />
        </p>
        <button
          type="button"
          className="pdf-work-pane__aux-btn pdf-work-pane__aux-btn--icon manuscript-toolbox__list-dock"
          onClick={() => onModeChange?.(null)}
          aria-label="작은 창으로 접기"
        >
          <Minus size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      {manualCount > 0 ? (
        <section className="manuscript-toolbox__list-section" aria-label="내용 수정">
          <h3 className="manuscript-toolbox__list-section-title">내용 수정</h3>
          <ul className="manuscript-toolbox__list">
            {rows.map(({ group, inst }) => (
              <ManualListRow
                key={`${inst.pageNum}-${inst.index}-${inst.find}`}
                group={group}
                inst={inst}
                pageLabel={pageLabel}
                onSelectInstance={onSelectInstance}
                onRemoveManualInstance={onRemoveManualInstance}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {layoutCount > 0 ? (
        <section className="manuscript-toolbox__list-section" aria-label="조판 기호">
          <h3 className="manuscript-toolbox__list-section-title">조판 기호</h3>
          <ul className="manuscript-toolbox__list">
            {marks.map((m) => (
              <LayoutListRow
                key={m.id}
                mark={m}
                pageLabel={pageLabel}
                onRemoveLayoutMark={onRemoveLayoutMark}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function LayoutListRow({ mark, pageLabel, onRemoveLayoutMark }) {
  const kindLabel = LAYOUT_MARK_LABELS[mark.kind] ?? mark.kind;
  const after = String(mark.after ?? '').trim() || '—';
  return (
    <li className="manuscript-toolbox__list-item">
      <div className="manuscript-toolbox__list-card manuscript-toolbox__list-card--static">
        <span className="manuscript-toolbox__list-pair">
          {kindLabel}
          {' · '}
          <SpaceMarks text={after} />
        </span>
        <span className="manuscript-toolbox__list-meta">
          쪽 {pageLabel(mark.pageNum)}
        </span>
      </div>
      {onRemoveLayoutMark ? (
        <button
          type="button"
          className="manuscript-toolbox__list-remove"
          onClick={() => onRemoveLayoutMark(mark.id)}
          aria-label={`${kindLabel} 지우기`}
        >
          <X size={14} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function ManualListRow({
  group,
  inst,
  pageLabel,
  onSelectInstance,
  onRemoveManualInstance,
}) {
  const find = String(inst.matchedText ?? group.find ?? '');
  const replace = String(inst.suggestedText ?? inst.replace ?? group.replace ?? '');
  const memo = manualUserMemo(inst.tip ?? group.tip);
  return (
    <li className="manuscript-toolbox__list-item">
      <button
        type="button"
        className="manuscript-toolbox__list-card"
        onClick={() =>
          onSelectInstance?.({
            ...inst,
            matchedText: find,
            find,
            suggestedText: replace,
            replace,
            tip: inst.tip ?? group.tip ?? '',
          })
        }
      >
        <span className="manuscript-toolbox__list-pair">
          <SpaceMarks text={find} />
          {' → '}
          <SpaceMarks text={replace} />
        </span>
        <span className="manuscript-toolbox__list-meta">
          {memo || '메모 없음'}
          {' · '}
          쪽 {pageLabel(inst.pageNum)}
        </span>
      </button>
      {onRemoveManualInstance ? (
        <button
          type="button"
          className="manuscript-toolbox__list-remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemoveManualInstance(inst);
          }}
          aria-label="이 수정 지우기"
        >
          <X size={14} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </li>
  );
}
