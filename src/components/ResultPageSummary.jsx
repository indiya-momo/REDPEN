import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { instanceVisibilityKey, instancesMatch } from '../lib/checkResultUtils.js';

/** 접힌 상태에서 페이지 칩이 차지할 최대 줄 수 */
export const RESULT_PAGES_MAX_COLLAPSED_ROWS = 2;

/**
 * @typedef {{
 *   inst: import('../lib/ruleEngine.js').MatchInstance,
 *   indexOnPage: number,
 *   totalOnPage: number,
 * }} InstancePillEntry
 */

/**
 * @param {import('../lib/ruleEngine.js').MatchInstance[]} instances
 * @returns {InstancePillEntry[]}
 */
export function buildInstancePills(instances) {
  const byPage = new Map();
  for (const inst of instances) {
    const list = byPage.get(inst.pageNum) ?? [];
    list.push(inst);
    byPage.set(inst.pageNum, list);
  }

  /** @type {InstancePillEntry[]} */
  const pills = [];
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    const pageInstances = byPage.get(pageNum) ?? [];
    const totalOnPage = pageInstances.length;
    pageInstances.forEach((inst, index) => {
      pills.push({
        inst,
        indexOnPage: index + 1,
        totalOnPage,
      });
    });
  }
  return pills;
}

/**
 * @param {number} indexOnPage
 * @param {number} totalOnPage
 * @returns {string | null}
 */
export function getInstanceFragmentLabel(indexOnPage, totalOnPage) {
  if (totalOnPage <= 1) return null;
  return `${indexOnPage}/${totalOnPage}`;
}

/**
 * 전체 칩이 렌더된 루트에서, 두 줄 +「더 보기」버튼이 들어가게 보일 칩 개수를 계산.
 * @param {HTMLElement} root
 * @param {number} totalCount
 * @returns {{ needsCollapse: boolean, visibleCount: number }}
 */
export function fitPillsIntoTwoRows(root, totalCount) {
  const pillEls = /** @type {HTMLElement[]} */ (
    [...root.children].filter(
      (el) =>
        el != null &&
        typeof el === 'object' &&
        'hasAttribute' in el &&
        /** @type {{ hasAttribute: (name: string) => boolean }} */ (el).hasAttribute(
          'data-result-pill',
        ),
    )
  );
  if (pillEls.length === 0) {
    return { needsCollapse: false, visibleCount: 0 };
  }

  const styles =
    typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  const rowGap = Number.parseFloat(styles?.rowGap ?? '') || 0;
  const colGap = Number.parseFloat(styles?.columnGap ?? '') || 0;
  const top0 = pillEls[0].offsetTop;
  const chipH = Math.max(pillEls[0].offsetHeight, 1);
  const maxBottom =
    top0 +
    RESULT_PAGES_MAX_COLLAPSED_ROWS * chipH +
    (RESULT_PAGES_MAX_COLLAPSED_ROWS - 1) * rowGap;

  const last = pillEls[pillEls.length - 1];
  const fitsInTwoRows = last.offsetTop + last.offsetHeight <= maxBottom + 0.5;
  const layoutReady = pillEls[0].offsetHeight > 1 && root.clientWidth > 0;
  // 레이아웃 미완료면 보수적으로 접기 (한 줄에 다 들어간 정상 케이스는 유지)
  if (!layoutReady && totalCount > 12) {
    return { needsCollapse: true, visibleCount: 12 };
  }
  if (fitsInTwoRows) {
    return { needsCollapse: false, visibleCount: totalCount };
  }

  /** 2줄 안에 들어오는 마지막 칩 개수 */
  let fitCount = 0;
  for (let i = 0; i < pillEls.length; i += 1) {
    const el = pillEls[i];
    if (el.offsetTop + el.offsetHeight <= maxBottom + 0.5) fitCount = i + 1;
    else break;
  }
  if (fitCount <= 0) {
    return { needsCollapse: true, visibleCount: 0 };
  }

  const hiddenIfFit = Math.max(0, totalCount - fitCount);
  const btnLabel = `＋ ${Math.max(hiddenIfFit, 1)}개 더 보기`;
  const btnWidth = Math.min(
    Math.max(root.clientWidth, 0) || 240,
    Math.max(96, 24 + btnLabel.length * 7.2),
  );

  const rootRight = root.getBoundingClientRect().right;
  let visibleCount = fitCount;
  while (visibleCount > 0) {
    const el = pillEls[visibleCount - 1];
    const spaceRight = rootRight - el.getBoundingClientRect().right - colGap;
    const onFirstRow = el.offsetTop <= top0 + chipH * 0.5;
    // 첫 줄 끝이면 버튼이 둘째 줄로 내려가도 OK
    if (onFirstRow || spaceRight >= btnWidth) break;
    visibleCount -= 1;
  }

  return {
    needsCollapse: true,
    visibleCount: Math.max(0, visibleCount),
  };
}

