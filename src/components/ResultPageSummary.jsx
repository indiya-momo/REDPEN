import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { instanceVisibilityKey } from '../lib/checkResultUtils.js';

/**
 * @typedef {{
 *   pageNum: number,
 *   pageInstances: import('../lib/ruleEngine.js').MatchInstance[],
 *   x: number,
 *   y: number,
 * }} PageChipContextMenu
 */

/**
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   formatPageLabel?: (systemPage: number) => string,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   isInstanceVisible?: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
export default function ResultPageSummary({
  instances,
  currentPage,
  formatPageLabel = formatSystemPageLabel,
  onSelectPage,
  onSelectInstance,
  isInstanceVisible = () => true,
  onToggleInstanceVisibility,
}) {
  const [pickerPage, setPickerPage] = useState(
    /** @type {number | null} */ (null),
  );
  const [contextMenu, setContextMenu] = useState(
    /** @type {PageChipContextMenu | null} */ (null),
  );
  const pickerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const contextMenuRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const byPage = new Map();
  for (const inst of instances) {
    const list = byPage.get(inst.pageNum) ?? [];
    list.push(inst);
    byPage.set(inst.pageNum, list);
  }
  const pages = [...byPage.entries()].sort((a, b) => a[0] - b[0]);

  const closeOverlays = useCallback(() => {
    setPickerPage(null);
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (pickerPage == null && contextMenu == null) return undefined;

    const onDocPointerDown = (event) => {
      const target = /** @type {Node} */ (event.target);
      if (pickerRef.current?.contains(target)) return;
      if (contextMenuRef.current?.contains(target)) return;
      closeOverlays();
    };
    const onDocContextMenu = () => {
      closeOverlays();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeOverlays();
    };

    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('contextmenu', onDocContextMenu);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('contextmenu', onDocContextMenu);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerPage, contextMenu, closeOverlays]);

  const openContextMenu = useCallback(
    (pageNum, pageInstances, x, y) => {
      if (!onToggleInstanceVisibility) return;
      setPickerPage(null);
      setContextMenu({ pageNum, pageInstances, x, y });
    },
    [onToggleInstanceVisibility],
  );

  const openPicker = useCallback((pageNum) => {
    setContextMenu(null);
    setPickerPage(pageNum);
  }, []);

  if (!pages.length) return null;

  return (
    <>
      <div className="result-pages" role="list">
        {pages.map(([pageNum, pageInstances]) => (
          <PageChip
            key={pageNum}
            pageNum={pageNum}
            pageInstances={pageInstances}
            currentPage={currentPage}
            formatPageLabel={formatPageLabel}
            isInstanceVisible={isInstanceVisible}
            onSelectPage={onSelectPage}
            onSelectInstance={onSelectInstance}
            onToggleInstanceVisibility={onToggleInstanceVisibility}
            onOpenContextMenu={openContextMenu}
            pickerOpen={pickerPage === pageNum}
            pickerRef={pickerPage === pageNum ? pickerRef : null}
            onClosePicker={closeOverlays}
          />
        ))}
      </div>
      {contextMenu && onToggleInstanceVisibility ? (
        <div
          ref={contextMenuRef}
          className="result-instance-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`${formatPageLabel(contextMenu.pageNum)} 발견 건`}
        >
          {contextMenu.pageInstances.length === 1 ? (
            <button
              type="button"
              role="menuitem"
              className="result-instance-context-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                onToggleInstanceVisibility(contextMenu.pageInstances[0]);
                closeOverlays();
              }}
            >
              {isInstanceVisible(contextMenu.pageInstances[0])
                ? '표시 제외'
                : '표시 복원'}
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="result-instance-context-menu__item"
              onClick={(event) => {
                event.stopPropagation();
                openPicker(contextMenu.pageNum);
              }}
            >
              발견 건 선택…
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

/**
 * @param {{
 *   pageNum: number,
 *   pageInstances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onOpenContextMenu: (pageNum: number, pageInstances: import('../lib/ruleEngine.js').MatchInstance[], x: number, y: number) => void,
 *   pickerOpen: boolean,
 *   pickerRef: React.RefObject<HTMLDivElement | null> | null,
 *   onClosePicker: () => void,
 * }} props
 */
function PageChip({
  pageNum,
  pageInstances,
  currentPage,
  formatPageLabel,
  isInstanceVisible,
  onSelectPage,
  onSelectInstance,
  onToggleInstanceVisibility,
  onOpenContextMenu,
  pickerOpen,
  pickerRef,
  onClosePicker,
}) {
  const visibleCount = pageInstances.filter((inst) => isInstanceVisible(inst)).length;
  const allHidden = visibleCount === 0;
  const partial = visibleCount > 0 && visibleCount < pageInstances.length;

  const countLabel =
    pageInstances.length > 1
      ? partial || allHidden
        ? ` (${visibleCount}/${pageInstances.length})`
        : ` (${pageInstances.length})`
      : '';

  return (
    <div className="result-page-chip-wrap" role="listitem">
      <button
        type="button"
        className={`page-chip ${pageNum === currentPage ? 'page-chip--current' : ''}${
          allHidden ? ' page-chip--hidden-instance' : ''
        }${partial ? ' page-chip--partial-instance' : ''}`}
        title={
          onToggleInstanceVisibility
            ? '클릭: 페이지 이동 · 우클릭: 표시 제외'
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          onSelectPage(pageNum);
        }}
        onContextMenu={(event) => {
          if (!onToggleInstanceVisibility) return;
          event.preventDefault();
          event.stopPropagation();
          onOpenContextMenu(pageNum, pageInstances, event.clientX, event.clientY);
        }}
      >
        {formatPageLabel(pageNum)}
        {countLabel}
      </button>
      {pickerOpen && onToggleInstanceVisibility ? (
        <div
          ref={pickerRef}
          className="result-instance-picker"
          role="menu"
          aria-label={`${formatPageLabel(pageNum)} 발견 건`}
        >
          {pageInstances.map((inst) => {
            const visible = isInstanceVisible(inst);
            return (
              <button
                key={instanceVisibilityKey(inst)}
                type="button"
                role="menuitemcheckbox"
                aria-checked={visible}
                className={`result-instance-picker__row${
                  visible ? '' : ' result-instance-picker__row--hidden'
                }`}
                title="클릭: 해당 위치로 이동"
                onClick={(event) => {
                  event.stopPropagation();
                  if (onSelectInstance) onSelectInstance(inst);
                  else onSelectPage(pageNum);
                  onClosePicker();
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span className="result-instance-picker__text">
                  {inst.matchedText}
                  {inst.suggestedText && inst.suggestedText !== inst.matchedText
                    ? ` → ${inst.suggestedText}`
                    : ''}
                </span>
                <span
                  className="result-instance-picker__toggle"
                  role="presentation"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggleInstanceVisibility(inst);
                  }}
                >
                  {visible ? '표시' : '제외'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
