import { describe, expect, it, beforeEach } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { matches } from '../test/matchText.js';
import {
  auxiliarySolidHitLabel,
  clearAuxiliaryDictSolidCache,
  compoundLemma,
  enrichAuxiliaryDictSolid,
  solidSurface,
} from './auxiliaryDictSolid.js';

beforeEach(() => {
  clearAuxiliaryDictSolidCache();
});

function dictFetch(word, pos, status = 200) {
  const body =
    status === 200
      ? { channel: { item: { word, pos } } }
      : {};
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  });
}

function auxGroup(itemId, label, matchedText) {
  return {
    patternKind: 'auxiliary-verb',
    bonBojoItemId: itemId,
    groupDisplayLabel: label,
    label,
    tip: '',
    instances: [{ pageNum: 1, matchedText, start: 0, end: matchedText.length }],
  };
}

describe('auxiliaryDictSolid', () => {
  it('등재 표시는 페이지를 붙여 한 줄로 쓴다', () => {
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '들어 온', suggestedText: '들어온' },
        '10P',
      ),
    ).toBe('들어 온 → 들어온 10P');
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '날아 올라', suggestedText: '날아올라' },
        '21P 1/2',
      ),
    ).toBe('날아 올라 → 날아올라 21P 1/2');
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '멀리 가려고', suggestedText: '멀리 가려고' },
        '1P',
      ),
    ).toBe('');
  });

  it('들어 온 → 들어오다 / 들어온', () => {
    expect(compoundLemma('들어 온', 'verb-oda', '(아/어) + 오다')).toBe('들어오다');
    expect(solidSurface('들어 온')).toBe('들어온');
  });

  it('쉬어 가라고 → 쉬어가다 / 쉬어가라고', () => {
    expect(compoundLemma('쉬어 가라고', 'verb-gada', '(아/어) + 가다')).toBe(
      '쉬어가다',
    );
    expect(solidSurface('쉬어 가라고')).toBe('쉬어가라고');
  });

  it('날아 올라 → 날아오르다 / 날아올라, 1차 규칙이 잡는다', () => {
    expect(compoundLemma('날아 올라', 'verb-oreuda', '(아/어) + 오르다')).toBe(
      '날아오르다',
    );
    expect(solidSurface('날아 올라')).toBe('날아올라');
    const rule = ensureDefaultAuxiliaryVerbs([]).find(
      (row) => row.bonBojoItemId === 'verb-oreuda' && row.tailWord === '아 올라',
    );
    expect(rule).toBeTruthy();
    expect(matches({ ...rule, enabled: true }, '높이 날아 올라갔다.')).toBe(true);
  });

  it('사전 용언 등재면 수정안과 설명을 붙인다', async () => {
    const groups = [
      auxGroup('verb-oda', '(아/어) + 오다', '들어 온'),
    ];
    const next = await enrichAuxiliaryDictSolid(groups, {
      fetchImpl: dictFetch('들어오다', '동사'),
    });
    expect(next[0].instances[0].suggestedText).toBe('들어온');
    expect(next[0].tip).toContain('들어오다');
    expect(next[0].tip).toContain('붙여 씀');
  });

  it('미등재·키 없음이면 그대로 둔다', async () => {
    const groups = [auxGroup('verb-gada', '(아/어) + 가다', '되어 간다')];
    const missing = await enrichAuxiliaryDictSolid(groups, {
      fetchImpl: dictFetch('', ''),
    });
    expect(missing[0].instances[0].suggestedText).toBeUndefined();
    expect(missing[0].tip).toBe('');

    const noKey = await enrichAuxiliaryDictSolid(groups, {
      fetchImpl: async () => ({
        status: 503,
        ok: false,
        text: async () => 'STDICT_KEY_MISSING',
      }),
    });
    expect(noKey[0]).toBe(groups[0]);
  });
});
