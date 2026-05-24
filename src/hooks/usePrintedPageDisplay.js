import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatPageLabel,
  formatPrintedPageText,
  formatSystemPageLabel,
  loadPageSettings,
  loadPrintedPagesEnabled,
  parsePrintedPageInput,
  pdfPageDisplayKey,
  savePageCalibration,
  savePageSettings,
  savePrintedPagesEnabled,
  shiftFromPrintedInput,
  systemPageFromDisplay,
  systemPageFromDisplayInput,
} from '../lib/printedPageDisplay.js';

/**
 * @param {{ pdfFileName: string | null, numPages: number, currentPage: number }} options
 */
export function usePrintedPageDisplay({ pdfFileName, numPages, currentPage }) {
  const [enabled, setEnabledState] = useState(loadPrintedPagesEnabled);
  const [shift, setShift] = useState(/** @type {number | null} */ (null));
  const [anchorPage, setAnchorPage] = useState(/** @type {number | null} */ (null));
  const [firstPageSingle, setFirstPageSingleState] = useState(true);
  const [spreadInput, setSpreadInput] = useState(false);

  const pdfKey = useMemo(
    () => (numPages > 0 ? pdfPageDisplayKey(pdfFileName, numPages) : null),
    [pdfFileName, numPages],
  );

  useEffect(() => {
    if (!pdfKey) {
      setShift(null);
      setAnchorPage(null);
      setFirstPageSingleState(true);
      return;
    }
    const saved = loadPageSettings(pdfKey);
    setShift(saved.shift ?? null);
    setAnchorPage(saved.anchorPage ?? null);
    setFirstPageSingleState(saved.firstPageSingle);
    setSpreadInput(false);
  }, [pdfKey]);

  const active = enabled && shift != null && anchorPage != null;

  const setEnabled = useCallback((next) => {
    setEnabledState(next);
    savePrintedPagesEnabled(next);
  }, []);

  const setFirstPageSingle = useCallback(
    (next) => {
      setFirstPageSingleState(next);
      if (!pdfKey) return;
      savePageSettings(pdfKey, { firstPageSingle: next });
    },
    [pdfKey],
  );

  const calibrateFromInput = useCallback(
    (raw, isSpread) => {
      if (!pdfKey) return;
      const trimmed = raw.trim();
      if (!trimmed) return;

      const parsed = parsePrintedPageInput(trimmed);
      if (!parsed) return;
      if (isSpread && parsed.start === parsed.end) return;

      const next = shiftFromPrintedInput(parsed, currentPage, firstPageSingle);
      if (next == null || !Number.isFinite(next)) return;

      setShift(next);
      setAnchorPage(currentPage);
      savePageCalibration(pdfKey, {
        shift: next,
        anchorPage: currentPage,
        firstPageSingle,
      });
    },
    [pdfKey, currentPage, firstPageSingle],
  );

  const clearCalibration = useCallback(() => {
    if (!pdfKey) return;
    setShift(null);
    setAnchorPage(null);
    savePageCalibration(pdfKey, null);
  }, [pdfKey]);

  const displayOpts = useMemo(
    () => ({
      shift,
      enabled,
      numPages,
      anchorPage: anchorPage ?? 1,
      firstPageSingle,
    }),
    [shift, enabled, numPages, anchorPage, firstPageSingle],
  );

  const formatPageText = useCallback(
    (systemPage) => {
      if (!enabled || !active) return String(systemPage);
      return formatPrintedPageText(
        systemPage,
        displayOpts.shift,
        true,
        displayOpts.numPages,
        displayOpts.anchorPage,
        displayOpts.firstPageSingle,
      );
    },
    [enabled, active, displayOpts],
  );

  const formatNaturalPreview = useCallback(
    (systemPage) =>
      formatPrintedPageText(
        systemPage,
        null,
        true,
        displayOpts.numPages,
        displayOpts.anchorPage,
        displayOpts.firstPageSingle,
      ),
    [displayOpts],
  );

  const formatPage = useCallback(
    (systemPage) => {
      if (!enabled) return systemPage;
      if (!active) return systemPage;
      const parsed = parsePrintedPageInput(formatPageText(systemPage));
      return parsed?.start ?? systemPage;
    },
    [enabled, active, formatPageText],
  );

  const formatLabel = useCallback(
    (systemPage) => {
      if (!enabled || !active) return formatSystemPageLabel(systemPage);
      return formatPageLabel(
        systemPage,
        displayOpts.shift,
        true,
        displayOpts.numPages,
        displayOpts.anchorPage,
        displayOpts.firstPageSingle,
      );
    },
    [enabled, active, displayOpts],
  );

  const toSystemPage = useCallback(
    (displayPage) =>
      systemPageFromDisplay(
        displayPage,
        displayOpts.shift,
        displayOpts.enabled,
        displayOpts.anchorPage,
        displayOpts.firstPageSingle,
      ),
    [displayOpts],
  );

  const toSystemPageFromInput = useCallback(
    (raw) =>
      systemPageFromDisplayInput(
        raw,
        displayOpts.shift,
        displayOpts.enabled,
        displayOpts.numPages,
        displayOpts.anchorPage,
        displayOpts.firstPageSingle,
      ),
    [displayOpts],
  );

  return {
    enabled,
    setEnabled,
    shift,
    anchorPage,
    firstPageSingle,
    setFirstPageSingle,
    spreadInput,
    setSpreadInput,
    active,
    calibrateFromInput,
    clearCalibration,
    formatPageText,
    formatNaturalPreview,
    formatPage,
    formatLabel,
    toSystemPage,
    toSystemPageFromInput,
    /** @deprecated */ offset: shift,
  };
}
