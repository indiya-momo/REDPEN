import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { extractAllPagesText, loadPdfFromBuffer } from './pdfService.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).href;
import { cleanPageLinesForTxt } from './pdfTxtBodyClean.js';
import {
  applyLinebreakDecisions,
  joinPagesWithMarkers,
} from './pdfTxtLinebreakReview.js';

describe('pdf text items → 문단 TXT', () => {
  it('추출한 줄에서 문단을 잇고 검수전은 조판 줄바꿈을 남긴다', async () => {
    const fontBytes = await readFile(
      new URL('../../public/fonts/HakgyoansimBareonbatangR.ttf', import.meta.url),
    );
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes, { subset: true });
    const page = pdfDoc.addPage([420, 600]);
    const size = 12;
    const rows = [
      [72, 520, '책 제목'],
      [72, 470, '그는 어제 시장에 가서'],
      [72, 452, '사과를 샀다.'],
      [72, 420, '마을 사람들이 찾던 유명한 명'],
      [72, 402, '지 계곡에 갔다.'],
      [96, 360, '그리고 집에 돌아왔다.'],
      [300, 40, '12'],
    ];
    for (const [x, y, text] of rows) {
      page.drawText(text, { x, y, size, font });
    }
    const bytes = await pdfDoc.save();
    const pdf = await loadPdfFromBuffer(bytes.buffer);
    try {
      const pages = await extractAllPagesText(pdf);
      const cleaned = cleanPageLinesForTxt(pages);
      const draft = joinPagesWithMarkers(cleaned);
      const finalText = applyLinebreakDecisions(cleaned, {});

      expect(draft).toContain('그는 어제 시장에 가서\n사과를 샀다.');
      expect(draft).toContain('유명한 명\n지 계곡에 갔다.');
      expect(draft).not.toContain('명지');
      expect(finalText).toContain('그는 어제 시장에 가서 사과를 샀다.');
      expect(finalText).toContain('유명한 명지 계곡에 갔다.');
      expect(finalText).toContain('갔다.\n그리고 집에 돌아왔다.');
      expect(finalText).not.toContain('\n12');
      expect(finalText).not.toMatch(/^12/u);
    } finally {
      await pdf.destroy?.();
    }
  }, 20000);
});
