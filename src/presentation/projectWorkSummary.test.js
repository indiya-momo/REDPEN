import { describe, expect, it } from 'vitest';
import {
  buildProjectWorkSummary,
  formatPdfSizeLabel,
  WORK_SUMMARY_NONE_LABEL,
} from './projectWorkSummary.js';

const NOW = Date.parse('2026-07-08T12:00:00.000Z');

describe('buildProjectWorkSummary', () => {
  it('기록이 전혀 없으면 null을 돌려준다', () => {
    expect(buildProjectWorkSummary(undefined, NOW)).toBeNull();
    expect(buildProjectWorkSummary({}, NOW)).toBeNull();
    expect(buildProjectWorkSummary({ proofRevision: '3교' }, NOW)).toBeNull();
  });

  it('전체 스냅샷을 표시 문구로 바꾼다', () => {
    const summary = buildProjectWorkSummary(
      {
        lastWorkedAt: '2026-07-05T09:00:00.000Z',
        pdfFileName: '원고.pdf',
        pdfPageCount: 240,
        pdfSizeBytes: 12.3 * 1024 * 1024,
        lastSpellingFindingCount: 12,
        lastConsistencyFindingCount: 5,
      },
      NOW,
    );
    expect(summary).not.toBeNull();
    expect(summary?.lastWorked).toBe('26.07.05 (3일 전)');
    expect(summary?.pdf).toBe('원고.pdf · 240쪽 · 12.3MB');
    expect(summary?.findings).toBe('맞춤법 12건 · 표기 통일 5건');
  });

  it('오늘·어제는 상대 표기로 쓴다', () => {
    const today = buildProjectWorkSummary(
      { lastWorkedAt: '2026-07-08T01:00:00.000Z' },
      NOW,
    );
    expect(today?.lastWorked).toContain('(오늘)');
    const yesterday = buildProjectWorkSummary(
      { lastWorkedAt: '2026-07-07T01:00:00.000Z' },
      NOW,
    );
    expect(yesterday?.lastWorked).toContain('(어제)');
  });

  it('빠진 항목은 기록 없음으로 표시한다', () => {
    const summary = buildProjectWorkSummary(
      { lastWorkedAt: '2026-07-05T09:00:00.000Z' },
      NOW,
    );
    expect(summary?.pdf).toBe(WORK_SUMMARY_NONE_LABEL);
    expect(summary?.findings).toBe(WORK_SUMMARY_NONE_LABEL);
  });
});

describe('formatPdfSizeLabel', () => {
  it('MB·KB 단위로 표시한다', () => {
    expect(formatPdfSizeLabel(12.3 * 1024 * 1024)).toBe('12.3MB');
    expect(formatPdfSizeLabel(512 * 1024)).toBe('512KB');
    expect(formatPdfSizeLabel(undefined)).toBeUndefined();
  });
});
