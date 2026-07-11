import { describe, expect, it, beforeEach } from 'vitest';
import {
  beginGuestBrowse,
  endGuestBrowse,
  isGuestBrowseActive,
} from './guestBrowseSession.js';

describe('guestBrowseSession', () => {
  beforeEach(() => {
    endGuestBrowse();
  });

  it('begin/end로 둘러보기 플래그를 켠다·끈다', () => {
    expect(isGuestBrowseActive()).toBe(false);
    beginGuestBrowse();
    expect(isGuestBrowseActive()).toBe(true);
    endGuestBrowse();
    expect(isGuestBrowseActive()).toBe(false);
  });
});
