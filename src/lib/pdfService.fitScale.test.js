import { describe, expect, it } from 'vitest';
import { scaleToFitContainer } from './pdfService.js';

describe('scaleToFitContainer', () => {
  it('fits page inside container', () => {
    const scale = scaleToFitContainer(
      { width: 400, height: 600 },
      { width: 200, height: 300 },
      0,
    );
    expect(scale).toBeCloseTo(0.5);
  });

  it('uses the tighter axis', () => {
    const scale = scaleToFitContainer(
      { width: 1000, height: 500 },
      { width: 500, height: 500 },
      0,
    );
    expect(scale).toBeCloseTo(0.5);
  });
});
