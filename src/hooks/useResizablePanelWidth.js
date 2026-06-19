import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearLegacyPanelLeftWidthLocalStorage,
  persistSessionPanelLeftWidth,
  readSessionPanelLeftWidth,
} from '../lib/panelLeftWidthSession.js';

const RESIZE_HANDLE_WIDTH = 8;

export const PANEL_LEFT_DEFAULT_WIDTH = 540;
/** 기준 이름·저장·탭이 한 줄에 들어갈 최소 폭 */
export const PANEL_LEFT_MIN_WIDTH = 400;
export const PANEL_LEFT_MAX_WIDTH = 720;
const RIGHT_MIN = 360;

const DEFAULT_WIDTH = PANEL_LEFT_DEFAULT_WIDTH;
const MIN_WIDTH = PANEL_LEFT_MIN_WIDTH;
const MAX_WIDTH = PANEL_LEFT_MAX_WIDTH;

/**
 * @param {number} preferred
 * @param {number} [viewportWidth]
 */
export function clampPanelLeftWidth(preferred, viewportWidth = window.innerWidth) {
  const max = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, viewportWidth - RIGHT_MIN - RESIZE_HANDLE_WIDTH),
  );
  return Math.min(max, Math.max(MIN_WIDTH, preferred));
}

/**
 * 로그인 uid 기준 sessionStorage — F5·대문 왕복 유지, 로그아웃 시 초기화.
 * @param {string} [authUid]
 */
export function useResizablePanelWidth(authUid = '') {
  const uid = String(authUid ?? '').trim();
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const [preferredWidth, setPreferredWidth] = useState(
    () => readSessionPanelLeftWidth(uid) ?? DEFAULT_WIDTH,
  );
  const [viewportWidth, setViewportWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : 1280),
  );
  const width = useMemo(
    () => clampPanelLeftWidth(preferredWidth, viewportWidth),
    [preferredWidth, viewportWidth],
  );
  const widthRef = useRef(width);
  const preferredWidthRef = useRef(preferredWidth);
  const handleRef = useRef(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const activePointerId = useRef(null);

  widthRef.current = width;
  preferredWidthRef.current = preferredWidth;

  useEffect(() => {
    clearLegacyPanelLeftWidthLocalStorage();
  }, []);

  useEffect(() => {
    setPreferredWidth(readSessionPanelLeftWidth(uid) ?? DEFAULT_WIDTH);
  }, [uid]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    const next = clampPanelLeftWidth(startW.current + delta, viewportWidth);
    preferredWidthRef.current = next;
    setPreferredWidth(next);
  }, [viewportWidth]);

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    persistSessionPanelLeftWidth(
      uidRef.current,
      preferredWidthRef.current,
    );
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
      setViewportWidth(window.innerWidth);
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
    minWidth: MIN_WIDTH,
    maxWidth: width,
    flexShrink: 0,
  };

  return {
    panelStyle,
    handleRef,
    startDrag,
  };
}
