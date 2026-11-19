import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, PDFArray, PDFHexString } from 'pdf-lib';
import {
  charOffsetsInItem,
  fallbackCharEm,
  proofMarkGeometry,
  quadPointsAcrobatOrder,
  segmentForItemSpan,
  segmentsForTextRange,
  placeLabelRect,
} from './annotGeometry.js';
import {
  classifyAnnotStyle,
  isEditorReviewFinding,
  isSpacingOnlyChange,
  spacingEditOps,
} from './annotClassify.js';
import { collectAnnotFindings } from './collectAnnotFindings.js';
import {
  PdfAnnotExportError,
  pdfTextString,
  writeAnnotatedPdf,
} from './writeAnnotatedPdf.js';
import {
  buildIndesignReplacePdfFilename,
  buildProofreadPdfFilename,
} from './exportProofreadPdf.js';
import {
  formatIndesignReplaceNotice,
  prepareIndesignReplaceFindings,
  resolveOverlappingFindings,
} from './indesignReplaceFindings.js';
import { buildProofreadExportConfirmMessage } from '../betaDailyQuota.js';

/** 10pt 가로 글자, 한글은 1em 폭 */
const item = (str, x, y, size = 10) => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width: Array.from(str).reduce((s, c) => s + fallbackCharEm(c), 0) * size,
});

describe('annotClassify', () => {
  it('띄어쓰기만 다른지', () => {
    expect(isSpacingOnlyChange('할때', '할 때')).toBe(true);
    expect(isSpacingOnlyChange('마음 속', '마음속')).toBe(true);
    expect(isSpacingOnlyChange('손\n끝', '손끝')).toBe(true);
    expect(isSpacingOnlyChange('나레이션', '내레이션')).toBe(false);
    expect(isSpacingOnlyChange('할때', '')).toBe(false);
    expect(isSpacingOnlyChange('할 때', '할  때')).toBe(false);
  });

  it('띄움·붙임 위치', () => {
    expect(spacingEditOps('할때', '할 때')).toEqual([{ type: 'insert', before: 0, after: 1 }]);
    expect(spacingEditOps('마음 속', '마음속')).toEqual([{ type: 'join', before: 1, after: 3 }]);
    expect(spacingEditOps('긴 긴 밤', '긴긴밤')).toEqual([
      { type: 'join', before: 0, after: 2 },
      { type: 'join', before: 2, after: 4 },
    ]);
    expect(spacingEditOps('교정표시', '교정 표시')).toEqual([{ type: 'insert', before: 1, after: 2 }]);
  });

  it('편집자 검토 항목', () => {
    expect(isEditorReviewFinding({ category: 'caution' }, { matchedText: '데요', suggestedText: '데요' })).toBe(true);
    expect(isEditorReviewFinding({ category: 'spelling' }, { matchedText: '할때', suggestedText: '할 때' })).toBe(false);
    expect(isEditorReviewFinding({ category: 'spelling' }, { matchedText: '바래', suggestedText: '' })).toBe(true);
    expect(isEditorReviewFinding({ category: 'spelling' }, { matchedText: '바래', suggestedText: '바라/바래' })).toBe(true);
    expect(isEditorReviewFinding({ category: 'spelling' }, { matchedText: '같은', suggestedText: '같은' })).toBe(true);
  });

  it('주석 모양 분류', () => {
    const g = { category: 'spelling' };
    expect(classifyAnnotStyle({ source: 'spelling', group: g, inst: { matchedText: '할때', suggestedText: '할 때' }, found: '할때', replacement: '할 때' })).toBe('spacing-mark');
    expect(classifyAnnotStyle({ source: 'spelling', group: g, inst: { matchedText: '빼곡이', suggestedText: '빼곡히' }, found: '빼곡이', replacement: '빼곡히' })).toBe('strike');
    expect(classifyAnnotStyle({ source: 'unify', group: {}, inst: {}, found: '교정 표시', replacement: '교정표시' })).toBe('spacing-mark');
    expect(classifyAnnotStyle({ source: 'unify', group: {}, inst: {}, found: '갯수', replacement: '개수' })).toBe('unify-box');
    expect(classifyAnnotStyle({ source: 'spelling', group: { category: 'caution' }, inst: { matchedText: '데요', suggestedText: '데요' }, found: '데요', replacement: '데요' })).toBe('review');
  });
});

