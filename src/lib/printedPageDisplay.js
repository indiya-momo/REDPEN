const ENABLED_KEY = 'pdf-proofread-printed-pages-enabled';
const OFFSETS_KEY = 'pdf-proofread-page-offsets';

/** @type {'P'} */
export const PAGE_LABEL_SUFFIX = 'P';

/**
 * @param {string} pageText
 */
export function appendPageLabelSuffix(pageText) {
  const base = String(pageText)
    .trim()
    .replace(/^P\./i, '')
    .replace(/P$/i, '');
  return `${base}${PAGE_LABEL_SUFFIX}`;
}

/**
 * @param {number} systemPage
 */
export function formatSystemPageLabel(systemPage) {
  return appendPageLabelSuffix(String(systemPage));
}

/**
 * @param {string} label
 */
export function stripPageLabelPrefix(label) {
  return String(label)
    .trim()
    .replace(/^P\./i, '')
    .replace(/P$/i, '');
}

/**
 * @typedef {{
 *   shift?: number,
 *   anchorPage?: number,
 *   firstPageSingle?: boolean,
 * }} PageDisplaySettings
 */

/**
 * @param {string | null | undefined} fileName
 * @param {number} numPages
 */
export function pdfPageDisplayKey(fileName, numPages) {
  const name = (fileName ?? '').trim() || 'unknown';
  return `${name}::${numPages}`;
}

