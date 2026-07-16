import { describe, expect, it } from 'vitest';
import {
  buildCheckResultSnapshot,
  estimateJsonBytes,
  exportModelFromSnapshot,
  remainingRetentionDays,
} from './checkResultSnapshot.js';

const tinyModel = {
  sheetName: '맞춤법 확인',
  filename: 'a.xlsx',
  summaryLine: '요약',
  summary: { totalFindings: 1 },
  rows: [
    {
      category: '맞춤법 규칙',
      groupLabel: '-',
      dividerGroupKey: '',
      label: '되요 → 돼요',
      tip: '',
      countText: '1',
      isCaution: false,
      pagesHidden: false,
      pageRuns: [{ text: '1P', strike: false }],
    },
  ],
};

describe('checkResultSnapshot', () => {
  it('projectId 없으면 null', () => {
    expect(
      buildCheckResultSnapshot({
        kind: 'spelling',
        projectId: '',
        exportModel: tinyModel,
      }),
    ).toBeNull();
  });

  it('기본 필드·만료·직렬화', () => {
    const now = 1_700_000_000_000;
    const snap = buildCheckResultSnapshot({
      kind: 'spelling',
      projectId: 'proj-1',
      pdfFileName: 'book.pdf',
      exportModel: tinyModel,
      now,
    });
    expect(snap?.projectId).toBe('proj-1');
    expect(snap?.kind).toBe('spelling');
    expect(snap?.createdAt).toBe(now);
    expect(snap?.expiresAt).toBe(now + 30 * 24 * 60 * 60 * 1000);
    expect(snap?.truncated).toBe(false);
    expect(snap?.rowCount).toBe(1);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it('soft limit 초과 시 뒤에서 자르고 truncated', () => {
    const fatRow = {
      category: '맞춤법 규칙',
      groupLabel: '-',
      dividerGroupKey: '',
      label: 'x'.repeat(2000),
      tip: 'y'.repeat(2000),
      countText: '1',
      isCaution: false,
      pagesHidden: false,
      pageRuns: [{ text: '1P', strike: false }],
    };
    const rows = Array.from({ length: 80 }, () => ({ ...fatRow }));
    const snap = buildCheckResultSnapshot({
      kind: 'spelling',
      projectId: 'p',
      exportModel: { ...tinyModel, rows },
      softByteLimit: 50_000,
    });
    expect(snap?.truncated).toBe(true);
    expect(snap && snap.rowCount < 80).toBe(true);
    expect(estimateJsonBytes(snap)).toBeLessThanOrEqual(50_000);
  });

  it('exportModelFromSnapshot / remainingRetentionDays', () => {
    const snap = buildCheckResultSnapshot({
      kind: 'consistency',
      projectId: 'p',
      exportModel: {
        ...tinyModel,
        sheetName: '표기 통일 확인',
        summary: { totalFindings: 0 },
        rows: [],
      },
    });
    const model = exportModelFromSnapshot(snap);
    expect(model?.kind).toBe('consistency');
    expect(model?.rows).toEqual([]);
    expect(remainingRetentionDays(Date.now() + 2.5 * 24 * 60 * 60 * 1000)).toBe(3);
    expect(remainingRetentionDays(Date.now() - 1000)).toBe(0);
  });
});
