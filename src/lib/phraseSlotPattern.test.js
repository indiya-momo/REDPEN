import { describe, expect, it } from 'vitest';
import { buildPhraseSlotFindRules, isPhraseSlotPattern } from './phraseSlotPattern.js';
import { matchAll, matches } from '../test/matchText.js';
import { SPACE_VISIBLE_CHAR, encodeSpacesVisible } from './spaceVisibleText.js';

describe('phraseSlotPattern', () => {
  it('@시대는 붙임만, 띄어쓴 조선 시대는 제외', () => {
    expect(isPhraseSlotPattern('@시대')).toBe(true);
    const [rule] = buildPhraseSlotFindRules('@시대');
    expect(matches(rule, '조선시대와 고려시대')).toBe(true);
    expect(matches(rule, '조선 시대와')).toBe(false);
  });

  it('@˅시대는 패턴에 공백이 있을 때만 띄어쓴 형태 매칭', () => {
    const [rule] = buildPhraseSlotFindRules('@ 시대');
    expect(matches(rule, '조선 시대')).toBe(true);
    expect(matches(rule, '조선시대')).toBe(false);
  });

  it('어절 앞 공백은 경계만 — matchedText에 앞 공백(˅)이 안 붙는다', () => {
    const [rule] = buildPhraseSlotFindRules('@경제');
    const hits = matchAll(rule, '또한 실물경제와 거품경제');
    expect(hits).toEqual(['실물경제', '거품경제']);
    expect(hits.every((h) => !h.startsWith(' ') && !h.includes(SPACE_VISIBLE_CHAR))).toBe(
      true,
    );
    expect(encodeSpacesVisible(hits[0])).toBe('실물경제');
  });

  it('PDF �(U+FFFD)만으로 된 가짜 채움은 매칭하지 않는다', () => {
    const [rule] = buildPhraseSlotFindRules('@경제');
    expect(matches(rule, `\uFFFD\uFFFD경제`)).toBe(false);
    expect(matches(rule, `실물경제`)).toBe(true);
  });
});
