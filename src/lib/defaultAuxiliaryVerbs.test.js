import { describe, expect, it } from 'vitest';

import { isBonBojoRequiredItem } from './bonBojoRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';

import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from './auxiliaryVerbRegister.js';

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

  it('기본 선택은 필수 본조(하다·지다)만 켜진다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const list = listAuxiliaryVerbEntries(rules);
    for (const entry of list) {
      const on = isAuxiliaryVerbEntryEnabled(rules, entry);
      if (isBonBojoRequiredItem(entry.bonBojoItemId)) {
        expect(on).toBe(true);
      } else {
        expect(on).toBe(false);
      }
    }
  });

  it('빈 규칙에 bon-bojo 시드 — 목록은 item당 1칸, stems는 검색용만', () => {

    const rules = ensureDefaultAuxiliaryVerbs([]);

    const list = listAuxiliaryVerbEntries(rules);

    const labels = list.map((e) => e.displayLabel || e.tailWord);

    expect(labels).toContain('(아/어) + 보다');

    expect(labels).toContain('(아/어) + 주다');

    expect(list.some((e) => e.tailWord === '해 보' && !e.bonBojoItemId)).toBe(

      false,

    );

    expect(list.length).toBe(10);

    expect(labels).toContain('(아/어) + 하다');
    expect(labels).not.toContain('아는체하다');

    expect(labels).toContain('(아/어) + 지다');

    expect(labels).toContain('(아/어) + 있다');

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



  it('verb-gada — 연결 어미 「어」 단독 stem 규칙을 만들지 않는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const gada = rules.filter((r) => r.bonBojoItemId === 'verb-gada');
    expect(gada.some((r) => r.tailWord === '어')).toBe(false);
    expect(gada.some((r) => r.tailWord === '어 간')).toBe(true);
  });

  it('orphan 단독 음절 러 보조용언 규칙은 제거한다', () => {
    const stale = [
      {
        find: 'x',
        replace: '$0',
        enabled: true,
        patternKind: 'auxiliary-verb',
        tailWord: '러',
      },
    ];
    const rules = ensureDefaultAuxiliaryVerbs(stale);
    const list = listAuxiliaryVerbEntries(rules);
    expect(list.some((e) => (e.displayLabel || e.tailWord) === '러')).toBe(
      false,
    );
    expect(list.length).toBe(10);
  });

  it('bon-bojo 본조 — stems마다 띄움 regex 1개(붙임 없음)', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const aux = rules.filter((r) => r.patternKind === 'auxiliary-verb' && r.bonBojoItemId);
    const byTail = new Map();
    for (const r of aux) {
      const key = `${r.bonBojoItemId}\0${r.tailWord}`;
      byTail.set(key, (byTail.get(key) ?? 0) + 1);
    }
    expect([...byTail.values()].every((n) => n === 1)).toBe(true);
    const arHaess = aux.find(
      (r) => r.bonBojoItemId === 'verb-hada' && r.tailWord === '아 했',
    );
    expect(matches(arHaess, '좋아 했지만')).toBe(true);
    expect(matches(arHaess, '좋아했지만')).toBe(false);
    const kyeoBon = aux.find(
      (r) => r.bonBojoItemId === 'verb-boda1' && r.tailWord === '켜 본',
    );
    expect(matches(kyeoBon, '지켜본')).toBe(false);
  });

  it('adj-che-hada — UI 제외, 아는체하다 붙임만 항상 검사', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const list = listAuxiliaryVerbEntries(rules);
    expect(list.some((e) => e.bonBojoItemId === 'adj-che-hada')).toBe(false);
    const che = rules.filter((r) => r.bonBojoItemId === 'adj-che-hada');
    expect(che.length).toBe(1);
    expect(che[0].tailWord).toBe('체하');
    expect(che[0].label).toBe('아는체하다');
    expect(che.every((r) => r.enabled)).toBe(true);
    expect(matches(che[0], '아는체하다')).toBe(true);
    expect(matches(che[0], '아는 체 하다')).toBe(false);
  });

  it('이미 등록된 tailWord는 중복 추가하지 않는다', () => {

    const once = ensureDefaultAuxiliaryVerbs([]);

    const twice = ensureDefaultAuxiliaryVerbs(once);

    expect(listAuxiliaryVerbEntries(twice).length).toBe(

      listAuxiliaryVerbEntries(once).length,

    );

  });

  it('저장된 본조 find가 구형(붙임)이면 재생성 후 역할을 해 왔다를 잡는다', () => {
    const stale = ensureDefaultAuxiliaryVerbs([]).find(
      (r) => r.tailWord === '해 왔',
    );
    expect(stale).toBeTruthy();
    const gluedFind = String.raw`(\S*해)왔`;
    const rules = ensureDefaultAuxiliaryVerbs([
      { ...stale, find: gluedFind, enabled: true, bonBojoItemId: 'verb-oda' },
    ]);
    const haeWat = rules.filter(
      (r) => r.tailWord === '해 왔' && r.bonBojoItemId === 'verb-oda',
    );
    expect(haeWat).toHaveLength(1);
    expect(haeWat[0].find).not.toBe(gluedFind);
    expect(haeWat[0].enabled).toBe(true);
    expect(matches(haeWat[0], '역할을 해 왔다.')).toBe(true);
  });

  it('verb-oda 해 왔 — 재생성 규칙이 역할을 해 왔다를 잡는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const haeWat = rules.find(
      (r) => r.bonBojoItemId === 'verb-oda' && r.tailWord === '해 왔',
    );
    expect(haeWat).toBeTruthy();
    expect(haeWat.enabled).toBe(false);
    expect(haeWat.find).toContain('해');
    expect(matches({ ...haeWat, enabled: true }, '역할을 해 왔다.')).toBe(true);
  });

  it('verb-oda 려 왔 — 달려 왔다(ㄹ 본용언+오다)', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const ryoWat = rules.find(
      (r) => r.bonBojoItemId === 'verb-oda' && r.tailWord === '려 왔',
    );
    expect(ryoWat).toBeTruthy();
    expect(ryoWat.enabled).toBe(false);
    expect(matches({ ...ryoWat, enabled: true }, '달려 왔다.')).toBe(true);
  });

});


