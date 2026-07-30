import { describe, expect, it } from 'vitest';
import {
  isDependentNounPlusUi,
  stripDependentNounGenitiveFromGroups,
} from './unifyDependentNounGenitive.js';

describe('isDependentNounPlusUi', () => {
  it('개의·것의 등을 잡는다', () => {
    expect(isDependentNounPlusUi('개의')).toBe(true);
    expect(isDependentNounPlusUi('것의')).toBe(true);
    expect(isDependentNounPlusUi('만큼의')).toBe(true);
  });

  it('일반 명사·용언은 제외한다', () => {
    expect(isDependentNounPlusUi('의미')).toBe(false);
    expect(isDependentNounPlusUi('정의')).toBe(false);
    expect(isDependentNounPlusUi('만들어')).toBe(false);
    expect(isDependentNounPlusUi('문화')).toBe(false);
  });
});

describe('stripDependentNounGenitiveFromGroups', () => {
  it('개의@ 계열을 목록에서 뺀다', () => {
    const { groups, dropped } = stripDependentNounGenitiveFromGroups([
      {
        type: 'series',
        affixType: 'prefix',
        affix: '개의',
        label: '개의@',
        clusters: [{ key: '개의문제' }],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '문화',
        label: '문화@',
        clusters: [{ key: '문화경제' }],
      },
    ]);
    expect(groups.map((g) => g.affix)).toEqual(['문화']);
    expect(dropped).toEqual([
      {
        id: 'series:prefix:개의',
        label: '개의@',
        reason: "의존명사 '개'+관형격조사 '의'",
      },
    ]);
  });
});
