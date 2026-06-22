import { describe, expect, it } from 'vitest';
import {
  pdfPageOverflowsStage,
  scrollPdfStageToCenter,
  scrollPdfStageToOrigin,
  syncPdfStageScroll,
} from './pdfStageScroll.js';

function mockStage({ clientWidth = 400, clientHeight = 600 } = {}) {
  return {
    clientWidth,
    clientHeight,
    scrollLeft: 0,
    scrollTop: 0,
  };
}

function mockWrap({ offsetWidth = 300, offsetHeight = 500 } = {}) {
  return { offsetWidth, offsetHeight };
}

describe('pdfStageScroll', () => {
  it('detects overflow when page exceeds stage', () => {
    const stage = mockStage({ clientWidth: 400, clientHeight: 600 });
    const wrap = mockWrap({ offsetWidth: 500, offsetHeight: 700 });
    expect(pdfPageOverflowsStage(stage, wrap)).toBe(true);
  });

  it('does not detect overflow when page fits', () => {
    const stage = mockStage({ clientWidth: 400, clientHeight: 600 });
    const wrap = mockWrap({ offsetWidth: 400, offsetHeight: 600 });
    expect(pdfPageOverflowsStage(stage, wrap)).toBe(false);
  });

  it('centers scroll when overflowing', () => {
    const stage = mockStage({ clientWidth: 400, clientHeight: 600 });
    const wrap = mockWrap({ offsetWidth: 500, offsetHeight: 800 });
    scrollPdfStageToCenter(stage, wrap);
    expect(stage.scrollLeft).toBe(50);
    expect(stage.scrollTop).toBe(100);
  });

  it('resets scroll when page fits', () => {
    const stage = mockStage();
    stage.scrollLeft = 40;
    stage.scrollTop = 60;
    scrollPdfStageToOrigin(stage);
    expect(stage.scrollLeft).toBe(0);
    expect(stage.scrollTop).toBe(0);
  });

  it('sync chooses center or origin from overflow', () => {
    const stage = mockStage({ clientWidth: 400, clientHeight: 600 });
    const smallWrap = mockWrap({ offsetWidth: 300, offsetHeight: 500 });
    syncPdfStageScroll(stage, smallWrap);
    expect(stage.scrollLeft).toBe(0);
    expect(stage.scrollTop).toBe(0);

    const largeWrap = mockWrap({ offsetWidth: 500, offsetHeight: 800 });
    syncPdfStageScroll(stage, largeWrap);
    expect(stage.scrollLeft).toBe(50);
    expect(stage.scrollTop).toBe(100);
  });
});