export function loadPrintedPagesEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} enabled */
export function savePrintedPagesEnabled(enabled) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** @returns {Record<string, unknown>} */
function loadOffsetMap() {
  try {
    const raw = localStorage.getItem(OFFSETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, unknown>} map */
function saveOffsetMap(map) {
  try {
    localStorage.setItem(OFFSETS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * @param {unknown} value
 * @returns {PageDisplaySettings | null}
 */
function normalizeSettings(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { shift: value, anchorPage: 1, firstPageSingle: true };
  }
  if (value && typeof value === 'object') {
    const record = /** @type {Record<string, unknown>} */ (value);
    const shift = Number.isFinite(record.shift)
      ? Number(record.shift)
      : Number.isFinite(record.offset)
        ? Number(record.offset)
        : undefined;
    const anchorPage = Number.isFinite(record.anchorPage)
      ? Number(record.anchorPage)
      : undefined;
    const firstPageSingle =
      typeof record.firstPageSingle === 'boolean'
        ? record.firstPageSingle
        : true;
    if (shift != null && anchorPage != null) {
      return { shift, anchorPage, firstPageSingle };
    }
    if (typeof record.firstPageSingle === 'boolean') {
      return { firstPageSingle: record.firstPageSingle };
    }
  }
  return null;
}

/**
 * @param {string} pdfKey
 * @returns {PageDisplaySettings}
 */
export function loadPageSettings(pdfKey) {
  const map = loadOffsetMap();
  const saved = normalizeSettings(map[pdfKey]);
  return {
    shift: saved?.shift,
    anchorPage: saved?.anchorPage,
    firstPageSingle: saved?.firstPageSingle ?? true,
  };
}

/**
 * @param {string} pdfKey
 * @returns {PageDisplaySettings | null}
 */
export function loadPageCalibration(pdfKey) {
  const settings = loadPageSettings(pdfKey);
  if (settings.shift == null || settings.anchorPage == null) return null;
  return {
    shift: settings.shift,
    anchorPage: settings.anchorPage,
    firstPageSingle: settings.firstPageSingle,
  };
}

/** @deprecated */
export function loadPageOffset(pdfKey) {
  return loadPageCalibration(pdfKey)?.shift ?? null;
}

/**
 * @param {string} pdfKey
 * @param {PageDisplaySettings | null} settings
 */
export function savePageSettings(pdfKey, settings) {
  const map = loadOffsetMap();
  if (settings == null) {
    delete map[pdfKey];
    saveOffsetMap(map);
    return;
  }

  const prev = loadPageSettings(pdfKey);
  /** @type {PageDisplaySettings} */
  const next = {
    firstPageSingle: settings.firstPageSingle ?? prev.firstPageSingle,
  };
  if (settings.shift !== undefined) {
    next.shift = settings.shift;
  } else if (prev.shift != null) {
    next.shift = prev.shift;
  }
  if (settings.anchorPage !== undefined) {
    next.anchorPage = settings.anchorPage;
  } else if (prev.anchorPage != null) {
    next.anchorPage = prev.anchorPage;
  }

  if (
    next.shift == null &&
    next.anchorPage == null &&
    next.firstPageSingle === true
  ) {
    delete map[pdfKey];
  } else {
    map[pdfKey] = next;
  }
  saveOffsetMap(map);
}

/**
 * @param {string} pdfKey
 * @param {PageDisplaySettings | null} calibration
 */
export function savePageCalibration(pdfKey, calibration) {
  if (calibration == null) {
    const prev = loadPageSettings(pdfKey);
    savePageSettings(pdfKey, {
      firstPageSingle: prev.firstPageSingle,
      shift: undefined,
      anchorPage: undefined,
    });
    return;
  }
  savePageSettings(pdfKey, calibration);
}

/** @deprecated */
export function savePageOffset(pdfKey, offset) {
  if (offset == null) {
    savePageCalibration(pdfKey, null);
    return;
  }
  savePageCalibration(pdfKey, { shift: offset, anchorPage: 1 });
}

/**
 * @typedef {{ start: number, end: number }} PrintedPageRange
 */

/**
 * @param {string} raw
 * @returns {PrintedPageRange | null}
 */
export function parsePrintedPageInput(raw) {
  const trimmed = raw
    .trim()
    .replace(/^P\./i, '')
    .replace(/P$/i, '');
  if (!trimmed) return null;

  const rangeMatch = trimmed.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start <= 0 ||
      end <= 0
    ) {
      return null;
    }
    return { start, end };
  }

  const single = Number.parseInt(trimmed, 10);
  if (Number.isFinite(single) && single > 0) {
    return { start: single, end: single };
  }

  return null;
}

/**
 * @param {number} systemPage
 * @param {boolean} [firstPageSingle]
 */
export function naturalPrintedLeft(systemPage, firstPageSingle = true) {
  if (systemPage <= 1) return 1;
  if (firstPageSingle) return 2 * (systemPage - 1);
  return 2 * systemPage - 1;
}

/**
 * @param {number} systemPage
 * @param {number} shift
 * @param {number} anchorPage
 */
export function printedShiftForPage(systemPage, shift, anchorPage) {
  if (systemPage < anchorPage) return 0;
  return shift;
}

/**
 * @param {PrintedPageRange} parsed
 * @param {number} systemPage
 * @param {boolean} [firstPageSingle]
 */
export function shiftFromPrintedInput(parsed, systemPage, firstPageSingle = true) {
  if (!parsed || !Number.isFinite(systemPage)) return null;

  const { start, end } = parsed;
  if (start === end) return start - systemPage;

  if (end < start) return start - naturalPrintedLeft(systemPage, firstPageSingle);

  if (end === start + 1) {
    return start - naturalPrintedLeft(systemPage, firstPageSingle);
  }

  return start - naturalPrintedLeft(systemPage, firstPageSingle);
}

/**
 * @param {number} systemPage
 * @param {number | null} shift
 * @param {boolean} enabled
 * @param {number} [anchorPage]
 */
export function displayPageNumber(
  systemPage,
  shift,
  enabled,
  anchorPage = 1,
  firstPageSingle = true,
) {
  if (!enabled) return systemPage;
  if (systemPage <= 1 && firstPageSingle) return 1;

  const pageShift =
    shift != null ? printedShiftForPage(systemPage, shift, anchorPage) : 0;
  return naturalPrintedLeft(systemPage, firstPageSingle) + pageShift;
}

/**
 * @param {number} systemPage
 * @param {number | null} shift
 * @param {boolean} enabled
 * @param {number} [_numPages]
 * @param {number} [anchorPage]
 */
export function formatPrintedPageText(
  systemPage,
  shift,
  enabled,
  _numPages = Number.MAX_SAFE_INTEGER,
  anchorPage = 1,
  firstPageSingle = true,
) {
  if (!enabled) return String(systemPage);

  if (systemPage <= 1 && firstPageSingle) return '1';

  const pageShift =
    shift != null ? printedShiftForPage(systemPage, shift, anchorPage) : 0;
  const left = naturalPrintedLeft(systemPage, firstPageSingle) + pageShift;
  return `${left}-${left + 1}`;
}

/**
 * @param {number} displayPage
 * @param {number | null} shift
 * @param {boolean} enabled
 * @param {number} [anchorPage]
 */
export function systemPageFromDisplay(
  displayPage,
  shift,
  enabled,
  anchorPage = 1,
  firstPageSingle = true,
) {
  if (!enabled) return displayPage;
  const effectiveShift = shift ?? 0;
  const effectiveAnchor = shift != null ? anchorPage : 1;
  return systemPageFromPrintedLeft(
    displayPage,
    effectiveShift,
    effectiveAnchor,
    firstPageSingle,
  );
}

/**
 * @param {number} targetLeft
 * @param {number} shift
 * @param {number} anchorPage
 * @param {boolean} [firstPageSingle]
 */
export function systemPageFromPrintedLeft(
  targetLeft,
  shift,
  anchorPage,
  firstPageSingle = true,
) {
  if (targetLeft <= 1 && firstPageSingle) return 1;

  const naturalAtAnchor = naturalPrintedLeft(anchorPage, firstPageSingle);
  const bodyPage = (targetLeft - shift) / 2 + 1;
  if (
    Number.isFinite(bodyPage) &&
    bodyPage >= anchorPage &&
    Number.isInteger(bodyPage)
  ) {
    return bodyPage;
  }

  const frontPage = targetLeft / 2 + 1;
  if (Number.isFinite(frontPage) && frontPage >= 2 && frontPage < anchorPage) {
    return frontPage;
  }

  if (targetLeft === naturalAtAnchor + shift) return anchorPage;

  return Math.max(1, Math.round(targetLeft / 2 + 1));
}

/**
 * @param {string} raw
 * @param {number | null} shift
 * @param {boolean} enabled
 * @param {number} numPages
 * @param {number} [anchorPage]
 * @returns {number | null}
 */
export function systemPageFromDisplayInput(
  raw,
  shift,
  enabled,
  numPages,
  anchorPage = 1,
  firstPageSingle = true,
) {
  const parsed = parsePrintedPageInput(raw);
  if (!parsed) {
    if (!enabled) {
      const n = Number.parseInt(raw.trim(), 10);
      return Number.isFinite(n)
        ? Math.min(numPages, Math.max(1, n))
        : null;
    }
    return null;
  }

  const effectiveShift = shift ?? 0;
  const effectiveAnchor = shift != null ? anchorPage : 1;

  const system = systemPageFromPrintedLeft(
    parsed.start,
    effectiveShift,
    effectiveAnchor,
    firstPageSingle,
  );
  if (!Number.isFinite(system)) return null;
  return Math.min(numPages, Math.max(1, system));
}

/**
 * @param {number} systemPage
 * @param {number | null} shift
 * @param {boolean} enabled
 * @param {number} [numPages]
 * @param {number} [anchorPage]
 * @param {boolean} [firstPageSingle]
 */
export function formatPageLabel(
  systemPage,
  shift,
  enabled,
  numPages = 1,
  anchorPage = 1,
  firstPageSingle = true,
) {
  return appendPageLabelSuffix(
    formatPrintedPageText(
      systemPage,
      shift,
      enabled,
      numPages,
      anchorPage,
      firstPageSingle,
    ),
  );
}

/**
 * @param {number} shift
 */
export function formatOffsetLabel(shift) {
  if (shift >= 0) return `+${shift}`;
  return String(shift);
}

/** @deprecated */
export function offsetFromPrintedInput(parsed, systemPage) {
  return shiftFromPrintedInput(parsed, systemPage);
}

/** @deprecated */
export function offsetFromCalibration(printedPage, systemPage) {
  return printedPage - systemPage;
}

/** @deprecated */
export function effectiveOffset(systemPage, offset, anchorPage) {
  return printedShiftForPage(systemPage, offset, anchorPage);
}

/** @deprecated */
export function spreadPairStart(systemPage) {
  return systemPage;
}
