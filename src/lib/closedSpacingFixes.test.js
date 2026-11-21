import { describe, expect, it } from 'vitest';
import {
  CLOSED_HAE_JIL_LITERAL_ROWS,
  findClosedSpacingFixHits,
} from './closedSpacingFixes.js';
import spellingRulesJson from '../data/spelling-rules.json';

describe('findClosedSpacingFixHits', () => {
  it('오래 된·다보면·무릎위', () => {
    const text =
      '오래 된 기억, 다보면 알고, 무릎위에';
    const by = Object.fromEntries(
      findClosedSpacingFixHits(text).map((h) => [h.matchedText, h.suggestedText]),
    );
    expect(by['오래 된']).toBe('오래된');
    expect(by['다보면']).toBe('다 보면');
    expect(by['무릎위에']).toBe('무릎 위에');
    expect(by['나뭇가지모양']).toBeUndefined();
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

  it('해질녘·해질 무렵 — 어절 시작만 (따뜻해질·깨끗해질 제외)', () => {
    const by = (text) =>
      Object.fromEntries(
        findClosedSpacingFixHits(text).map((h) => [
          h.matchedText,
          h.suggestedText,
        ]),
      );
    expect(by('해질녘 바람이')).toEqual({ 해질녘: '해 질 녘' });
    expect(by('해질 무렵 가장')).toEqual({ '해질 무렵': '해 질 무렵' });
    expect(by('해 질 무렵')).toEqual({});
    expect(by('따뜻해질 무렵')).toEqual({});
    expect(by('선선해질 무렵')).toEqual({});
    expect(by('깨끗해질 때')).toEqual({});
  });

  it('해질 spelling rows and CLOSED_HAE_JIL_LITERAL_ROWS stay in parity', () => {
    const sheet = spellingRulesJson
      .filter((r) => String(r.find ?? '').startsWith('\uD574\uC9C8'))
      .map((r) => ({ find: r.find, replace: r.replace }))
      .toSorted((a, b) => a.find.localeCompare(b.find, 'ko'));
    const mod = CLOSED_HAE_JIL_LITERAL_ROWS.map((r) => ({
      find: r.find,
      replace: r.replace,
    })).toSorted((a, b) => a.find.localeCompare(b.find, 'ko'));
    expect(mod).toEqual(sheet);
  });
});