describe('annotGeometry', () => {
  it('글자 폭 비율을 item.width에 맞춘다', () => {
    const off = charOffsetsInItem('가 a', 20, 10, fallbackCharEm);
    expect(off).toHaveLength(4);
    expect(off[3]).toBeCloseTo(20, 6);
    // 한글(1) : 공백(0.25) : a(0.52)
    expect(off[1] / off[3]).toBeCloseTo(1 / 1.77, 4);
  });

  it('가로 글자 사각형과 QuadPoints 순서(위-왼, 위-오, 아래-왼, 아래-오)', () => {
    const seg = segmentForItemSpan(item('할때면', 100, 500), 0, 2, fallbackCharEm);
    expect(seg.ll[0]).toBeCloseTo(100);
    expect(seg.lr[0]).toBeCloseTo(120);
    expect(seg.ll[1]).toBeCloseTo(500 - 1.4);
    expect(seg.ul[1]).toBeCloseTo(500 + 9.1);
    expect(quadPointsAcrobatOrder([seg])).toEqual([100, 509.1, 120, 509.1, 100, 498.6, 120, 498.6]);
  });

  it('90° 돌아간 글자는 텍스트 방향(u)을 따라간다', () => {
    const rotated = { str: '가나', transform: [0, 10, -10, 0, 300, 100], width: 20 };
    const seg = segmentForItemSpan(rotated, 1, 2, fallbackCharEm);
    // 진행 방향 +y, 높이 방향 −x
    expect(seg.ll[1]).toBeCloseTo(110);
    expect(seg.lr[1]).toBeCloseTo(120);
    expect(seg.ul[0]).toBeLessThan(seg.ll[0]);
  });

  it('줄이 나뉜 범위는 사각형 2개', () => {
    const page = {
      items: [item('그는 가녀린 손', 50, 700), item('끝에 고개를', 50, 680)],
      itemRefs: [
        { start: 0, end: 8, itemIndex: 0 },
        { start: 9, end: 15, itemIndex: 1 },
      ],
    };
    const segs = segmentsForTextRange(page, 7, 10, fallbackCharEm);
    expect(segs).toHaveLength(2);
    expect(segs[0].ll[1]).toBeGreaterThan(segs[1].ll[1]);
  });

  it('띄움표 꼭짓점은 두 글자 사이, 붙임표는 위 호 하나', () => {
    const A = segmentForItemSpan(item('할때', 100, 500), 0, 1, fallbackCharEm);
    const B = segmentForItemSpan(item('할때', 100, 500), 1, 2, fallbackCharEm);
    const ins = proofMarkGeometry('insert', A, B);
    expect(ins.sameLine).toBe(true);
    expect(ins.strokes).toHaveLength(1);
    expect(ins.strokes[0][1][0]).toBeCloseTo(110, 1);
    const join = proofMarkGeometry('join', A, B);
    expect(join.strokes).toHaveLength(1);
    expect((join.path.match(/ c S/g) ?? []).length).toBe(1);
    const minY = Math.min(...join.strokes[0].map((p) => p[1]));
    expect(minY).toBeGreaterThanOrEqual(A.ul[1] - 0.01);
  });

  it('라벨이 겹치면 위로 민다', () => {
    const seg = segmentForItemSpan(item('가나다', 100, 500), 0, 3, fallbackCharEm);
    const placed = [];
    const r1 = placeLabelRect(seg, 20, 7, 'left', placed);
    const r2 = placeLabelRect(seg, 20, 7, 'left', placed);
    expect(r2[1]).toBeGreaterThanOrEqual(r1[3]);
  });
});

