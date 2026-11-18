import { describe, expect, it } from 'vitest';
import {
  PDF_SIZE_MAX_BYTES,
  PDF_SIZE_MAX_BYTES_TERMINAL,
  PDF_SIZE_WARN_BYTES,
  isPdfSizeOverMax,
  isPdfSizeOverMaxTerminal,
  isPdfSizeOverWarn,
} from './pdfSizeLimits.js';

describe('pdfSizeLimits', () => {
  it('warn band is above 50MB and at or below 100MB (browser)', () => {
    expect(isPdfSizeOverWarn(50 * 1024 * 1024)).toBe(false);
    expect(isPdfSizeOverWarn(50 * 1024 * 1024 + 1)).toBe(true);
    expect(isPdfSizeOverWarn(PDF_SIZE_MAX_BYTES)).toBe(true);
  });

  it('browser blocks above 100MB', () => {
    expect(isPdfSizeOverMax(PDF_SIZE_MAX_BYTES)).toBe(false);
    expect(isPdfSizeOverMax(PDF_SIZE_MAX_BYTES + 1)).toBe(true);
    expect(isPdfSizeOverWarn(PDF_SIZE_MAX_BYTES + 1)).toBe(false);
  });

  it('terminal allows up to 150MB and blocks above', () => {
    expect(PDF_SIZE_MAX_BYTES_TERMINAL).toBe(150 * 1024 * 1024);
    expect(PDF_SIZE_WARN_BYTES).toBe(50 * 1024 * 1024);
    expect(isPdfSizeOverMaxTerminal(PDF_SIZE_MAX_BYTES + 1)).toBe(false);
    expect(isPdfSizeOverMaxTerminal(PDF_SIZE_MAX_BYTES_TERMINAL)).toBe(false);
    expect(isPdfSizeOverMaxTerminal(PDF_SIZE_MAX_BYTES_TERMINAL + 1)).toBe(
      true,
    );
  });
});
