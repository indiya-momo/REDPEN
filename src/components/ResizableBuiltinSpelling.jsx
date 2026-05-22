import { useCallback, useEffect, useRef, useState } from 'react';
import BuiltinSpellingPanel from './BuiltinSpellingPanel.jsx';
import CautionChecklist from './CautionChecklist.jsx';

const STORAGE_KEY = 'builtin-spelling-panel-height';
const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 520;

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
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

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
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <section
      className="panel-section panel-section--builtin-spelling"
      style={{ height, flexShrink: 0 }}
    >
      <div
        className="builtin-spelling-resize-handle"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={height}
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={MAX_HEIGHT}
        aria-label="내장 맞춤법 규칙 영역 높이 조절"
        onPointerDown={startDrag}
      />
      <div className="builtin-spelling-resize-body">
        <CautionChecklist
          cautionEnabled={cautionEnabled}
          onCautionToggle={onCautionToggle}
        />
        <div className="builtin-spelling-panel-scroll">
          <BuiltinSpellingPanel
            builtInEnabled={builtInEnabled}
            onBuiltInToggle={onBuiltInToggle}
          />
        </div>
      </div>
    </section>
  );
}
