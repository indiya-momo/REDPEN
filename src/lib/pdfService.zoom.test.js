import { describe, expect, it } from 'vitest';
import {
  clampPdfZoomFactor,
  computePdfRenderScale,
  PDF_ZOOM_FACTOR_MAX,
  PDF_ZOOM_FACTOR_MIN,
  PDF_ZOOM_PERCENT_MAX,
  PDF_ZOOM_PERCENT_MIN,
  stepPdfZoomFactor,
  zoomFactorFromPercent,
  zoomPercentFromFactor,
} from './pdfService.js';

describe('pdf zoom helpers', () => {
  it('clamps zoom factor', () => {
    expect(clampPdfZoomFactor(0.1)).toBe(PDF_ZOOM_FACTOR_MIN);
    expect(clampPdfZoomFactor(9)).toBe(PDF_ZOOM_FACTOR_MAX);
    expect(clampPdfZoomFactor(1.25)).toBe(1.25);
  });

  it('computes render scale from fit and zoom', () => {
    expect(computePdfRenderScale(0.5, 2)).toBeCloseTo(1);
    expect(computePdfRenderScale(2, 3)).toBe(5);
  });

  it('parses zoom percent input', () => {
    expect(zoomFactorFromPercent(160)).toBe(1.6);
    expect(zoomFactorFromPercent('180')).toBe(1.8);
    expect(zoomFactorFromPercent(250)).toBe(PDF_ZOOM_FACTOR_MAX);
    expect(zoomFactorFromPercent(49)).toBeNull();
    expect(zoomFactorFromPercent(251)).toBeNull();
    expect(zoomFactorFromPercent('160%')).toBeNull();
    expect(zoomPercentFromFactor(1.6)).toBe(160);
  });

  it('exposes percent bounds aligned with factor limits', () => {
    expect(PDF_ZOOM_PERCENT_MIN).toBe(50);
    expect(PDF_ZOOM_PERCENT_MAX).toBe(250);
    expect(zoomPercentFromFactor(PDF_ZOOM_FACTOR_MIN)).toBe(
      PDF_ZOOM_PERCENT_MIN,
    );
    expect(zoomPercentFromFactor(PDF_ZOOM_FACTOR_MAX)).toBe(
      PDF_ZOOM_PERCENT_MAX,
    );
  });

  it('steps zoom in quarter increments', () => {
    expect(stepPdfZoomFactor(1, 1)).toBe(1.25);
    expect(stepPdfZoomFactor(1, -1)).toBe(0.75);
    expect(stepPdfZoomFactor(PDF_ZOOM_FACTOR_MIN, -1)).toBe(
      PDF_ZOOM_FACTOR_MIN,
    );
  });
});
