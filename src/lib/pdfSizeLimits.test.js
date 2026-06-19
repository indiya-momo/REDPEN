import { describe, expect, it } from 'vitest';
import {
  PDF_SIZE_MAX_BYTES,
  PDF_SIZE_WARN_BYTES,
  isPdfSizeOverMax,
  isPdfSizeOverWarn,
} from './pdfSizeLimits.js';

describe('pdfSizeLimits', () => {
  it('warn band is above 50MB and at or below 100MB', () => {
    expect(isPdfSizeOverWarn(50 * 1024 * 1024)).toBe(false);
    expect(isPdfSizeOverWarn(50 * 1024 * 1024 + 1)).toBe(true);
    expect(isPdfSizeOverWarn(PDF_SIZE_MAX_BYTES)).toBe(true);
  });

  it('blocks above 100MB', () => {
    expect(isPdfSizeOverMax(PDF_SIZE_MAX_BYTES)).toBe(false);
    expect(isPdfSizeOverMax(PDF_SIZE_MAX_BYTES + 1)).toBe(true);
    expect(isPdfSizeOverWarn(PDF_SIZE_MAX_BYTES + 1)).toBe(false);
  });
});
