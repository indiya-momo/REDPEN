import { describe, expect, it } from 'vitest';

import { isBonBojoRequiredItem } from './bonBojoRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';

import { listAuxiliaryVerbEntries } from './auxiliaryVerbRegister.js';

import { ruleDisplayLabel } from './regexFromFind.js';

import { matches } from '../test/matchText.js';



describe('bonBojoRules', () => {
  it('하다·지다는 필수 본조', () => {
    expect(isBonBojoRequiredItem('verb-hada')).toBe(true);
    expect(isBonBojoRequiredItem('verb-jida')).toBe(true);
    expect(isBonBojoRequiredItem('verb-boda1')).toBe(false);
  });
});

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

    expect(list.length).toBe(11);

    expect(labels).toContain('(아/어) + 하다');

    expect(labels).toContain('(아/어) + 지다');

    expect(labels).toContain('(아/어) + 있다');

    expect(labels).toContain('(아/어) + 없다');

    const withBon = rules.filter((r) => r.bonBojoItemId === 'verb-boda1');

    expect(withBon.length).toBeGreaterThan(1);

    const kyeoBon = withBon.find((r) => r.tailWord === '켜 본');

    expect(kyeoBon).toBeTruthy();

    expect(ruleDisplayLabel(kyeoBon)).toBe('켜˅본 (아/어) + 보다');

    expect(matches(kyeoBon, '책장에서 지켜 본')).toBe(true);

    const haeJi = rules.find(
      (r) => r.bonBojoItemId === 'verb-jida' && r.tailWord === '해 지',
    );

    expect(ruleDisplayLabel(haeJi)).toBe('해˅지 (아/어) + 지다');

    const bareBo = withBon.find((r) => r.tailWord === '보');

    expect(bareBo).toBeFalsy();

  });



  it('verb-jida — label 지 단독 규칙 없이 stems만', () => {

    const rules = ensureDefaultAuxiliaryVerbs([]);

    const jida = rules.filter((r) => r.bonBojoItemId === 'verb-jida');

    expect(jida.some((r) => r.tailWord === '지')).toBe(false);

    expect(jida.some((r) => r.tailWord === '해 지')).toBe(true);

    const haeJi = jida.find((r) => r.tailWord === '해 지');

    expect(matches(haeJi, '책장에서 지켜 본')).toBe(false);

  });



  it('verb-jida에 남은 label 단독 지 규칙(bonBojoItemId)은 제거한다', () => {

    const stale = [

      {

        find: String.raw`(\S{2,})[ \u00A0]+지[\uAC00-\uD7A3]+`,

        replace: '$0',

        enabled: true,

        patternKind: 'auxiliary-verb',

        tailWord: '지',

        bonBojoItemId: 'verb-jida',

      },

    ];

    const rules = ensureDefaultAuxiliaryVerbs(stale);

    const jida = rules.filter((r) => r.bonBojoItemId === 'verb-jida');

    expect(jida.some((r) => r.tailWord === '지')).toBe(false);

    expect(jida.some((r) => r.tailWord === '해 지')).toBe(true);

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


