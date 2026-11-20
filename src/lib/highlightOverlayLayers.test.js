import { describe, expect, it } from 'vitest';
import {
  applyHighlightOverlayLayers,
  expandHighlightOverlayLayers,
  filterPickedHighlightLayers,
  formatOverlayAsReplace,
  highlightToManualEditPayload,
  resolveOverlayChoiceLayers,
  splitOverlayForms,
} from './highlightOverlayLayers.js';

describe('splitOverlayForms', () => {
  it('쉼표로 고칠 말 둘을 나눈다', () => {
    expect(splitOverlayForms('한 번, 한번')).toEqual(['한 번', '한번']);
    expect(splitOverlayForms('그렇다, 그했다')).toEqual(['그렇다', '그했다']);
  });

  it('이미 →수정형이면 나누지 않는다', () => {
    expect(splitOverlayForms('→ 맞혀')).toEqual(['→ 맞혀']);
    expect(splitOverlayForms('→가⁀닿')).toEqual(['→가⁀닿']);
  });

  it('띄움·붙임 두 형태를 나눈다', () => {
    expect(splitOverlayForms('∨뿐 ⁀뿐')).toEqual(['∨뿐', '⁀뿐']);
  });
});

describe('expandHighlightOverlayLayers', () => {
  it('하이라이트는 하나, 그 위 레이어만 →수정형 둘', () => {
    const rows = expandHighlightOverlayLayers({
      id: '15-10-한번',
      start: 10,
      end: 12,
      overlayReplace: '한 번, 한번',
      matchedText: '한번',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('15-10-한번');
    expect(rows[0].overlayLayers).toHaveLength(2);
    expect(rows[0].overlayLayers[0].overlayLabel).toBe('한\u2228번');
    expect(rows[0].overlayLayers[0].overlayForm).toBe('한 번');
    expect(rows[0].overlayLayers[0].overlayReplace).toBe('→ 한\u2228번');
    expect(rows[0].overlayLayers[1].overlayReplace).toBe('→ 한번');
    expect(rows[0].overlayLayers[0].id).toBe('15-10-한번#0');
  });

  it('수정형 하나는 그대로', () => {
    const rows = expandHighlightOverlayLayers({
      id: '1-0-맞춰',
      overlayReplace: '→ 맞혀',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].overlayReplace).toBe('→ 맞혀');
    expect(rows[0].overlayLayers).toBeUndefined();
    expect(formatOverlayAsReplace('맞혀')).toBe('→ 맞혀');
  });
});

describe('applyHighlightOverlayLayers', () => {
  it('목록에서 하나를 고르면 겹친 다른 발견은 숨긴다', () => {
    const next = applyHighlightOverlayLayers([
      { id: 'a', start: 0, end: 2, primary: false, overlayReplace: '→ 가' },
      { id: 'b', start: 0, end: 2, primary: true, overlayReplace: '→ 나' },
    ]);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('b');
  });

  it('두 형태도 하이라이트는 하나다', () => {
    const next = applyHighlightOverlayLayers([
      { id: 'p', start: 4, end: 6, overlayReplace: '한 번, 한번' },
    ]);
    expect(next).toHaveLength(1);
    expect(next[0].overlayLayers).toHaveLength(2);
  });
});

describe('resolveOverlayChoiceLayers', () => {
  it('overlayChoiceSource만 있어도 얇다·가늘다 둘을 만든다', () => {
    const layers = resolveOverlayChoiceLayers({
      id: 'yalda',
      overlayChoiceSource: '얇다, 가늘다',
    });
    expect(layers).toHaveLength(2);
    expect(layers.map((l) => l.overlayForm)).toEqual(['얇다', '가늘다']);
    expect(layers[1].overlayReplace).toBe('→ 가늘다');
  });
});

describe('filterPickedHighlightLayers', () => {
  it('고른 레이어만 남기고 하이라이트는 유지한다', () => {
    const rows = expandHighlightOverlayLayers({
      id: 'p',
      start: 4,
      end: 6,
      overlayReplace: '한 번, 한번',
    });
    const next = filterPickedHighlightLayers(rows, rows[0].overlayLayers[1].id);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('p');
    expect(next[0].overlayReplace).toBe('→ 한번');
    expect(next[0].overlayLayers).toBeUndefined();
  });

  it('다른 항목을 골라도 이미 고른 레이어는 하나인 채로 둔다', () => {
    const once = expandHighlightOverlayLayers({
      id: 'p',
      start: 4,
      end: 6,
      overlayReplace: '한 번, 한번',
    });
    const twice = expandHighlightOverlayLayers({
      id: 'q',
      start: 20,
      end: 22,
      overlayReplace: '그렇다, 그했다',
    });
    const picked = {
      p: once[0].overlayLayers[1].id,
    };
    const next = filterPickedHighlightLayers([...once, ...twice], picked);
    expect(next[0].overlayReplace).toBe('→ 한번');
    expect(next[0].overlayLayers).toBeUndefined();
    expect(next[1].overlayLayers).toHaveLength(2);
  });
});

describe('highlightToManualEditPayload', () => {
  const page = { pageNum: 4, text: '마음가는 길', visualText: '마음가는 길' };

  it('원본은 하이라이트 상자 글자다', () => {
    const payload = highlightToManualEditPayload(
      {
        start: 2,
        end: 4,
        overlayReplace: '얇다, 가늘다',
        editPayload: {
          pageNum: 4,
          index: 2,
          matchedText: '가는',
          suggestedText: '가늘다',
          tip: '굵기',
        },
      },
      page,
      { overlayForm: '가늘다' },
    );
    expect(payload).toMatchObject({
      pageNum: 4,
      start: 2,
      end: 4,
      matchedText: '가는',
      replace: '',
      tip: '',
      fromHighlight: true,
    });
  });

  it('수정·메모는 비운다', () => {
    const payload = highlightToManualEditPayload(
      {
        start: 0,
        end: 3,
        overlayReplace: '→ 마음∨가',
        tip: '자동 팁',
        editPayload: {
          pageNum: 4,
          index: 0,
          matchedText: '마음가',
          suggestedText: '마음 가',
          tip: '자동 팁',
        },
      },
      page,
      { overlayReplace: '→ 마음∨가' },
    );
    expect(payload.matchedText).toBe('마음가');
    expect(payload.replace).toBe('');
    expect(payload.tip).toBe('');
  });
});
