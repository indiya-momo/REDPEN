import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatSystemPageLabel } from '../lib/printedPageDisplay.js';
import { instanceVisibilityKey, instancesMatch } from '../lib/checkResultUtils.js';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';

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
 * 「＋ N개 더 보기」 래퍼 폭. DOM에 프로브로 재거나, 불가 시 한글 폭에 맞춘 추정.
 * @param {HTMLElement} root
 * @param {number} hiddenCount
 * @returns {number}
 */
export function estimateExpandBtnWidth(root, hiddenCount) {
  const label = `＋ ${Math.max(hiddenCount, 1)}개 더 보기`;
  const fallback = Math.min(
    Math.max(root.clientWidth, 0) || 240,
    // 0.72rem + padding — 한글·전각은 char*7.2로는 너무 좁음
    Math.max(120, 32 + [...label].length * 11),
  );

  if (
    typeof document === 'undefined' ||
    typeof root.appendChild !== 'function' ||
    typeof root.removeChild !== 'function'
  ) {
    return fallback;
  }

  const wrap = document.createElement('div');
  wrap.className = 'result-page-chip-wrap';
  wrap.setAttribute('data-result-expand', '');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'result-pages-expand-btn';
  btn.textContent = label;
  wrap.appendChild(btn);
  root.appendChild(wrap);
  const width = wrap.getBoundingClientRect().width;
  root.removeChild(wrap);
  // 서브픽셀·보더 오차
  return Math.max(width + 4, 1);
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

  const rootRight = root.getBoundingClientRect().right;
  let visibleCount = fitCount;
  while (visibleCount > 0) {
    const hiddenCount = Math.max(0, totalCount - visibleCount);
    const btnWidth = estimateExpandBtnWidth(root, hiddenCount);
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
 * 접힌 렌더에서 「더 보기」가 넘치면 칩을 더 줄인 visibleCount.
 * @param {HTMLElement} root
 * @param {number} visibleCount
 * @returns {number}
 */
export function shrinkVisibleCountForExpandOverflow(root, visibleCount) {
  if (visibleCount <= 0) return 0;
  const expandEl = /** @type {HTMLElement | null} */ (
    root.querySelector('[data-result-expand]')
  );
  if (!expandEl) return visibleCount;

  const pillEls = /** @type {HTMLElement[]} */ ([
    ...root.querySelectorAll('[data-result-pill]'),
  ]);
  if (pillEls.length === 0) return visibleCount;

  const styles =
    typeof getComputedStyle === 'function' ? getComputedStyle(root) : null;
  const rowGap = Number.parseFloat(styles?.rowGap ?? '') || 0;
  const top0 = pillEls[0].offsetTop;
  const chipH = Math.max(pillEls[0].offsetHeight, 1);
  const maxBottom =
    top0 +
    RESULT_PAGES_MAX_COLLAPSED_ROWS * chipH +
    (RESULT_PAGES_MAX_COLLAPSED_ROWS - 1) * rowGap;
  const rootRight = root.getBoundingClientRect().right;
  const expandRect = expandEl.getBoundingClientRect();
  const overflowRight = expandRect.right > rootRight + 0.5;
  const overflowBottom =
    expandEl.offsetTop + expandEl.offsetHeight > maxBottom + 0.5;
  if (!overflowRight && !overflowBottom) return visibleCount;
  return visibleCount - 1;
}

/**
 * 레이아웃 접힘 결과에 하드 상한을 적용 (예: 표기 통일 추천 3개).
 * @param {{ needsCollapse: boolean, visibleCount: number }} fitted
 * @param {number} pillCount
 * @param {number | null | undefined} limit
 */
export function applyCollapsedVisibleLimit(fitted, pillCount, limit) {
  if (limit == null || limit < 1 || pillCount <= 0) return fitted;
  if (pillCount <= limit) {
    if (!fitted.needsCollapse) {
      return { needsCollapse: false, visibleCount: pillCount };
    }
    return {
      needsCollapse: true,
      visibleCount: Math.min(fitted.visibleCount, pillCount),
    };
  }
  const layoutCap = fitted.needsCollapse
    ? fitted.visibleCount
    : pillCount;
  return {
    needsCollapse: true,
    visibleCount: Math.max(1, Math.min(layoutCap, limit)),
  };
}

/**
 * 개수 상한만으로 접힘 결정 (폭 측정 없음 — 너비 변경에 흔들리지 않음)
 * @param {number} pillCount
 * @param {number} limit
 * @returns {{ needsCollapse: boolean, visibleCount: number }}
 */
export function collapseByVisibleLimit(pillCount, limit) {
  if (pillCount <= 0) return { needsCollapse: false, visibleCount: 0 };
  if (limit < 1 || pillCount <= limit) {
    return { needsCollapse: false, visibleCount: pillCount };
  }
  return {
    needsCollapse: true,
    visibleCount: limit,
  };
}

/**
 * 접힘 펼침 버튼 문구
 * @param {boolean} expanded
 * @param {number} hiddenCount
 * @param {'more' | 'elsewhere'} mode
 */
export function formatResultPagesExpandLabel(
  expanded,
  hiddenCount,
  mode = 'more',
) {
  if (expanded) return '접기';
  if (mode === 'elsewhere') return `외 ${hiddenCount}곳`;
  return `＋ ${Math.max(hiddenCount, 1)}개 더 보기`;
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
 *   collapsedVisibleLimit?: number | null,
 *   expandLabelMode?: 'more' | 'elsewhere',
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
  collapsedVisibleLimit = null,
  expandLabelMode = 'more',
}) {
  const pills = useMemo(() => buildInstancePills(instances), [instances]);
  const pillsSignature = useMemo(
    () => pills.map((entry) => instanceVisibilityKey(entry.inst)).join('\0'),
    [pills],
  );
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const expandedRef = useRef(false);
  /** 펼침/접힘으로 스크롤바가 생겨 폭이 변할 때 Remeasure 무시 */
  const ignoreWidthResizeUntilRef = useRef(0);
  const hardCountLimit =
    expandLabelMode === 'elsewhere' ||
    (collapsedVisibleLimit != null && collapsedVisibleLimit > 0);

  const resolveHardCollapse = () => {
    const limit =
      collapsedVisibleLimit != null && collapsedVisibleLimit > 0
        ? collapsedVisibleLimit
        : 1;
    if (expandLabelMode === 'elsewhere' && pills.length > 1) {
      return {
        needsCollapse: true,
        visibleCount: Math.min(limit, Math.max(1, pills.length - 1)),
      };
    }
    return collapseByVisibleLimit(pills.length, limit);
  };

  const [expanded, setExpanded] = useState(false);
  /** null = 아직 측정 전(전체 칩 렌더). 개수 상한 모드는 처음부터 확정 */
  const [collapse, setCollapse] = useState(
    /** @type {{ needsCollapse: boolean, visibleCount: number } | null} */ (
      () => (hardCountLimit ? resolveHardCollapse() : null)
    ),
  );

  expandedRef.current = expanded;

  useLayoutEffect(() => {
    setExpanded(false);
    expandedRef.current = false;
    // 개수 상한: null로 풀지 않음(전체 칩 깜빡임·너비 버그 재발 방지)
    setCollapse(hardCountLimit ? resolveHardCollapse() : null);
  }, [pillsSignature, hardCountLimit, collapsedVisibleLimit, expandLabelMode, pills.length]);

  useLayoutEffect(() => {
    if (expanded || collapse !== null) return undefined;

    // 개수 상한은 위 effect에서 이미 확정
    if (hardCountLimit) return undefined;

    let cancelled = false;
    // collapse=null 로 전체 칩을 그린 다음 프레임에서 측정
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const root = rootRef.current;
      if (!root || pills.length === 0) {
        setCollapse({ needsCollapse: false, visibleCount: 0 });
        return;
      }
      const fitted = fitPillsIntoTwoRows(root, pills.length);
      setCollapse(fitted);
      // 접힘 후 스크롤바·폭 변화로 ResizeObserver가 즉시 재측정하지 않게
      ignoreWidthResizeUntilRef.current = performance.now() + 400;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    collapse,
    expanded,
    hardCountLimit,
    pills.length,
    pillsSignature,
  ]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;

    // 개수 상한 모드에서는 너비와 무관 — 리사이즈 재측정 불필요
    if (hardCountLimit) return undefined;

    let lastWidth = root.getBoundingClientRect().width;
    let frame = 0;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width == null || Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;

      // 펼침으로 부모 스크롤바가 생겨 폭이 줄어도 접지 않음 (잔상 버그 방지)
      if (expandedRef.current) return;
      if (performance.now() < ignoreWidthResizeUntilRef.current) return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (expandedRef.current) return;
        setCollapse(null);
      });
    });
    ro.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [pillsSignature, hardCountLimit]);

  useLayoutEffect(() => {
    if (expanded || !collapse?.needsCollapse || !selectedInstance) return;
    const selectedIndex = pills.findIndex((entry) =>
      instancesMatch(entry.inst, selectedInstance),
    );
    if (selectedIndex >= 0 && selectedIndex >= collapse.visibleCount) {
      ignoreWidthResizeUntilRef.current = performance.now() + 400;
      setExpanded(true);
    }
  }, [pills, selectedInstance, expanded, collapse]);

  // 접힌 뒤 실제 「더 보기」가 넘치면 칩을 한 개 더 줄임 (개수 상한·펼침 제외)
  useLayoutEffect(() => {
    if (
      hardCountLimit ||
      expanded ||
      !collapse?.needsCollapse ||
      collapse.visibleCount <= 0
    ) {
      return undefined;
    }
    const root = rootRef.current;
    if (!root) return undefined;

    const next = shrinkVisibleCountForExpandOverflow(
      root,
      collapse.visibleCount,
    );
    if (next >= collapse.visibleCount) return undefined;
    if (next < 1) return undefined;

    setCollapse({
      needsCollapse: true,
      visibleCount: next,
    });
    ignoreWidthResizeUntilRef.current = performance.now() + 400;
    return undefined;
  }, [collapse, expanded, pillsSignature, hardCountLimit]);

  if (!pills.length) return null;

  const measuring = !expanded && collapse === null && !hardCountLimit;
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
      className={`result-pages${measuring ? ' result-pages--measuring' : ''}${
        expanded ? ' result-pages--expanded' : ''
      }`}
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
              // 펼침/접힘 직후 스크롤바 폭 변화를 Remeasure로 오인하지 않음
              ignoreWidthResizeUntilRef.current = performance.now() + 400;
              setExpanded((open) => {
                if (open) {
                  // 접을 때: 개수 상한은 즉시 복구, 그 외는 폭 재측정
                  setCollapse(hardCountLimit ? resolveHardCollapse() : null);
                }
                return !open;
              });
            }}
          >
            {formatResultPagesExpandLabel(
              expanded,
              hiddenCount,
              expandLabelMode,
            )}
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

  const tip = onToggleInstanceVisibility
    ? visible
      ? '좌클릭: 해당 위치로 이동 · 우클릭: 표시 제외'
      : '좌클릭: 해당 위치로 이동 · 우클릭: 표시 복원'
    : undefined;

  return (
    <div className="result-page-chip-wrap" role="listitem" data-result-pill="">
      <CriteriaHoverTip tip={tip} variant="wrap">
        <button
          type="button"
          className={`page-chip${selected ? ' page-chip--current' : ''}${
            onCurrentPage && !selected ? ' page-chip--on-page' : ''
          }${!visible ? ' page-chip--hidden-instance' : ''}`}
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
      </CriteriaHoverTip>
    </div>
  );
}
