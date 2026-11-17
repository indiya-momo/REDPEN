/**
 * PDF 교정본 — pdf-lib로 기존 PDF에 주석만 덧붙여 새 파일 바이트를 만든다.
 * 기존 주석은 그대로 두고, 제한(암호·권한)은 절대 풀지 않는다.
 */
import { PDFDocument, PDFHexString, PDFString } from 'pdf-lib';
import {
  proofMarkGeometry,
  quadPointsAcrobatOrder,
  rectEnclosing,
  round2,
  segHeight,
  segmentsForTextRange,
  placeLabelRect,
  sub,
} from './annotGeometry.js';
import { spacingEditOps } from './annotClassify.js';

export const ANNOT_AUTHOR = '인디야';
/** pdf.js PermissionFlag.MODIFY_ANNOTATIONS */
export const PDFJS_PERM_MODIFY_ANNOTATIONS = 0x20;

/** 앱 색 (src/index.css) */
export const ANNOT_COLORS = Object.freeze({
  /** .builtin-rule-tip-inline */
  red: [0xb9 / 255, 0x1c / 255, 0x1c / 255],
  /** --pillar-consistency */
  unifyGray: [0x5c / 255, 0x6b / 255, 0x7a / 255],
  /** --result-pill-marker (#e2d7c2 20% + #ffea4d 80%) */
  reviewYellow: [0xf9 / 255, 0xe6 / 255, 0x64 / 255],
  reviewBorder: [0xb3 / 255, 0x8f / 255, 0],
});

