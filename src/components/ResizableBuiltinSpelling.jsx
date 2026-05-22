import { useCallback, useEffect, useRef, useState } from 'react';
import BuiltinSpellingPanel from './BuiltinSpellingPanel.jsx';
import CautionChecklist from './CautionChecklist.jsx';

const STORAGE_KEY = 'builtin-spelling-panel-height';
const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 720;

function readStoredHeight() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(n) && n >= MIN_HEIGHT && n <= MAX_HEIGHT) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_HEIGHT;
}

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   onBuiltInToggle: (find: string) => void,
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 * }} props
 */
export default function ResizableBuiltinSpelling({
  builtInEnabled,
  onBuiltInToggle,
  cautionEnabled,
  onCautionToggle,
}) {
  const [height, setHeight] = useState(readStoredHeight);
  const heightRef = useRef(height);
  const handleRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const activePointerId = useRef(null);

  heightRef.current = height;

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
        aria-label="아래 패널 높이 조절 — 위로 끌면 주의·맞춤법 영역이 넓어집니다"
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
          <div className="builtin-spelling-caution-scroll">
            <CautionChecklist
              cautionEnabled={cautionEnabled}
              onCautionToggle={onCautionToggle}
            />
          </div>
          <div className="builtin-spelling-rules-scroll">
            <BuiltinSpellingPanel
              builtInEnabled={builtInEnabled}
              onBuiltInToggle={onBuiltInToggle}
            />
          </div>
        </div>
      </section>
    </>
  );
}
