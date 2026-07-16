/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { buildMyPageWindowUrl } from './openMyPageWindow.js';

describe('buildMyPageWindowUrl', () => {
  it('mypage 기본', () => {
    const url = buildMyPageWindowUrl();
    expect(url.searchParams.get('window')).toBe('mypage');
    expect(url.searchParams.get('mypageSection')).toBeNull();
  });

  it('projects 섹션', () => {
    const url = buildMyPageWindowUrl('projects');
    expect(url.searchParams.get('mypageSection')).toBe('projects');
  });
});