export class PdfAnnotExportError extends Error {
  /**
   * @param {'annotations-restricted' | 'encrypted-unsupported' | 'page-mismatch'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'PdfAnnotExportError';
    this.code = code;
  }
}

/**
 * /Contents·/T용 UTF-16BE(BOM) 문자열.
 * @param {string} text
 */
export function pdfTextString(text) {
  return PDFHexString.fromText(String(text ?? ''));
}

/** @param {Date} d */
export function pdfDateString(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** @param {number[]} c */
const rgbStr = (c) => c.map(round2).join(' ');

/**
 * pdf.js 권한 + pdf-lib 암호 여부로 주석을 달 수 있는지.
 * @param {PDFDocument} doc
 * @param {number[] | null | undefined} pdfjsPermissions pdf.js getPermissions() (null = 제한 없음)
 */
export function assertAnnotatable(doc, pdfjsPermissions) {
  if (
    Array.isArray(pdfjsPermissions) &&
    !pdfjsPermissions.includes(PDFJS_PERM_MODIFY_ANNOTATIONS)
  ) {
    throw new PdfAnnotExportError(
      'annotations-restricted',
      '이 PDF는 주석 추가가 제한되어 있어 교정본을 만들 수 없습니다. 제한을 푼 원본으로 다시 열어 주세요.',
    );
  }
  if (doc.isEncrypted) {
    throw new PdfAnnotExportError(
      'encrypted-unsupported',
      '암호화된 PDF는 아직 교정본 내려받기를 지원하지 않습니다.',
    );
  }
}

/**
 * @param {{
 *   pdfBytes: Uint8Array | ArrayBuffer,
 *   findings: import('./collectAnnotFindings.js').AnnotFinding[],
 *   pageTexts: import('../pdfService.js').PageData[],
 *   charEm: (ch: string) => number,
 *   pdfjsPermissions?: number[] | null,
 *   loadLabelFont?: (doc: PDFDocument) => Promise<import('pdf-lib').PDFFont>,
 *   now?: Date,
 * }} input
 * @returns {Promise<{ bytes: Uint8Array, counts: Record<string, number> }>}
 */
export async function writeAnnotatedPdf({
  pdfBytes,
  findings,
  pageTexts,
  charEm,
  pdfjsPermissions = null,
  loadLabelFont,
  now = new Date(),
}) {
  const doc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  assertAnnotatable(doc, pdfjsPermissions);
  const ctx = doc.context;
  const pages = doc.getPages();
  const pageByNum = new Map((pageTexts ?? []).map((p) => [p.pageNum, p]));
  const needsFont = findings.some((f) => f.label && f.style !== 'spacing-mark');
  const font = needsFont && loadLabelFont ? await loadLabelFont(doc) : null;
  const date = PDFString.of(pdfDateString(now));
  /** @type {Map<number, Array<[number, number, number, number]>>} */
  const labelRectsByPage = new Map();
  /** @type {Record<string, number>} */
  const counts = { 'spacing-mark': 0, strike: 0, 'unify-box': 0, review: 0, skipped: 0 };
  let serial = 0;

  /** @param {object} dict */
  const addAnnot = (page, dict) => {
    const ref = ctx.register(ctx.obj(dict));
    page.node.addAnnot(ref);
    return ref;
  };
  /**
   * @param {string} body
   * @param {number[]} bbox
   * @param {object} [resources]
   */
  const formXObject = (body, bbox, resources) =>
    ctx.register(
      ctx.flateStream(body, {
        Type: 'XObject',
        Subtype: 'Form',
        FormType: 1,
        BBox: bbox,
        ...(resources ? { Resources: resources } : {}),
      }),
    );
  const common = (page, subject, contents) => ({
    Type: 'Annot',
    F: 4,
    P: page.ref,
    T: pdfTextString(ANNOT_AUTHOR),
    Subj: pdfTextString(subject),
    Contents: pdfTextString(contents),
    M: date,
    CreationDate: date,
    NM: PDFString.of(`indiya-${now.getTime().toString(36)}-${(serial += 1)}`),
  });

  /**
   * 빨간 글씨 라벨 (FreeText, 글꼴 부분집합을 AP에 넣음).
   * @param {'center' | 'left'} align
   */
  const addLabel = (page, pageNum, seg, text, align, parentRef, subject, sizeRatio) => {
    if (!font || !text) return;
    const h = segHeight(seg);
    const size = round2(Math.max(5, h * sizeRatio));
    const w = font.widthOfTextAtSize(text, size);
    const hgt = font.heightAtSize(size);
    const asc = font.heightAtSize(size, { descender: false });
    const placed = labelRectsByPage.get(pageNum) ?? [];
    labelRectsByPage.set(pageNum, placed);
    const L = placeLabelRect(seg, w, hgt, align, placed);
    const body = `/Tx BMC q BT /FKR ${size} Tf ${rgbStr(ANNOT_COLORS.red)} rg ${round2(L[0] + 1)} ${round2(L[1] + (hgt - asc))} Td ${font.encodeText(text).toString()} Tj ET Q EMC`;
    const ap = formXObject(body, L, { Font: { FKR: font.ref } });
    addAnnot(page, {
      ...common(page, subject, text),
      Subtype: 'FreeText',
      Rect: L,
      DA: PDFString.of(`/Helv ${size} Tf ${rgbStr(ANNOT_COLORS.red)} rg`),
      Q: align === 'center' ? 1 : 0,
      BS: { W: 0 },
      IT: 'FreeText',
      ...(parentRef ? { IRT: parentRef, RT: 'Group' } : {}),
      AP: { N: ap },
    });
  };

  /** 반투명 채움 + 얇은 테두리 상자 (Square) */
  const addBox = (page, seg, fill, fillAlpha, stroke, strokeAlpha, subject, contents, blendMultiply) => {
    const R = rectEnclosing([seg]);
    const W = round2(R[2] - R[0]);
    const H = round2(R[3] - R[1]);
    const body = `q /GS0 gs ${rgbStr(fill)} rg ${R[0]} ${R[1]} ${W} ${H} re f Q q /GS1 gs ${rgbStr(stroke)} RG 0.75 w ${round2(R[0] + 0.375)} ${round2(R[1] + 0.375)} ${round2(W - 0.75)} ${round2(H - 0.75)} re S Q`;
    const ap = formXObject(body, R, {
      ExtGState: {
        GS0: { Type: 'ExtGState', ca: fillAlpha, ...(blendMultiply ? { BM: 'Multiply' } : {}) },
        GS1: { Type: 'ExtGState', CA: strokeAlpha },
      },
    });
    return addAnnot(page, {
      ...common(page, subject, contents),
      Subtype: 'Square',
      Rect: R,
      C: stroke.map(round2),
      IC: fill.map(round2),
      CA: 1,
      BS: { W: 0.75 },
      AP: { N: ap },
    });
  };

  for (const f of findings) {
    const page = pages[f.pageNum - 1];
    const pd = pageByNum.get(f.pageNum);
    if (!page || !pd) {
      counts.skipped += 1;
      continue;
    }
    const segs = segmentsForTextRange(pd, f.start, f.end, charEm);
    if (!segs.length) {
      counts.skipped += 1;
      continue;
    }

    if (f.style === 'spacing-mark') {
      const ops = spacingEditOps(f.found, f.replacement);
      let drew = 0;
      for (const op of ops) {
        const A = segmentsForTextRange(pd, f.start + op.before, f.start + op.before + 1, charEm)[0];
        const B = segmentsForTextRange(pd, f.start + op.after, f.start + op.after + 1, charEm)[0] ?? null;
        if (!A) continue;
        const g = proofMarkGeometry(op.type, A, B);
        const pts = g.strokes.flat();
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        const R = [
          Math.min(...xs) - g.lineWidth,
          Math.min(...ys) - g.lineWidth,
          Math.max(...xs) + g.lineWidth,
          Math.max(...ys) + g.lineWidth,
        ].map(round2);
        const body = `${rgbStr(ANNOT_COLORS.red)} RG ${g.lineWidth} w 1 J 1 j ${g.path}`;
        const markName = op.type === 'insert' ? '띄움표' : '붙임표';
        addAnnot(page, {
          ...common(page, markName, `${f.contents} (${markName})`),
          Subtype: 'Ink',
          Rect: R,
          InkList: g.strokes.map((s) => s.flat()),
          C: ANNOT_COLORS.red.map(round2),
          CA: 1,
          BS: { W: g.lineWidth },
          AP: { N: formXObject(body, R) },
        });
        drew += 1;
      }
      if (drew) counts['spacing-mark'] += 1;
      else counts.skipped += 1;
      continue;
    }

    if (f.style === 'strike') {
      const rect = rectEnclosing(segs, 1);
      let body = `${rgbStr(ANNOT_COLORS.red)} RG\n`;
      for (const q of segs) {
        const h = segHeight(q);
        const a = [q.ll[0] + (q.ul[0] - q.ll[0]) * 0.5, q.ll[1] + (q.ul[1] - q.ll[1]) * 0.5];
        const b = [q.lr[0] + (q.ur[0] - q.lr[0]) * 0.5, q.lr[1] + (q.ur[1] - q.lr[1]) * 0.5];
        body += `${round2(Math.max(0.6, h * 0.07))} w ${round2(a[0])} ${round2(a[1])} m ${round2(b[0])} ${round2(b[1])} l S\n`;
      }
      const ref = addAnnot(page, {
        ...common(page, f.subject, f.contents),
        Subtype: 'StrikeOut',
        Rect: rect,
        QuadPoints: quadPointsAcrobatOrder(segs),
        C: ANNOT_COLORS.red.map(round2),
        CA: 1,
        AP: { N: formXObject(body, rect) },
      });
      // 앱 PdfViewer 기준 글자 크기: 상자 높이 × 0.69 → 글꼴 크기 기준 ≈ 0.65
      addLabel(page, f.pageNum, segs[0], f.label, 'center', ref, f.subject, 0.62);
      counts.strike += 1;
      continue;
    }

    const isReview = f.style === 'review';
    let firstRef = null;
    segs.forEach((seg, i) => {
      const ref = isReview
        ? addBox(page, seg, ANNOT_COLORS.reviewYellow, 0.38, ANNOT_COLORS.reviewBorder, 0.7, f.subject, f.contents, true)
        : addBox(page, seg, ANNOT_COLORS.unifyGray, 0.26, ANNOT_COLORS.unifyGray, 0.72, f.subject, f.contents, false);
      if (i === 0) firstRef = ref;
    });
    addLabel(page, f.pageNum, segs[0], f.label, 'left', firstRef, f.subject, 0.69);
    counts[f.style] += 1;
  }

  const bytes = await doc.save({ useObjectStreams: false });
  return { bytes, counts };
}

/** 사각형 두 점 사이 거리 (테스트·디버그용) */
export function segWidth(/** @type {import('./annotGeometry.js').Seg} */ s) {
  return Math.hypot(...sub(s.lr, s.ll));
}