describe('pdf 문자열·파일 쓰기', () => {
  it('한글 /T·/Contents는 UTF-16BE BOM', () => {
    const s = pdfTextString('인디야').toString();
    expect(s.startsWith('<FEFF')).toBe(true);
    expect(PDFHexString.of(s.slice(1, -1)).decodeText()).toBe('인디야');
  });

  it('하루 다운로드 확인 문구 — 형식 공통 1회', () => {
    const msg = buildProofreadExportConfirmMessage('spelling');
    expect(msg.startsWith('[검수 결과 다운로드]')).toBe(true);
    expect(msg).toContain('1회');
    expect(msg).toContain('다운로드를 진행할까요?');
    expect(msg).not.toContain('준비중');
  });

  it('파일 이름', () => {
    expect(buildProofreadPdfFilename('원고 3교.pdf')).toBe('원고 3교_교정본.pdf');
    expect(buildIndesignReplacePdfFilename('원고 3교.pdf')).toBe('원고 3교_인디자인용.pdf');
  });

  async function samplePdf() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    // 기존 주석 1개
    const old = doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [10, 10, 30, 30], Contents: pdfTextString('기존') }));
    page.node.addAnnot(old);
    return doc.save();
  }

  const pageTexts = [{
    pageNum: 1,
    text: '방문할때면 마음 속',
    items: [item('방문할때면 마음 속', 50, 500)],
    itemRefs: [{ start: 0, end: 10, itemIndex: 0 }],
  }];

  it('기존 주석을 두고 교정 기호(Ink)를 덧붙인다', async () => {
    const findings = collectAnnotFindings({
      spellingEntries: [{
        source: 'spelling',
        group: {
          category: 'spelling',
          label: '할때 → 할 때',
          instances: [
            { pageNum: 1, index: 2, matchedText: '할때', suggestedText: '할 때', itemIndexes: [0] },
            { pageNum: 1, index: 6, matchedText: '마음 속', suggestedText: '마음속', itemIndexes: [0] },
          ],
        },
      }],
      pageTexts,
    });
    expect(findings.map((f) => f.style)).toEqual(['spacing-mark', 'spacing-mark']);
    const { bytes, counts } = await writeAnnotatedPdf({
      pdfBytes: await samplePdf(),
      findings,
      pageTexts,
      charEm: fallbackCharEm,
    });
    expect(counts['spacing-mark']).toBe(2);
    const out = await PDFDocument.load(bytes);
    const annots = out.getPages()[0].node.lookup(PDFName.of('Annots'), PDFArray);
    expect(annots.size()).toBe(3);
    const ink = out.context.lookup(annots.get(1));
    expect(ink.get(PDFName.of('Subtype')).toString()).toBe('/Ink');
    expect(ink.lookup(PDFName.of('T')).decodeText()).toBe('인디야');
    expect(ink.lookup(PDFName.of('Contents')).decodeText()).toContain('할때 → 할 때');
    expect(ink.get(PDFName.of('AP'))).toBeTruthy();
  });

  it('숨긴 항목은 빠진다', () => {
    const group = { category: 'spelling', instances: [{ pageNum: 1, index: 2, matchedText: '할때', suggestedText: '할 때', itemIndexes: [0] }] };
    const findings = collectAnnotFindings({
      spellingEntries: [{ source: 'spelling', group }],
      pageTexts,
      isInstanceVisible: () => false,
    });
    expect(findings).toHaveLength(0);
  });

  it('표기통일 기준 검수(본+보)도 교정본에 넣는다', () => {
    const findings = collectAnnotFindings({
      consistencyEntries: [{
        source: 'consistency',
        group: {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-malda',
          auxNonAeoSpace: true,
          label: '말다',
          instances: [
            {
              pageNum: 1,
              index: 2,
              matchedText: '할때',
              suggestedText: '할 때',
              itemIndexes: [0],
            },
          ],
        },
      }],
      pageTexts,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].style).toBe('spacing-mark');
    expect(findings[0].subject).toBe('본용언+보조용언');
    expect(findings[0].contents).toContain('본용언+보조용언');
  });

  it('주석 제한 PDF는 풀지 않고 멈춘다', async () => {
    await expect(writeAnnotatedPdf({
      pdfBytes: await samplePdf(),
      findings: [],
      pageTexts,
      charEm: fallbackCharEm,
      pdfjsPermissions: [4, 16],
    })).rejects.toBeInstanceOf(PdfAnnotExportError);
  });
});

