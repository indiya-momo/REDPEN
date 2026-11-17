import { describe, expect, it } from 'vitest';
import {
  joinPagesAsTxt,
  txtFilenameFromPdfName,
} from './pdfTxtExport.js';

describe('pdfTxtExport', () => {
  it('pdf 확장자를 txt로 바꾼다', () => {
    expect(txtFilenameFromPdfName('원고.PDF')).toBe('원고.txt');
    expect(txtFilenameFromPdfName('note')).toBe('note.txt');
  });

  it('쪽 텍스트를 빈 줄로 잇는다', () => {
    expect(
      joinPagesAsTxt([
        { text: '첫 쪽\n' },
        { visualText: '둘째 쪽' },
        { text: '   ' },
      ]),
    ).toBe('첫 쪽\n\n둘째 쪽');
  });
});
