import { describe, expect, it } from 'vitest';
import { applyConsistencyUnifyPin } from '../lib/consistencyUnifyRegister.js';
import {
  buildWorkHistoryConsistencyCriteria,
  buildWorkHistoryUnifyCriteria,
} from './workHistoryConsistencyCriteria.js';

const streetRules = applyConsistencyUnifyPin(
  [
    {
      find: '스트리트',
      replace: '$0',
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-find',
      tailWord: '스트리트',
      consistencyUnifyEntry: true,
    },
    {
      find: 'STREET',
      replace: '$0',
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-find',
      tailWord: 'STREET',
      consistencyUnifyEntry: true,
    },
    {
      find: '스트릿',
      replace: '$0',
      enabled: true,
      pattern: 'regex',
      patternKind: 'compound-find',
      tailWord: '스트릿',
      consistencyUnifyEntry: true,
    },
  ],
  '스트릿',
);

describe('buildWorkHistoryUnifyCriteria', () => {
  it('📌 통일형은 variants → pinned 한 줄로 묶는다', () => {
    expect(buildWorkHistoryUnifyCriteria(streetRules)).toEqual([
      {
        variants: ['스트리트', 'STREET'],
        pinned: '스트릿',
      },
    ]);
  });

  it('📌 미지정 시 항목별 variants만 반환한다', () => {
    const unpinned = streetRules.map((rule) => {
      const next = { ...rule };
      delete next.consistencyUnifyPinned;
      delete next.overlayReplace;
      return next;
    });
    expect(buildWorkHistoryUnifyCriteria(unpinned)).toEqual([
      { variants: ['스트리트'], pinned: null },
      { variants: ['STREET'], pinned: null },
      { variants: ['스트릿'], pinned: null },
    ]);
  });
});

describe('buildWorkHistoryConsistencyCriteria', () => {
  it('4분류 칩 데이터를 만든다', () => {
    const result = buildWorkHistoryConsistencyCriteria(streetRules, ['foo']);
    expect(result.unify).toEqual([
      { variants: ['스트리트', 'STREET'], pinned: '스트릿' },
    ]);
    expect(result.exclude).toEqual(['foo']);
  });
});
