import { describe, expect, it } from 'vitest';
import {
  buildPageGlyphs,
  ensurePageGlyphOffsets,
  getItemGlyphOffsets,
  glyphOffsetsForItem,
} from './pdfGlyphAdvances.js';
import { charOffsetsInItem } from './pdfTextItemMetrics.js';

/** pdf.js OPS 중 쓰는 것만 (값은 임의) */
const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  beginText: 31,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setFont: 37,
  setTextMatrix: 42,
  showText: 44,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
};
const FONT = { fontMatrix: [0.001, 0, 0, 0.001, 0, 0] };
const getFont = () => FONT;

/** @param {string} unicode @param {number} width @param {boolean} [isSpace] */
const G = (unicode, width, isSpace = false) => ({ unicode, width, isSpace });

/**
 * 한 줄 TJ (book_part2 본문과 같은 구조: Tf 1, Tm 10배, Tc=-Tw).
 * @param {Array<object|number>} glyphs
 * @param {{ Tc?: number, Tw?: number }} [sp]
 */
function lineOpList(glyphs, { Tc = -0.126, Tw = 0.126 } = {}) {
  return {
    fnArray: [OPS.beginText, OPS.setCharSpacing, OPS.setWordSpacing, OPS.setFont, OPS.setTextMatrix, OPS.showText],
    argsArray: [null, [Tc], [Tw], ['f1', 1], [[10, 0, 0, 10, 79.37, 385.54]], [glyphs]],
  };
}

describe('pdfGlyphAdvances', () => {
  it('(a) 2바이트 공백(isSpace=false)은 Tw를 빼고 캔버스와 같은 원점', () => {
    const glyphs = [G('담', 1000), -31.7, G('겨', 1000), -101, G(' ', 360, false), G('있', 1000)];
    const page = buildPageGlyphs(lineOpList(glyphs), { OPS, getFont });
    const item = { str: '담겨 있', transform: [10, 0, 0, 10, 79.37, 385.54], width: 0 };
    const off = glyphOffsetsForItem(item, page);
    expect(off).toHaveLength(item.str.length + 1);
    // 담 10-1.26 = 8.74, TJ -31.7 → +0.317
    expect(off[0]).toBeCloseTo(0, 6);
    expect(off[1]).toBeCloseTo(8.74 + 0.317, 6);
    // 겨 다음 TJ -101 → +1.01, 공백 원점
    expect(off[2]).toBeCloseTo(off[1] + 8.74 + 1.01, 6);
    // 공백 진행 = 10*(0.36-0.126) = 2.34 (Tw 없음)
    expect(off[3]).toBeCloseTo(off[2] + 2.34, 6);
    // 끝 = 있 원점 + 글자 폭(10)
    expect(off[4]).toBeCloseTo(off[3] + 10, 6);
  });

  it('(b) 1바이트 공백(isSpace=true)은 Tw를 더하고 item.width 비율 분할과 같다', () => {
    const glyphs = [G('가', 1000), G(' ', 250, true), G('나', 1000)];
    const page = buildPageGlyphs(lineOpList(glyphs, { Tc: 0, Tw: 0.1 }), { OPS, getFont });
    // pdf.js getTextContent 식: 10 + (2.5+1) + 10
    const item = { str: '가 나', transform: [10, 0, 0, 10, 79.37, 385.54], width: 23.5 };
    const off = glyphOffsetsForItem(item, page);
    expect(off[2]).toBeCloseTo(13.5, 6);
    const em = (ch) => (ch === ' ' ? 0.35 : 1);
    const ref = charOffsetsInItem(item.str, item.width, 10, em);
    off.forEach((v, i) => expect(v).toBeCloseTo(ref[i], 6));
  });

  it('(c) 글자가 1:1로 안 맞으면 null → 폴백', () => {
    const page = buildPageGlyphs(lineOpList([G('담', 1000), G('겨', 1000)]), { OPS, getFont });
    const t = [10, 0, 0, 10, 79.37, 385.54];
    expect(glyphOffsetsForItem({ str: '담기', transform: t }, page)).toBeNull();
    expect(glyphOffsetsForItem({ str: '담겨요', transform: t }, page)).toBeNull();
    // 다른 줄(y) 이면 매칭 안 함
    expect(glyphOffsetsForItem({ str: '담겨', transform: [10, 0, 0, 10, 79.37, 300] }, page)).toBeNull();
    // 합자(유니코드 2글자 글리프)는 위치를 나눌 수 없어 null
    const lig = buildPageGlyphs(lineOpList([G('fi', 500)]), { OPS, getFont });
    expect(glyphOffsetsForItem({ str: 'fi', transform: t }, lig)).toBeNull();
  });

  it('CTM(transform)·save/restore 반영', () => {
    const op = {
      fnArray: [OPS.save, OPS.transform, OPS.beginText, OPS.setFont, OPS.setTextMatrix, OPS.showText, OPS.restore],
      argsArray: [null, [1, 0, 0, 1, 100, 0], null, ['f1', 10], [[1, 0, 0, 1, 5, 50]], [[G('가', 1000), G('나', 1000)]]],
    };
    const page = buildPageGlyphs(op, { OPS, getFont });
    expect(page[0].ox).toBeCloseTo(105, 6);
    const off = glyphOffsetsForItem({ str: '가나', transform: [10, 0, 0, 10, 105, 50] }, page);
    expect(off).toEqual([0, 10, 20]);
  });

  it('ensurePageGlyphOffsets: 연산자 목록 실패 시 null(폴백), 성공 시 캐시', async () => {
    const item = { str: '가나', transform: [10, 0, 0, 10, 105, 50] };
    const bad = { getOperatorList: async () => { throw new Error('x'); }, commonObjs: { get: getFont } };
    await ensurePageGlyphOffsets(bad, [item], OPS);
    expect(getItemGlyphOffsets(item)).toBeNull();

    const item2 = { str: '가나', transform: [10, 0, 0, 10, 105, 50] };
    let calls = 0;
    const good = {
      getOperatorList: async () => {
        calls += 1;
        return {
          fnArray: [OPS.beginText, OPS.setFont, OPS.setTextMatrix, OPS.showText],
          argsArray: [null, ['f1', 10], [[1, 0, 0, 1, 105, 50]], [[G('가', 1000), G('나', 1000)]]],
        };
      },
      commonObjs: { get: getFont },
    };
    await ensurePageGlyphOffsets(good, [item2], OPS);
    await ensurePageGlyphOffsets(good, [item2], OPS);
    expect(getItemGlyphOffsets(item2)).toEqual([0, 10, 20]);
    expect(calls).toBe(1);

    // force: null 캐시를 지우고 다시 잰다
    const item3 = { str: '가나', transform: [10, 0, 0, 10, 105, 50] };
    await ensurePageGlyphOffsets(bad, [item3], OPS);
    expect(getItemGlyphOffsets(item3)).toBeNull();
    await ensurePageGlyphOffsets(good, [item3], OPS, { force: true });
    expect(getItemGlyphOffsets(item3)).toEqual([0, 10, 20]);
  });
});
