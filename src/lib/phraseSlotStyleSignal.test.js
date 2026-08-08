import { describe, expect, it } from 'vitest';
import { SPACE_VISIBLE_CHAR } from './spaceVisibleText.js';
import {
  collectPhraseSlotStemStyleSignals,
  formatPhraseSlotStemStyleSignalText,
  interleavePhraseSlotStemStyleSignals,
  isPhraseSlotSpacedPattern,
  phraseSlotStemFromPattern,
} from './phraseSlotStyleSignal.js';

describe('phraseSlotStyleSignal', () => {
  it('stem — @서비스·@˅서비스 동일', () => {
    expect(phraseSlotStemFromPattern('@서비스')).toBe('서비스');
    expect(phraseSlotStemFromPattern(`@${SPACE_VISIBLE_CHAR}서비스`)).toBe(
      '서비스',
    );
    expect(phraseSlotStemFromPattern('@ 서비스')).toBe('서비스');
  });

  it('spaced — space 토큰 1차, ˅는 decode 후 동일', () => {
    expect(isPhraseSlotSpacedPattern('@서비스')).toBe(false);
    expect(isPhraseSlotSpacedPattern('@ 서비스')).toBe(true);
    expect(isPhraseSlotSpacedPattern(`@${SPACE_VISIBLE_CHAR}서비스`)).toBe(
      true,
    );
  });

  it('집계 — 혼재 iff 양쪽 occurrence >0', () => {
    const signals = collectPhraseSlotStemStyleSignals([
      {
        patternKind: 'phrase-slot-find',
        tailWord: '@서비스',
        instances: [{}, {}, {}],
      },
      {
        patternKind: 'phrase-slot-find',
        tailWord: '@ 서비스',
        instances: [{}, {}],
      },
      {
        patternKind: 'phrase-slot-find',
        tailWord: '@프로그램',
        instances: [{}],
      },
    ]);
    const svc = signals.find((s) => s.stem === '서비스');
    const prog = signals.find((s) => s.stem === '프로그램');
    expect(svc).toEqual({
      stem: '서비스',
      gluedCount: 3,
      spacedCount: 2,
      mixed: true,
    });
    expect(prog).toEqual({
      stem: '프로그램',
      gluedCount: 1,
      spacedCount: 0,
      mixed: false,
    });
    expect(formatPhraseSlotStemStyleSignalText(svc)).toContain('스타일 혼재');
    expect(formatPhraseSlotStemStyleSignalText(prog)).not.toContain(
      '스타일 혼재',
    );
  });

  it('occurrence 0 stem은 집계에서 제외', () => {
    expect(
      collectPhraseSlotStemStyleSignals([
        {
          patternKind: 'phrase-slot-find',
          tailWord: '@서비스',
          instances: [],
        },
      ]),
    ).toEqual([]);
  });

  it('interleave — stem당 요약 1회, 카드 순서 유지', () => {
    const entries = [
      {
        group: {
          patternKind: 'phrase-slot-find',
          tailWord: '@서비스',
          instances: [{}],
        },
      },
      {
        group: {
          patternKind: 'phrase-slot-find',
          tailWord: '@ 서비스',
          instances: [{}],
        },
      },
      {
        group: {
          patternKind: 'phrase-slot-find',
          tailWord: '@프로그램',
          instances: [{}],
        },
      },
    ];
    const rows = interleavePhraseSlotStemStyleSignals(entries);
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toEqual([
      'stem-signal',
      'entry',
      'entry',
      'stem-signal',
      'entry',
    ]);
    expect(rows[0].kind === 'stem-signal' && rows[0].signal.stem).toBe(
      '서비스',
    );
    expect(rows[0].kind === 'stem-signal' && rows[0].signal.mixed).toBe(true);
    const signals = rows.filter((r) => r.kind === 'stem-signal');
    expect(signals).toHaveLength(2);
  });
});
