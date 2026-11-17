import { describe, expect, it } from 'vitest';
import {
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
});