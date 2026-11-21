import { describe, expect, it } from 'vitest';
import { findClosedSpacingFixHits } from './closedSpacingFixes.js';

describe('findClosedSpacingFixHits', () => {
  it('오래 된·다보면·무릎위·나뭇가지모양', () => {
    const text =
      '오래 된 기억, 다보면 알고, 무릎위에, 나뭇가지모양';
    const by = Object.fromEntries(
      findClosedSpacingFixHits(text).map((h) => [h.matchedText, h.suggestedText]),
    );
    expect(by['오래 된']).toBe('오래된');
    expect(by['다보면']).toBe('다 보면');
    expect(by['무릎위에']).toBe('무릎 위에');
    expect(by['나뭇가지모양']).toBe('나뭇가지 모양');
    expect(by['수수께기']).toBeUndefined();
    expect(by['뜯겨지고']).toBeUndefined();
  });

  it('들여다보면은 잡지 않고 읽다보면·그러다보니는 잡는다', () => {
    expect(findClosedSpacingFixHits('유심히 들여다보면')).toEqual([]);
    expect(
      findClosedSpacingFixHits('책을 읽다보면').map((h) => h.matchedText),
    ).toEqual(['다보면']);
    // 다보니는 LITERAL_ROWS에 없으면 스킵 — 시트 쪽이 담당
  });

  it('넘어 서 → 넘어서, 뒤 있-이면 제외', () => {
    expect(
      findClosedSpacingFixHits('담을 넘어 서 간다').map((h) => h.suggestedText),
    ).toEqual(['넘어서']);
    expect(findClosedSpacingFixHits('담을 넘어 서 있는 나무')).toEqual([]);
  });
});
