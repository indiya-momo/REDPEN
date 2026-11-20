import { MANUSCRIPT_TOOLBOX_MODES } from '../lib/manuscriptWorkbench/modes.js';
import {
  MANUAL_ADD_CANCEL_HINT,
  MANUAL_ADD_HINT,
  MANUAL_LONG_RANGE_HINT,
  MANUAL_PERSIST_NOTICE,
  MANUAL_SEARCH_EMPTY,
  MANUAL_SEARCH_HINT,
} from '../lib/manuscriptWorkbench/types.js';
import {
  SPACE_VISIBLE_CHAR,
  decodeSpacesVisible,
  encodeSpacesVisible,
} from '../lib/spaceVisibleText.js';
import { formatReplaceDiff } from '../lib/manuscriptWorkbench/textPartDiff.js';

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
  const panelOpen = props.mode === 'search' || props.mode === 'manual-add';
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
      {props.persistNotice && !panelOpen ? (
        <p className="manuscript-toolbox__persist manuscript-toolbox__persist--float" role="status">
          {MANUAL_PERSIST_NOTICE}
        </p>
      ) : null}
      {panelOpen ? <ToolboxPanel {...props} /> : null}
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

function ToolboxPanel(props) {
  return (
    <div className="manuscript-toolbox__panel" role="region" aria-label="원고 작업대">
      {props.persistNotice ? (
        <p className="manuscript-toolbox__persist" role="status">
          {MANUAL_PERSIST_NOTICE}
        </p>
      ) : null}
      {props.mode === 'search' ? <SearchPanel {...props} /> : null}
      {props.mode === 'manual-add' ? <ManualAddPanel {...props} /> : null}
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
}) {
  const hint = currentPageHasText
    ? `${MANUAL_ADD_HINT}(${MANUAL_ADD_CANCEL_HINT})`
    : '이 페이지는 선택할 텍스트가 없습니다. 스캔본은 읽지 않습니다.';
  return (
    <div>
      <p className="manuscript-toolbox__hint">{hint}</p>
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
        리스트에 추가
      </button>
      {commitBlockedReason ? (
        <p className="manuscript-toolbox__hint">{commitBlockedReason}</p>
      ) : null}
    </div>
  );
}
