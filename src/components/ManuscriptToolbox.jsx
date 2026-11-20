import { Minimize2, X } from 'lucide-react';
import {
  MANUAL_LIST_MODE,
  MANUSCRIPT_TOOLBOX_MODES,
} from '../lib/manuscriptWorkbench/modes.js';
import { countManualInstances } from '../lib/manuscriptWorkbench/findingsSink.js';
import {
  MANUAL_ADD_CANCEL_HINT,
  MANUAL_ADD_HINT,
  MANUAL_ADD_HINT_REST,
  MANUAL_LONG_RANGE_HINT,
  MANUAL_PERSIST_NOTICE,
  MANUAL_SEARCH_EMPTY,
  MANUAL_SEARCH_HINT,
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
  const listCount = countManualInstances(props.manualGroups);
  const panelOpen =
    props.mode === 'search' ||
    props.mode === 'manual-add' ||
    props.mode === MANUAL_LIST_MODE;
  return (
    <div className="manuscript-toolbox">
      {MANUSCRIPT_TOOLBOX_MODES.map((item) => (
        <ModeButton
          key={item.id}
          item={item}
          mode={props.mode}
          onModeChange={props.onModeChange}
        />
      ))}
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
      {panelOpen ? <ToolboxPanel {...props} listCount={listCount} /> : null}
    </div>
  );
}

function ModeButton({ item, mode, onModeChange }) {
  const on = mode === item.id;
  const className = on
    ? 'pdf-work-pane__aux-btn manuscript-toolbox__mode manuscript-toolbox__mode--on'
    : 'pdf-work-pane__aux-btn manuscript-toolbox__mode';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      onClick={() => onModeChange(on ? null : item.id)}
    >
      {item.label}
    </button>
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
  return (
    <div
      className={`manuscript-toolbox__panel${
        listOpen ? ' manuscript-toolbox__panel--list' : ''
      }`}
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
    </div>
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
    : MANUAL_SEARCH_HINT;
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
        placeholder="원고에서 찾기"
        aria-label="원고에서 찾기"
      />
      <button type="submit" className="pdf-work-pane__aux-btn">찾기</button>
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
      {MANUAL_ADD_HINT}
      <br />
      {MANUAL_ADD_HINT_REST}({MANUAL_ADD_CANCEL_HINT})
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
      <label className="manuscript-toolbox__field">
        수정
        <span className="manuscript-toolbox__space-field">
          <span className="manuscript-toolbox__space-mirror" aria-hidden>
            <SpaceMarks text={replace} />
          </span>
          <input
            className="manuscript-toolbox__input manuscript-toolbox__space-field-input"
            value={encodeSpacesVisible(replace)}
            onChange={(e) => onReplaceChange(decodeSpacesVisible(e.target.value))}
            autoComplete="off"
            spellCheck={false}
            aria-label="수정"
          />
        </span>
      </label>
      <label className="manuscript-toolbox__field">
        메모
        <input
          className="manuscript-toolbox__input"
          value={tip}
          onChange={(e) => onTipChange(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="pdf-work-pane__aux-btn manuscript-toolbox__commit"
        onClick={onCommit}
        disabled={!canCommit}
      >
        {editing ? '리스트에 반영' : '리스트에 추가'}
      </button>
      {commitBlockedReason ? (
        <p className="manuscript-toolbox__hint">{commitBlockedReason}</p>
      ) : null}
    </div>
  );
}

function ManualListPanel({
  manualGroups,
  listCount,
  formatPageLabel,
  onSelectInstance,
  onRemoveManualInstance,
  onModeChange,
}) {
  const pageLabel = formatPageLabel ?? formatSystemPageLabel;
  const rows = [];
  for (const group of manualGroups ?? []) {
    for (const inst of group.instances ?? []) {
      rows.push({ group, inst });
    }
  }
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
          <Minimize2 size={16} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
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
    </div>
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
