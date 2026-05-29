import { describe, expect, it, vi } from 'vitest';
import { buildPdfDocumentInit, resolvePdfJsPublicUrl } from './pdfService.js';

describe('pdfService cMap init', () => {
  it('resolvePdfJsPublicUrl keeps trailing slash for cMap folder', () => {
    vi.stubEnv('BASE_URL', '/REDPEN/');
    expect(resolvePdfJsPublicUrl('pdfjs/cmaps/')).toBe('/REDPEN/pdfjs/cmaps/');
    vi.unstubAllEnvs();
  });

  it('buildPdfDocumentInit includes cMap options', () => {
    vi.stubEnv('BASE_URL', '/');
    const init = buildPdfDocumentInit(new Uint8Array([1, 2, 3]));
    expect(init.cMapPacked).toBe(true);
    expect(init.cMapUrl).toBe('/pdfjs/cmaps/');
    expect(init.data).toBeInstanceOf(Uint8Array);
    vi.unstubAllEnvs();
  });
});
