import { describe, expect, it } from 'vitest';
import {
  assessExtractionQuality,
  assessHangulExtraction,
  countHangul,
  looksResavedPdf,
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
        // probeRules는 대표 find만 본다(이형태 finds는 미적용)
        text: 'x'.repeat(900) + ' 봄 밤 맞춤법 ',
        items: [],
      },
    ];
    const probes = runProbeMatches(pages);
    expect(probes.skipped).toBe(false);
    expect(probes.ok).toBe(true);
    expect(probes.hits).toBeGreaterThanOrEqual(1);
  });

  it('countHangul counts syllables only', () => {
    expect(countHangul('abc 우리나라 123')).toBe(4);
    expect(countHangul('IN THIS ECONOMY')).toBe(0);
  });

  it('assessHangulExtraction passes Latin-primary PDF without hangul', () => {
    const pages = [
      {
        pageNum: 1,
        text: 'IN THIS ECONOMY? '.repeat(40) + 'Copyright by Kyla Scanlon.',
        items: [],
      },
    ];
    const result = assessHangulExtraction(pages);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('latin_primary');
  });

  it('assessHangulExtraction flags broken Korean extraction without blocking', () => {
    const pages = [
      {
        pageNum: 1,
        text: `${'کંѥં\u0001ࠓড়ɼԃ '.repeat(20)}GDP 2022 vibecession mild Fed`,
        items: [],
      },
      {
        pageNum: 2,
        text: 'IN THIS ECONOMY? '.repeat(30),
        items: [],
      },
    ];
    const result = assessHangulExtraction(pages);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('hangul_missing');
  });

  it('looksResavedPdf detects iOS Quartz PDFContext', () => {
    expect(
      looksResavedPdf({
        looksInDesign: false,
        producer: 'iOS Version 26.3.1 (Build 23D8133) Quartz PDFContext',
        creator: '',
      }),
    ).toBe(true);
  });

  it('validatePublishablePdf allows resaved PDF without blocking', () => {
    const pages = [
      {
        pageNum: 1,
        text: `${'کંѥં '.repeat(120)}2022 2023 chart label Fed GDP mortgage`,
        items: [],
      },
    ];
    const result = validatePublishablePdf({
      producerHints: {
        looksInDesign: false,
        producer: 'iOS Version 26.3.1 Quartz PDFContext',
        creator: '',
      },
      pages,
    });
    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty('advisory');
  });
});
