/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./exportResults.js', () => ({
  writeSpellingWorkbook: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  writeConsistencyWorkbook: vi.fn(async () => new Uint8Array([4, 5, 6]).buffer),
}));

import { downloadCheckResultsAsZip } from './downloadCheckResultsZip.js';
import {
  writeConsistencyWorkbook,
  writeSpellingWorkbook,
} from './exportResults.js';

describe('downloadCheckResultsAsZip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('빈 목록이면 empty', async () => {
    const result = await downloadCheckResultsAsZip({ items: [] });
    expect(result).toEqual({ ok: false, reason: 'empty' });
  });

  it('스냅숏을 xlsx로 넣어 zip 다운로드', async () => {
    const createObjectURL = vi.fn(() => 'blob:zip-test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const result = await downloadCheckResultsAsZip({
      items: [
        {
          id: 'a',
          kind: 'spelling',
          createdAt: Date.UTC(2026, 6, 16, 6, 0),
          pdfFileName: '고구려조선본없음.pdf',
          summaryLine: 's',
          summary: {},
          rows: [],
          filename: '맞춤법_검사결과.xlsx',
        },
        {
          id: 'b',
          kind: 'consistency',
          createdAt: Date.UTC(2026, 6, 16, 7, 0),
          pdfFileName: '고구려조선본없음.pdf',
          summaryLine: 'c',
          summary: {},
          rows: [],
          filename: '표기통일_검사결과.xlsx',
        },
      ],
      zipFilename: '260719_고구려조선본없음_검수결과',
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fileCount).toBe(2);
    expect(writeSpellingWorkbook).toHaveBeenCalledOnce();
    expect(writeConsistencyWorkbook).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:zip-test');
  });
});
