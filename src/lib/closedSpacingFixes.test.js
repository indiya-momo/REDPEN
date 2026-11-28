import { describe, expect, it } from 'vitest';
import {
  CLOSED_HAE_JIL_LITERAL_ROWS,
  findClosedSpacingFixHits,
} from './closedSpacingFixes.js';
import spellingRulesJson from '../data/spelling-rules.json';

describe('findClosedSpacingFixHits', () => {
  it('오래 된은 붙인다. 다보면·무릎위는 이 모듈이 맡지 않는다', () => {
    const text =
      '오래 된 기억, 다보면 알고, 무릎위에';
    const by = Object.fromEntries(
      findClosedSpacingFixHits(text).map((h) => [h.matchedText, h.suggestedText]),
    );
    expect(by['오래 된']).toBe('오래된');
    // -다 보다는 nonAeoAux, 명사+위는 제2항 묶음.
    expect(by['다보면']).toBeUndefined();
    expect(by['무릎위에']).toBeUndefined();
    expect(by['나뭇가지모양']).toBeUndefined();
    expect(by['수수께기']).toBeUndefined();
    expect(by['뜯겨지고']).toBeUndefined();
  });

  it('들여다보면·읽다보면은 닫힌 표면으로 잡지 않는다', () => {
    expect(findClosedSpacingFixHits('유심히 들여다보면')).toEqual([]);
    expect(findClosedSpacingFixHits('책을 읽다보면')).toEqual([]);
  });

  it('넘어 서 → 넘어서, 뒤 있-이면 제외', () => {
    expect(
      findClosedSpacingFixHits('담을 넘어 서 간다').map((h) => h.suggestedText),
    ).toEqual(['넘어서']);
    expect(findClosedSpacingFixHits('담을 넘어 서 있는 나무')).toEqual([]);
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
