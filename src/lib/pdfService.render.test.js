import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPdfOutputScale,
  PDF_OUTPUT_SCALE_MAX,
} from './pdfService.js';

describe('getPdfOutputScale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clamps devicePixelRatio to a safe maximum', () => {
    vi.stubGlobal('window', { devicePixelRatio: 4 });
    expect(getPdfOutputScale()).toBe(PDF_OUTPUT_SCALE_MAX);
  });

  it('uses at least 1 for low DPR', () => {
    vi.stubGlobal('window', { devicePixelRatio: 0.75 });
    expect(getPdfOutputScale()).toBe(1);
  });

  it('returns 1 when window is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(getPdfOutputScale()).toBe(1);
  });
});
