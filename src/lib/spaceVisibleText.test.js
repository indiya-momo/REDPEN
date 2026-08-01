import { describe, expect, it } from 'vitest';
import {
  SPACE_VISIBLE_CHAR,
  encodeSpacesVisible,
  sanitizePdfTextFragment,
} from './spaceVisibleText.js';

describe('spaceVisibleText', () => {
  it('공백을 ˅ 로 보이게 한다', () => {
    expect(encodeSpacesVisible('건조 기후')).toBe(`건조${SPACE_VISIBLE_CHAR}기후`);
  });

  it('PDF �(U+FFFD)를 공백으로 본 뒤 ˅ 로 보이게 한다', () => {
    expect(encodeSpacesVisible('건조\uFFFD기후')).toBe(
      `건조${SPACE_VISIBLE_CHAR}기후`,
    );
  });

  it('sanitizePdfTextFragment는 � 를 같은 길이 공백으로 바꾼다', () => {
    const raw = '한대\uFFFD기후';
    const out = sanitizePdfTextFragment(raw);
    expect(out).toBe('한대 기후');
    expect(out.length).toBe(raw.length);
  });
});
