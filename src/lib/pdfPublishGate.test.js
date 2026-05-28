import { describe, expect, it } from 'vitest';
import {
  assessExtractionQuality,
  runProbeMatches,
  scorePageExtractionQuality,
  validatePublishablePdf,
} from './pdfPublishGate.js';

describe('pdfPublishGate', () => {
  it('scorePageExtractionQuality flags fragmented extraction', () => {
    const fragmented = {
      pageNum: 1,
      text: '가 나 다',
      items: Array.from({ length: 120 }, (_, i) => ({
        str: String.fromCharCode(0xac00 + (i % 28)),
      })),
    };
    const score = scorePageExtractionQuality(fragmented);
    expect(score.ok).toBe(false);
  });

  it('validatePublishablePdf rejects scan PDF', () => {
    const result = validatePublishablePdf({
      producerHints: { looksInDesign: true },
      pages: [{ pageNum: 1, text: '   ', items: [] }],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('scan');
  });

  it('validatePublishablePdf passes without InDesign metadata when text is usable', () => {
    const pages = [
      {
        pageNum: 1,
        text: 'x'.repeat(900) + ' 우리 나라 맞춤법 ',
        items: [{ str: 'x'.repeat(900) + ' 우리 나라 맞춤법 ' }],
      },
    ];
    const result = validatePublishablePdf({
      producerHints: { looksInDesign: false },
      pages,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ok_no_indesign_meta');
  });

  it('assessExtractionQuality passes coherent page items', () => {
    const pages = [
      {
        pageNum: 1,
        text: '인디자인에서보낸 텍스트 PDF 본문입니다. 우리나라 맞춤법 검수.',
        items: [{ str: '인디자인에서보낸 텍스트 PDF 본문입니다. 우리나라 맞춤법 검수.' }],
      },
    ];
    expect(assessExtractionQuality(pages).ok).toBe(true);
  });

  it('runProbeMatches finds builtin spelling hits in corpus', () => {
    const pages = [
      {
        pageNum: 1,
        text: 'x'.repeat(900) + ' 우리 나라 맞춤법 ',
        items: [],
      },
    ];
    const probes = runProbeMatches(pages);
    expect(probes.skipped).toBe(false);
    expect(probes.ok).toBe(true);
    expect(probes.hits).toBeGreaterThanOrEqual(1);
  });
});