describe('indesignReplace', () => {
  const pageTexts = [{
    pageNum: 1,
    text: '방문할때면 마음 속',
    items: [item('방문할때면 마음 속', 50, 500)],
    itemRefs: [{ start: 0, end: 10, itemIndex: 0 }],
  }];

  async function samplePdf() {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    return doc.save();
  }

  it('자체 점검·고침없음·검토만 제외', () => {
    const findings = [
      { pageNum: 1, start: 2, end: 4, found: '할때', replacement: '할 때', style: 'spacing-mark' },
      { pageNum: 1, start: 0, end: 2, found: '방문', replacement: '', style: 'strike' },
      { pageNum: 1, start: 6, end: 10, found: '마음 속', replacement: '마음 속', style: 'review' },
      { pageNum: 1, start: 2, end: 4, found: '다른', replacement: '할 때', style: 'strike' },
    ];
    const { included, excluded } = prepareIndesignReplaceFindings(findings, pageTexts);
    expect(included).toHaveLength(1);
    expect(included[0].found).toBe('할때');
    expect(excluded.noReplacement).toBe(1);
    expect(excluded.reviewOnly).toBe(1);
    expect(excluded.textMismatch).toBe(1);
  });

  it('겹침은 더 긴 구간 우선', () => {
    const { kept, dropped } = resolveOverlappingFindings([
      { pageNum: 1, start: 0, end: 2, found: 'ab', replacement: 'x' },
      { pageNum: 1, start: 0, end: 4, found: 'abcd', replacement: 'y' },
      { pageNum: 1, start: 1, end: 3, found: 'bc', replacement: 'z' },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].found).toBe('abcd');
    expect(dropped).toBe(2);
  });

  it('Caret+StrikeOut 쌍 · Contents=고침만', async () => {
    const findings = [{
      pageNum: 1,
      start: 2,
      end: 4,
      found: '할때',
      replacement: '할 때',
      style: 'spacing-mark',
      label: '',
      contents: '할때 → 할 때',
      subject: '맞춤법',
    }];
    const { bytes, counts } = await writeAnnotatedPdf({
      pdfBytes: await samplePdf(),
      findings,
      pageTexts,
      charEm: fallbackCharEm,
      mode: 'indesignReplace',
    });
    expect(counts.replace).toBe(1);
    const out = await PDFDocument.load(bytes);
    const annots = out.getPages()[0].node.lookup(PDFName.of('Annots'), PDFArray);
    expect(annots.size()).toBe(2);
    const caret = out.context.lookup(annots.get(0));
    const strike = out.context.lookup(annots.get(1));
    expect(caret.get(PDFName.of('Subtype')).toString()).toBe('/Caret');
    expect(caret.get(PDFName.of('IT')).toString()).toBe('/Replace');
    expect(caret.lookup(PDFName.of('Contents')).decodeText()).toBe('할 때');
    expect(caret.lookup(PDFName.of('Contents')).decodeText()).not.toContain('→');
    expect(strike.get(PDFName.of('Subtype')).toString()).toBe('/StrikeOut');
    expect(strike.get(PDFName.of('IT')).toString()).toBe('/StrikeOutTextEdit');
    expect(strike.get(PDFName.of('RT')).toString()).toBe('/Group');
    expect(strike.get(PDFName.of('IRT'))).toEqual(annots.get(0));
    expect(strike.get(PDFName.of('QuadPoints'))).toBeTruthy();
    expect(strike.lookup(PDFName.of('Contents')).decodeText()).toBe('');
  });

  it('줄바꿈 구간은 QuadPoints 복수', async () => {
    const pageTexts = [{
      pageNum: 1,
      text: '그는 가녀린 손\n끝에',
      items: [item('그는 가녀린 손', 50, 700), item('끝에', 50, 680)],
      itemRefs: [
        { start: 0, end: 8, itemIndex: 0 },
        { start: 9, end: 11, itemIndex: 1 },
      ],
    }];
    const findings = [{
      pageNum: 1,
      start: 7,
      end: 11,
      found: '손\n끝에',
      replacement: '손끝에',
      style: 'spacing-mark',
      label: '',
      contents: '',
      subject: '맞춤법',
    }];
    const { included } = prepareIndesignReplaceFindings(findings, pageTexts);
    expect(included).toHaveLength(1);
    const { bytes, counts } = await writeAnnotatedPdf({
      pdfBytes: await samplePdf(),
      findings: included,
      pageTexts,
      charEm: fallbackCharEm,
      mode: 'indesignReplace',
    });
    expect(counts.replace).toBe(1);
    const out = await PDFDocument.load(bytes);
    const annots = out.getPages()[0].node.lookup(PDFName.of('Annots'), PDFArray);
    const strike = out.context.lookup(annots.get(1));
    const qp = strike.lookup(PDFName.of('QuadPoints'), PDFArray);
    // 세그먼트 2개 × 8 숫자
    expect(qp.size()).toBe(16);
  });

  it('안내 문구에 Accept 약속 없음', () => {
    const notice = formatIndesignReplaceNotice({
      included: 2,
      excluded: { noReplacement: 1, textMismatch: 0, overlap: 1, reviewOnly: 0 },
    });
    expect(notice).toContain('포함 2건');
    expect(notice).toContain('제외 2건');
    expect(notice).toContain('겹침 1');
    expect(notice).toContain('좌표(QuadPoints)·Tw 정확도는 보증하지 않습니다');
    expect(notice).toContain('인디자인 문서를 수정하지 마세요');
    expect(notice).toContain('Accept가 어긋날 수 있습니다');
    expect(notice).toContain('Accept 성공을 약속하지 않습니다');
  });
});

