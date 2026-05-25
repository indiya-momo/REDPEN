import { describe, expect, it } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { listAuxiliaryVerbEntries } from './auxiliaryVerbRegister.js';

describe('ensureDefaultAuxiliaryVerbs', () => {
  it('빈 규칙에 bon-bojo 시드 — 목록은 item당 1칸, stems는 검색용만', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const list = listAuxiliaryVerbEntries(rules);
    const labels = list.map((e) => e.displayLabel || e.tailWord);
    expect(labels).toContain('(아/어) + 보다');
    expect(labels).toContain('(아/어) + 주다');
    expect(list.some((e) => e.tailWord === '해 보' && !e.bonBojoItemId)).toBe(
      false,
    );
    expect(list.length).toBe(9);
    expect(labels).toContain('(아/어) + 하다');
    expect(labels).toContain('(아/어) + 지다');
    const withBon = rules.filter((r) => r.bonBojoItemId === 'verb-boda1');
    expect(withBon.length).toBeGreaterThan(1);
  });

  it('예전 내장 지·있·해보 낱개 규칙은 제거한다', () => {
    const stale = [
      {
        find: 'x',
        replace: '$0',
        enabled: false,
        patternKind: 'auxiliary-verb',
        tailWord: '지',
      },
      {
        find: 'y',
        replace: '$0',
        enabled: false,
        patternKind: 'auxiliary-verb',
        tailWord: '있',
      },
      {
        find: 'z',
        replace: '$0',
        enabled: false,
        patternKind: 'auxiliary-verb',
        tailWord: '해보',
      },
    ];
    const rules = ensureDefaultAuxiliaryVerbs(stale);
    const tails = listAuxiliaryVerbEntries(rules).map(
      (e) => e.displayLabel || e.tailWord,
    );
    expect(tails).not.toContain('지');
    expect(tails).not.toContain('있');
    expect(tails).not.toContain('해보');
  });

  it('이미 등록된 tailWord는 중복 추가하지 않는다', () => {
    const once = ensureDefaultAuxiliaryVerbs([]);
    const twice = ensureDefaultAuxiliaryVerbs(once);
    expect(listAuxiliaryVerbEntries(twice).length).toBe(
      listAuxiliaryVerbEntries(once).length,
    );
  });
});
