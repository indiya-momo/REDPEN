import { describe, expect, it } from 'vitest';
import {
  buildExportRowId,
  buildMachineExportFields,
  pageTextFingerprint,
  resolveExportInstanceRange,
} from './exportExcelRoundtrip.js';

describe('exportExcelRoundtrip', () => {
  it('pageTextFingerprint는 같은 본문에 같은 값을 준다', () => {
    expect(pageTextFingerprint('온몸으로 말한다.')).toBe(
      pageTextFingerprint('온몸으로 말한다.'),
    );
    expect(pageTextFingerprint('a')).not.toBe(pageTextFingerprint('b'));
  });

  it('resolveExportInstanceRange는 index를 우선한다', () => {
    expect(
      resolveExportInstanceRange({
        index: 10,
        start: 0,
        matchedText: '할때',
      }),
    ).toEqual({ start: 10, end: 12 });
  });

  it('행ID는 pageNum·start·end·출처로 만든다', () => {
    expect(
      buildExportRowId({
        pageNum: 3,
        start: 10,
        end: 12,
        sourceKey: '맞춤법|할때→할 때',
      }),
    ).toBe('3:10:12:맞춤법|할때→할 때');
  });

  it('buildMachineExportFields는 구간과 지문을 채운다', () => {
    const fields = buildMachineExportFields({
      inst: { pageNum: 2, index: 5, matchedText: '되요' },
      sourceKey: '맞춤법|되요',
      pdfName: 'a.pdf',
      pdfPages: 40,
      pageFpByNum: new Map([[2, 'abcd1234']]),
    });
    expect(fields).toMatchObject({
      rowId: '2:5:7:맞춤법|되요',
      pageNum: 2,
      start: 5,
      end: 7,
      pdfName: 'a.pdf',
      pdfPages: 40,
      pageFp: 'abcd1234',
    });
  });
});
