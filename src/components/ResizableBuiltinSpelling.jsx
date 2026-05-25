import { useCallback, useEffect, useRef, useState } from 'react';
import BuiltinSpellingPanel from './BuiltinSpellingPanel.jsx';
import CautionChecklist from './CautionChecklist.jsx';

const STORAGE_KEY = 'builtin-spelling-panel-height-v2';
const DEFAULT_BOTTOM_RATIO = 0.44;
const HANDLE_HEIGHT = 10;
const FALLBACK_HEIGHT = 340;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 720;

function readStoredHeight() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(n) && n >= MIN_HEIGHT && n <= MAX_HEIGHT) return n;
  } catch {
    /* ignore */
  }
  return null;
}

function computeDefaultHeight(layoutEl) {
  const total = layoutEl.getBoundingClientRect().height;
  if (total < MIN_HEIGHT + 100) return FALLBACK_HEIGHT;
  const next = Math.round((total - HANDLE_HEIGHT) * DEFAULT_BOTTOM_RATIO);
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next));
}

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   onBuiltInToggle: (find: string) => void,
 *   onBuiltInSetAll: (enabled: boolean) => void,
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 *   onCautionSetAll: (enabled: boolean) => void,
 * }} props
 */
export default function ResizableBuiltinSpelling({
  builtInEnabled,
  onBuiltInToggle,
  onBuiltInSetAll,
  cautionEnabled,
  onCautionToggle,
  onCautionSetAll,
}) {
  const [height, setHeight] = useState(
    () => readStoredHeight() ?? FALLBACK_HEIGHT,
  );
  const heightRef = useRef(height);
  const handleRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const activePointerId = useRef(null);
  const defaultApplied = useRef(Boolean(readStoredHeight()));

  heightRef.current = height;

  useEffect(() => {
    if (defaultApplied.current) return;

    function applyDefault() {
      const layout = document.querySelector('.spelling-tab-layout');
      if (!layout) return;
      const h = layout.getBoundingClientRect().height;
      if (h < MIN_HEIGHT + 100) return;
      defaultApplied.current = true;
      setHeight(computeDefaultHeight(layout));
    }

    applyDefault();
    const id = requestAnimationFrame(applyDefault);
    const t = window.setTimeout(applyDefault, 80);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const delta = startY.current - e.clientY;
    const next = Math.min(
      MAX_HEIGHT,
      Math.max(MIN_HEIGHT, startH.current + delta),
    );
    setHeight(next);
  }, []);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const handle = handleRef.current;
    if (handle && activePointerId.current != null) {
      try {
        if (handle.hasPointerCapture(activePointerId.current)) {
          handle.releasePointerCapture(activePointerId.current);
        }
      } catch {
        /* ignore */
      }
    }
    activePointerId.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    defaultApplied.current = true;
    try {
      localStorage.setItem(STORAGE_KEY, String(heightRef.current));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [onPointerMove, endDrag]);

  function startDrag(e) {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <>
      <div
        ref={handleRef}
        className="builtin-spelling-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        aria-label="아래 패널 높이 조절 — 위로 끌면 편집자 검토·맞춤법 확인 영역이 넓어집니다"
        title="높이 조절 (드래그)"
        onPointerDown={startDrag}
      >
        <span className="builtin-spelling-resize-grip" aria-hidden>
          ⋮⋮
        </span>
      </div>
      <section
        className="panel-section panel-section--builtin-spelling"
        style={{ height }}
      >
        <div className="builtin-spelling-resize-body">
          <div className="builtin-spelling-caution-scroll custom-scrollbar">
            <CautionChecklist
              cautionEnabled={cautionEnabled}
              onCautionToggle={onCautionToggle}
              onCautionSetAll={onCautionSetAll}
            />
          </div>
          <div className="builtin-spelling-rules-scroll custom-scrollbar">
            <BuiltinSpellingPanel
              builtInEnabled={builtInEnabled}
              onBuiltInToggle={onBuiltInToggle}
              onBuiltInSetAll={onBuiltInSetAll}
            />
          </div>
        </div>
      </section>
    </>
  );
}
