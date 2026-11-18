/**
 * 「PDF 교정본 다운로드」 — 브라우저 진입점.
 * 지금 화면에 보이는 검수 결과(숨긴 항목 제외)를 원본 PDF에 주석으로 달아 새 파일로 받는다.
 */
import { collectAnnotFindings } from './collectAnnotFindings.js';
import { createCharEmMeasurer } from './annotGeometry.js';
import { writeAnnotatedPdf } from './writeAnnotatedPdf.js';
import { ensureGlyphOffsetsForPage } from '../pdfService.js';

/** 라벨 글꼴 — 앱이 이미 싣는 학교안심 바른바탕 R (fontkit 부분집합이 깨지지 않음) */
export const LABEL_FONT_PATH = 'fonts/HakgyoansimBareonbatangR.ttf';

/** @param {string} pdfFileName */
export function buildProofreadPdfFilename(pdfFileName) {
  const base = String(pdfFileName || 'document').replace(/\.pdf$/i, '');
  return `${base}_교정본.pdf`.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * @param {{
 *   pdfDoc: import('pdfjs-dist').PDFDocumentProxy,
 *   pageTexts: import('../pdfService.js').PageData[],
 *   spellingEntries?: Array<{ group: object, source: string }>,
 *   consistencyEntries?: Array<{ group: object, source: string }>,
 *   unifyGroups?: object[],
 *   isInstanceVisible?: (source: string, group: object, inst: object) => boolean,
 *   pdfFileName?: string,
 * }} input
 * @returns {Promise<{ filename: string, counts: Record<string, number>, total: number }>}
 */
export async function exportProofreadPdf({
  pdfDoc,
  pageTexts,
  spellingEntries = [],
  consistencyEntries = [],
  unifyGroups = [],
  isInstanceVisible,
  pdfFileName = '',
}) {
  const findings = collectAnnotFindings({
    spellingEntries,
    consistencyEntries,
    unifyGroups,
    pageTexts,
    isInstanceVisible,
  });
  if (!findings.length) {
    return { filename: '', counts: {}, total: 0 };
  }
  // 화면과 같은 글자 위치 — 내보내기마다 force로 다시 잰다(실패 null 캐시·페이지 프록시 불일치 방지)
  const findingPages = [...new Set(findings.map((f) => f.pageNum))];
  for (const n of findingPages) {
    const pd = pageTexts.find((p) => p?.pageNum === n);
    if (!pd?.items?.length) continue;
    try {
      await ensureGlyphOffsetsForPage(await pdfDoc.getPage(n), pd.items, {
        force: true,
      });
    } catch {
      /* 폴백 */
    }
  }
  // 로드 때 넘긴 버퍼는 worker로 넘어가 비었을 수 있음 → pdf.js가 가진 원본 바이트 사본
  const [pdfBytes, permissions, { default: fontkit }] = await Promise.all([
    pdfDoc.getData(),
    pdfDoc.getPermissions().catch(() => null),
    import('@pdf-lib/fontkit'),
  ]);
  const base = import.meta.env?.BASE_URL || '/';
  const { bytes, counts } = await writeAnnotatedPdf({
    pdfBytes,
    findings,
    pageTexts,
    charEm: createCharEmMeasurer(),
    pdfjsPermissions: permissions,
    loadLabelFont: async (doc) => {
      doc.registerFontkit(fontkit);
      const res = await fetch(`${base}${LABEL_FONT_PATH}`);
      if (!res.ok) throw new Error(`label font ${res.status}`);
      return doc.embedFont(new Uint8Array(await res.arrayBuffer()), { subset: true });
    },
  });
  const filename = buildProofreadPdfFilename(pdfFileName);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  const total = Object.entries(counts)
    .filter(([k]) => k !== 'skipped')
    .reduce((s, [, v]) => s + v, 0);
  return { filename, counts, total };
}
