import { describe, expect, it } from 'vitest';
import { FAQ_ITEMS } from './faqItems.js';

describe('faqItems', () => {
  it('문항 id·질문·답변이 비어 있지 않다', () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const item of FAQ_ITEMS) {
      expect(item.id.trim()).not.toBe('');
      expect(item.question.trim().endsWith('?')).toBe(true);
      expect(item.answer.trim().length).toBeGreaterThan(20);
    }
  });

  it('소개·기능·그외 문항이 있다', () => {
    const ids = FAQ_ITEMS.map((item) => item.id);
    expect(ids).toEqual([
      'what',
      'privacy',
      'pdf-type',
      'start',
      'highlight',
      'tabs',
      'project',
      'beta',
      'device',
    ]);
    expect(FAQ_ITEMS[0].question.startsWith('[소개]')).toBe(true);
    expect(FAQ_ITEMS[3].question.startsWith('[기능]')).toBe(true);
    expect(FAQ_ITEMS[7].question.startsWith('[그외]')).toBe(true);
  });
});