/**
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   selectedInstance?: import('../lib/ruleEngine.js').MatchInstance | null,
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
  selectedInstance = null,
  formatPageLabel = formatSystemPageLabel,
  onSelectPage,
  onSelectInstance,
  isInstanceVisible = () => true,
  onToggleInstanceVisibility,
}) {
  const pills = useMemo(() => buildInstancePills(instances), [instances]);
  const pillsSignature = useMemo(
    () => pills.map((entry) => instanceVisibilityKey(entry.inst)).join('\0'),
    [pills],
  );
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [expanded, setExpanded] = useState(false);
  /** null = 아직 측정 전(전체 칩 렌더) */
  const [collapse, setCollapse] = useState(
    /** @type {{ needsCollapse: boolean, visibleCount: number } | null} */ (
      null
    ),
  );

  useLayoutEffect(() => {
    setExpanded(false);
    setCollapse(null);
  }, [pillsSignature]);

  useLayoutEffect(() => {
    if (expanded || collapse !== null) return undefined;

    let cancelled = false;
    // collapse=null 로 전체 칩을 그린 다음 프레임에서 측정
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const root = rootRef.current;
      if (!root || pills.length === 0) {
        setCollapse({ needsCollapse: false, visibleCount: 0 });
        return;
      }
      setCollapse(fitPillsIntoTwoRows(root, pills.length));
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [collapse, expanded, pills.length, pillsSignature]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let lastWidth = root.getBoundingClientRect().width;
    let frame = 0;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width == null || Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setExpanded(false);
        setCollapse(null);
      });
    });
    ro.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [pillsSignature]);

  useLayoutEffect(() => {
    if (expanded || !collapse?.needsCollapse || !selectedInstance) return;
    const selectedIndex = pills.findIndex((entry) =>
      instancesMatch(entry.inst, selectedInstance),
    );
    if (selectedIndex >= collapse.visibleCount) {
      setExpanded(true);
    }
  }, [pills, selectedInstance, expanded, collapse]);

  if (!pills.length) return null;

  const measuring = !expanded && collapse === null;
  const needsCollapse = Boolean(collapse?.needsCollapse);
  const visiblePills =
    expanded || measuring || !needsCollapse
      ? pills
      : pills.slice(0, collapse?.visibleCount ?? 0);
  const hiddenCount = needsCollapse
    ? Math.max(0, pills.length - (collapse?.visibleCount ?? 0))
    : 0;
  const showExpandBtn = needsCollapse || expanded;

  return (
    <div
      ref={rootRef}
      className={`result-pages${measuring ? ' result-pages--measuring' : ''}`}
      role="list"
    >
      {visiblePills.map((entry) => (
        <InstancePill
          key={instanceVisibilityKey(entry.inst)}
          entry={entry}
          currentPage={currentPage}
          selectedInstance={selectedInstance}
          formatPageLabel={formatPageLabel}
          isInstanceVisible={isInstanceVisible}
          onSelectPage={onSelectPage}
          onSelectInstance={onSelectInstance}
          onToggleInstanceVisibility={onToggleInstanceVisibility}
        />
      ))}
      {showExpandBtn ? (
        <div
          className="result-page-chip-wrap"
          role="listitem"
          data-result-expand=""
        >
          <button
            type="button"
            className="result-pages-expand-btn"
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((open) => !open);
            }}
          >
            {expanded ? '접기' : `＋ ${hiddenCount}개 더 보기`}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   entry: InstancePillEntry,
 *   currentPage: number,
 *   selectedInstance: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel: (systemPage: number) => string,
 *   isInstanceVisible: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onSelectPage: (pageNum: number) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
function InstancePill({
  entry,
  currentPage,
  selectedInstance,
  formatPageLabel,
  isInstanceVisible,
  onSelectPage,
  onSelectInstance,
  onToggleInstanceVisibility,
}) {
  const { inst, indexOnPage, totalOnPage } = entry;
  const fragmentLabel = getInstanceFragmentLabel(indexOnPage, totalOnPage);
  const visible = isInstanceVisible(inst);
  const selected =
    selectedInstance != null && instancesMatch(inst, selectedInstance);
  const onCurrentPage = inst.pageNum === currentPage;

  function navigateToInstance() {
    if (onSelectInstance) onSelectInstance(inst);
    else onSelectPage(inst.pageNum);
  }

  return (
    <div className="result-page-chip-wrap" role="listitem" data-result-pill="">
      <button
        type="button"
        className={`page-chip${selected ? ' page-chip--current' : ''}${
          onCurrentPage && !selected ? ' page-chip--on-page' : ''
        }${!visible ? ' page-chip--hidden-instance' : ''}`}
        title={
          onToggleInstanceVisibility
            ? visible
              ? '좌클릭: 해당 위치로 이동 · 우클릭: 표시 제외'
              : '좌클릭: 해당 위치로 이동 · 우클릭: 표시 복원'
            : undefined
        }
        onClick={(event) => {
          event.stopPropagation();
          navigateToInstance();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (onToggleInstanceVisibility) {
            onToggleInstanceVisibility(inst);
          }
        }}
      >
        <span className="page-chip__page">{formatPageLabel(inst.pageNum)}</span>
        {fragmentLabel ? (
          <span className="page-chip__bundle page-chip__bundle--fragment">
            {fragmentLabel}
          </span>
        ) : null}
      </button>
    </div>
  );
}
