import { createPortal } from 'react-dom';
import { useRef } from 'react';
import { MANUSCRIPT_TOOLBOX_MODES } from '../lib/manuscriptWorkbench/modes.js';
import { isTipEditSideClickSuppressed } from '../lib/manuscriptWorkbench/tipEditGuard.js';

export const RAIL_STORAGE_KEY = 'indiya.manuscriptToolbox.rail';
const DOCK_SNAP_PX = 72;

/** @returns {{ docked: boolean, x: number, y: number }} */
export function readRailPlacement() {
  try {
    const raw = sessionStorage.getItem(RAIL_STORAGE_KEY);
    if (!raw) return { docked: true, x: 24, y: 120 };
    const parsed = JSON.parse(raw);
    return {
      docked: parsed?.docked !== false,
      x: Number.isFinite(parsed?.x) ? parsed.x : 24,
      y: Number.isFinite(parsed?.y) ? parsed.y : 120,
    };
  } catch {
    return { docked: true, x: 24, y: 120 };
  }
}

/** @param {{ docked: boolean, x: number, y: number }} next */
export function writeRailPlacement(next) {
  try {
    sessionStorage.setItem(RAIL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function clampRailPos(x, y, width, height) {
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

/** @param {{ iconId: string }} props */
export function ModeIcon({ iconId }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (iconId === 'search') {
    return (
      <svg {...common}>
        <circle cx="7.5" cy="7.5" r="4.25" />
        <path d="M11 11.25 14.5 14.75" />
      </svg>
    );
  }
  if (iconId === 'add') {
    return (
      <svg {...common}>
        <path d="M9 3.5v11M3.5 9h11" />
      </svg>
    );
  }
  /* 교정 부호: 줄을 바꿀 때 (계단) */
  if (iconId === 'paraSplit') {
    return (
      <svg {...common}>
        <path d="M3.5 12.5h5.5V5.5h5.5" />
      </svg>
    );
  }
  /* 행갈이: 이전 들여쓰기 아이콘(줄+들여 화살) */
  if (iconId === 'paraGap') {
    return (
      <svg {...common}>
        <path d="M3.5 4.5h11M8 9h6.5M8 13.5h6.5" />
        <path d="M3.5 8.25 6.25 10.5 3.5 12.75" />
      </svg>
    );
  }
  /* 교정 부호: ㄷ + 위아래 세로선 */
  return (
    <svg {...common}>
      <path d="M9 2.5V6.5h5v5H9V15.5" />
    </svg>
  );
}

function ModeButton({ item, mode, onModeChange }) {
  const on = mode === item.id;
  const className = on
    ? 'pdf-work-pane__aux-btn manuscript-toolbox__mode manuscript-toolbox__mode--icon manuscript-toolbox__mode--on'
    : 'pdf-work-pane__aux-btn manuscript-toolbox__mode manuscript-toolbox__mode--icon';
  return (
    <button
      type="button"
      className={className}
      aria-pressed={on}
      aria-label={item.label}
      title={item.label}
      onClick={() => {
        if (isTipEditSideClickSuppressed()) return;
        onModeChange(on ? null : item.id);
      }}
    >
      <ModeIcon iconId={item.iconId} />
    </button>
  );
}

export default function ManuscriptToolboxRail({
  mode,
  onModeChange,
  placement,
  setPlacement,
  slotRef,
  railRef,
}) {
  const dragRef = useRef(null);

  const applyPlacement = (next) => {
    setPlacement(next);
    writeRailPlacement(next);
  };

  const dock = () => {
    applyPlacement({ ...placement, docked: true });
  };

  const onHandlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    let origX = placement.x;
    let origY = placement.y;
    if (placement.docked && railRef.current) {
      const box = railRef.current.getBoundingClientRect();
      origX = box.left;
      origY = box.top;
      applyPlacement({ docked: false, x: origX, y: origY });
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX,
      origY,
    };

    const move = (ev) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const railEl = railRef.current;
      const w = railEl?.offsetWidth ?? 48;
      const h = railEl?.offsetHeight ?? 200;
      const next = clampRailPos(
        drag.origX + (ev.clientX - drag.startX),
        drag.origY + (ev.clientY - drag.startY),
        w,
        h,
      );
      applyPlacement({ docked: false, x: next.x, y: next.y });
    };

    const up = (ev) => {
      const drag = dragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const slotBox = slotRef.current?.getBoundingClientRect();
      const railBox = railRef.current?.getBoundingClientRect();
      if (slotBox && railBox) {
        const cx = railBox.left + railBox.width / 2;
        const cy = railBox.top + railBox.height / 2;
        const near =
          cx >= slotBox.left - DOCK_SNAP_PX &&
          cx <= slotBox.right + DOCK_SNAP_PX &&
          cy >= slotBox.top - DOCK_SNAP_PX &&
          cy <= slotBox.bottom + DOCK_SNAP_PX;
        if (near) {
          applyPlacement({ docked: true, x: drag.origX, y: drag.origY });
        }
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const railClass = placement.docked
    ? 'manuscript-toolbox__rail'
    : 'manuscript-toolbox__rail manuscript-toolbox__rail--floating';
  const railStyle = placement.docked
    ? undefined
    : { left: placement.x + 'px', top: placement.y + 'px' };

  const rail = (
    <div
      ref={railRef}
      className={railClass}
      style={railStyle}
      role="toolbar"
      aria-label="원고 작업대 도구"
    >
      <button
        type="button"
        className="manuscript-toolbox__handle"
        aria-label="도구 상자 옮기기. 더블클릭하면 원래 자리에 붙습니다."
        title="끌어서 떼기 · 더블클릭으로 붙이기"
        onPointerDown={onHandlePointerDown}
        onDoubleClick={(e) => {
          e.preventDefault();
          dock();
        }}
      />
      {MANUSCRIPT_TOOLBOX_MODES.map((item) => (
        <ModeButton
          key={item.id}
          item={item}
          mode={mode}
          onModeChange={onModeChange}
        />
      ))}
    </div>
  );

  const slotClass = placement.docked
    ? 'manuscript-toolbox__slot'
    : 'manuscript-toolbox__slot manuscript-toolbox__slot--empty';

  return (
    <>
      <div
        ref={slotRef}
        className={slotClass}
        aria-hidden={placement.docked ? undefined : true}
      >
        {placement.docked ? rail : null}
      </div>
      {!placement.docked && typeof document !== 'undefined'
        ? createPortal(rail, document.body)
        : null}
    </>
  );
}
