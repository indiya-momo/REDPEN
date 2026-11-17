import { describe, expect, it } from 'vitest';
import {
  AUXILIARY_DOC_ONLY_TIP,
  buildAuxiliaryDocOnlyResultGroups,
  buildBonBojoDocStemCountsByItemId,
  countBonBojoStemsInDocument,
  countGluedStemInText,
  countSpacedStemInText,
} from './auxiliaryVerbDocStemScan.js';

describe('auxiliaryVerbDocStemScan', () => {
  it('띄움·붙임 stem 출현을 센다', () => {
    const text = '해 보았다. 해보자. 다시 해 보지.';
    expect(countSpacedStemInText(text, '해 보')).toBe(2);
    expect(countGluedStemInText(text, '해보')).toBe(1);
  });

  it('itemId별 원고 합산', () => {
    const pages = [{ text: '해 보았다' }, { text: '해보았어' }];
    const counts = countBonBojoStemsInDocument(pages, 'verb-boda1');
    expect(counts.spaced).toBeGreaterThan(0);
    expect(counts.glued).toBeGreaterThan(0);
  });

  it('buildBonBojoDocStemCountsByItemId', () => {
    const map = buildBonBojoDocStemCountsByItemId(
      [{ text: '들어 온다 들어온다' }],
      ['verb-oda'],
    );
    expect(map.get('verb-oda')?.spaced).toBeGreaterThan(0);
    expect(map.get('verb-oda')?.glued).toBeGreaterThan(0);
  });

  it('검사 결과 없는 itemId만 원고 전용 행으로 만든다', () => {
    const docCounts = new Map([
      ['verb-boda1', { spaced: 0, glued: 2 }],
      ['verb-oda', { spaced: 1, glued: 0 }],
    ]);
    const rules = [
      {
        enabled: true,
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-boda1',
        find: '보다',
        replace: '',
      },
      {
        enabled: true,
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-oda',
        find: '오다',
        replace: '',
      },
    ];
    const groups = buildAuxiliaryDocOnlyResultGroups({
      customRules: rules,
      existingGroups: [
        {
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-oda',
          instances: [{ matchedText: '들어 와' }],
        },
      ],
      docCounts,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].bonBojoItemId).toBe('verb-boda1');
    expect(groups[0].instances).toEqual([]);
    expect(groups[0].tip).toBe(AUXILIARY_DOC_ONLY_TIP);
  });
});