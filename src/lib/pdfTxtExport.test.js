import { describe, expect, it } from 'vitest';
import {
  encodeTxtForDownload,
  finalTxtFilenameFromPdfName,
  joinPagesAsTxt,
  preparePdfTxtReview,
  txtFilenameFromPdfName,
} from './pdfTxtExport.js';
import {
  PDF_SIZE_MAX_BYTES,
  PDF_SIZE_MAX_BYTES_TERMINAL,
  PDF_SIZE_MAX_MESSAGE_TERMINAL,
} from './pdfSizeLimits.js';
import {
  cleanPagesForTxt,
  isLikelyPageNumberLine,
  normalizeTxtLineKey,
  stripGluedPageNumber,
} from './pdfTxtBodyClean.js';
import {
  applyLinebreakDecisions,
  classifyLinebreakPair,
  findLinebreakCandidates,
} from './pdfTxtLinebreakReview.js';

describe('pdfTxtExport', () => {
  it('파일명에 _검수전을 붙인다', () => {
    expect(txtFilenameFromPdfName('원고.PDF')).toBe('원고_검수전.txt');
    expect(txtFilenameFromPdfName('note')).toBe('note_검수전.txt');
    expect(txtFilenameFromPdfName('이미_검수전.pdf')).toBe('이미_검수전.txt');
  });

  it('최종 파일명에는 _검수전이 없다', () => {
    expect(finalTxtFilenameFromPdfName('원고.PDF')).toBe('원고.txt');
    expect(finalTxtFilenameFromPdfName('이미_검수전.pdf')).toBe('이미.txt');
  });

  it('UTF-8 BOM과 CRLF로 인코딩한다', () => {
    const encoded = encodeTxtForDownload('가\n나');
    expect(encoded.startsWith('\uFEFF')).toBe(true);
    expect(encoded.slice(1)).toBe('가\r\n나');
  });

  it('쪽 사이에 쪽 표식을 넣고 잇는다', () => {
    expect(
      joinPagesAsTxt([
        { pageNum: 1, text: '첫 쪽\n' },
        { pageNum: 2, visualText: '둘째 쪽' },
        { pageNum: 3, text: '   ' },
      ]),
    ).toBe('첫 쪽\n\n--- p.2 ---\n둘째 쪽');
  });

  it('TXT 변환은 100~150MB는 용량 메시지로 막지 않는다', async () => {
    const mid = {
      name: 'mid.pdf',
      type: 'application/pdf',
      size: PDF_SIZE_MAX_BYTES + 1,
    };
    try {
      await preparePdfTxtReview(/** @type {File} */ (mid));
      throw new Error('expected throw after size gate');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toBe(PDF_SIZE_MAX_MESSAGE_TERMINAL);
      expect(message).not.toMatch(/100MB/);
    }
  });

  it('TXT 변환은 150MB 초과만 막는다', async () => {
    const over = {
      name: 'huge.pdf',
      type: 'application/pdf',
      size: PDF_SIZE_MAX_BYTES_TERMINAL + 1,
    };
    await expect(
      preparePdfTxtReview(/** @type {File} */ (over)),
    ).rejects.toThrow(PDF_SIZE_MAX_MESSAGE_TERMINAL);
  });
});

describe('pdfTxtBodyClean', () => {
  it('쪽수 줄 패턴을 인식한다', () => {
    expect(isLikelyPageNumberLine('12')).toBe(true);
    expect(isLikelyPageNumberLine('쪽 3')).toBe(true);
    expect(isLikelyPageNumberLine('— 4 —')).toBe(true);
    expect(isLikelyPageNumberLine('본문입니다')).toBe(false);
  });

  it('반복 머리말·상단 쪽수를 제거한다', () => {
    const mk = (pageNum, headerY, bodyY, footerY) => ({
      pageNum,
      items: [
        {
          str: '책 제목',
          transform: [12, 0, 0, 12, 72, headerY],
          width: 40,
          hasEOL: true,
        },
        {
          str: `본문 ${pageNum}`,
          transform: [12, 0, 0, 12, 72, bodyY],
          width: 40,
          hasEOL: true,
        },
        {
          str: String(pageNum),
          transform: [10, 0, 0, 10, 300, footerY],
          width: 10,
          hasEOL: true,
        },
      ],
    });
    const cleaned = cleanPagesForTxt([
      mk(1, 800, 400, 40),
      mk(2, 800, 400, 40),
      mk(3, 800, 400, 40),
    ]);
    expect(cleaned.map((p) => p.text)).toEqual([
      '본문 1',
      '본문 2',
      '본문 3',
    ]);
  });

  it('본문만 있는 쪽은 그대로 둔다', () => {
    const cleaned = cleanPagesForTxt([
      {
        pageNum: 1,
        items: [
          {
            str: '서문',
            transform: [14, 0, 0, 14, 72, 700],
            width: 28,
            hasEOL: true,
          },
          {
            str: '첫 문장입니다.',
            transform: [12, 0, 0, 12, 72, 660],
            width: 80,
            hasEOL: true,
          },
        ],
      },
    ]);
    expect(cleaned[0].text).toBe('서문\n첫 문장입니다.');
    expect(normalizeTxtLineKey('  a  b ')).toBe('a b');
  });

  it('같은 줄에 붙은 쪽수를 걷어 낸다', () => {
    expect(stripGluedPageNumber('68입력 필요')).toBe('입력 필요');
    expect(stripGluedPageNumber('66경상북도 경주시 출토')).toBe(
      '경상북도 경주시 출토',
    );
    expect(stripGluedPageNumber('2-08')).toBe('2-08');
    expect(stripGluedPageNumber('3학년')).toBe('3학년');
  });
});

describe('pdfTxtLinebreakReview', () => {
  it('단어 중간은 붙이고 문장 끝은 줄을 유지한다', () => {
    expect(classifyLinebreakPair('유명한 명', '지 계곡')).toBe('join');
    expect(classifyLinebreakPair('봤을 때', '손잡이 윗부분')).toBe('join');
    expect(classifyLinebreakPair('끝났다.', '다음')).toBe('keep');
  });

  it('최종 본문은 문단 안 줄바꿈을 잇고, 쪽은 빈 줄로 나눈다', () => {
    const pages = [
      { pageNum: 1, lines: ['유명한 명', '지 계곡이다.', '다음 글은'] },
      { pageNum: 2, lines: ['이어서 둘째 쪽이다.'] },
    ];
    const candidates = findLinebreakCandidates(pages);
    expect(
      candidates.some((c) => c.id === '1:0' && c.defaultDecision === 'nospace'),
    ).toBe(true);
    expect(candidates.some((c) => c.id === '1:1')).toBe(false);
    expect(applyLinebreakDecisions(pages, {})).toBe(
      '유명한 명지 계곡이다.\n다음 글은 이어서 둘째 쪽이다.',
    );
    expect(applyLinebreakDecisions(pages, { '1:0': 'keep', '1:page': 'keep' })).toBe(
      '유명한 명\n지 계곡이다.\n다음 글은\n이어서 둘째 쪽이다.',
    );
    expect(applyLinebreakDecisions(pages, {}, { autoParagraph: false })).toBe(
      '유명한 명\n지 계곡이다.\n다음 글은\n\n이어서 둘째 쪽이다.',
    );
  });
});
