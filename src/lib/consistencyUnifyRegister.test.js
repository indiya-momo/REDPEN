import { describe, expect, it } from 'vitest';
import {
  applyConsistencyUnifyPin,
  clearConsistencyUnifyOverlay,
  getConsistencyUnifyOverlayForGroup,
  getConsistencyUnifyPinnedTailWord,
  listConsistencyUnifyMappings,
  removeConsistencyUnifyEntry,
  setConsistencyUnifyOverlay,
} from './consistencyUnifyRegister.js';

const baseRules = [
  {
    find: '붉은표시',
    replace: '$0',
    enabled: true,
    pattern: 'regex',
    patternKind: 'compound-find',
    tailWord: '붉은표시',
    consistencyUnifyEntry: true,
  },
  {
    find: '빨간표시',
    replace: '$0',
    enabled: true,
    pattern: 'regex',
    patternKind: 'compound-find',
    tailWord: '빨간표시',
    consistencyUnifyEntry: true,
  },
];

describe('consistencyUnifyRegister', () => {
  it('lists mappings from overlayReplace on compound rules', () => {
    const rules = setConsistencyUnifyOverlay(
      setConsistencyUnifyOverlay(baseRules, '붉은표시', '붉은 표시'),
      '빨간표시',
      '붉은 표시',
    );
    expect(listConsistencyUnifyMappings(rules)).toEqual(
      expect.arrayContaining([
        { correction: '붉은표시', unified: '붉은 표시' },
        { correction: '빨간표시', unified: '붉은 표시' },
      ]),
    );
    expect(listConsistencyUnifyMappings(rules)).toHaveLength(2);
  });

  it('clears overlay for one correction', () => {
    const rules = setConsistencyUnifyOverlay(baseRules, '붉은표시', '붉은 표시');
    const next = clearConsistencyUnifyOverlay(rules, '붉은표시');
    expect(listConsistencyUnifyMappings(next)).toEqual([]);
  });

  it('returns overlay for consistency result group by tailWord', () => {
    const rules = setConsistencyUnifyOverlay(baseRules, '붉은표시', '붉은 표시');
    expect(
      getConsistencyUnifyOverlayForGroup(rules, {
        find: '붉은표시',
        replace: '$0',
        label: '붉은표시',
        tailWord: '붉은표시',
        instances: [],
      }),
    ).toBe('붉은 표시');
  });

  it('📌 확정형은 원고 오버레이 없음, 변형만 「→ 통일형 📌」', () => {
    const rules = applyConsistencyUnifyPin(baseRules, '빨간표시');
    expect(getConsistencyUnifyPinnedTailWord(rules)).toBe('빨간표시');
    expect(
      getConsistencyUnifyOverlayForGroup(rules, {
        find: '붉은표시',
        replace: '$0',
        label: '붉은표시',
        tailWord: '붉은표시',
        instances: [],
      }),
    ).toBe('→ 빨간표시 📌');
    expect(
      getConsistencyUnifyOverlayForGroup(rules, {
        find: '빨간표시',
        replace: '$0',
        label: '빨간표시',
        tailWord: '빨간표시',
        instances: [],
      }),
    ).toBe(null);
  });

  it('같은 📌 재클릭 시 해제한다', () => {
    const pinned = applyConsistencyUnifyPin(baseRules, '빨간표시');
    const cleared = applyConsistencyUnifyPin(pinned, '빨간표시');
    expect(getConsistencyUnifyPinnedTailWord(cleared)).toBe(null);
    expect(listConsistencyUnifyMappings(cleared)).toEqual([]);
  });
});
