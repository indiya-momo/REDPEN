import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'panel-left-width';
export const PANEL_LEFT_DEFAULT_WIDTH = 420;
export const PANEL_LEFT_MIN_WIDTH = 320;
export const PANEL_LEFT_MAX_WIDTH = 720;
const RIGHT_MIN = 320;

const DEFAULT_WIDTH = PANEL_LEFT_DEFAULT_WIDTH;
const MIN_WIDTH = PANEL_LEFT_MIN_WIDTH;
const MAX_WIDTH = PANEL_LEFT_MAX_WIDTH;

function readStoredWidth() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH;
}

function clampWidth(next) {
  const max = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, window.innerWidth - RIGHT_MIN),
  );
  return Math.min(max, Math.max(MIN_WIDTH, next));
}

export function useResizablePanelWidth() {
  const [width, setWidth] = useState(readStoredWidth);
  const widthRef = useRef(width);
  const handleRef = useRef(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const activePointerId = useRef(null);

  widthRef.current = width;

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    setWidth(clampWidth(startW.current + delta));
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
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
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

  useEffect(() => {
    function onResize() {
      setWidth((w) => clampWidth(w));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startDrag = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = widthRef.current;
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const panelStyle = {
    width,
    minWidth: width,
    maxWidth: width,
  };

  return {
    panelStyle,
    handleRef,
    startDrag,
  };
}
