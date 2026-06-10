import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionPanelLeftWidth,
  persistSessionPanelLeftWidth,
  readSessionPanelLeftWidth,
} from './panelLeftWidthSession.js';

/** @type {Record<string, string>} */
const sessionStore = {};

beforeEach(() => {
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  vi.stubGlobal('sessionStorage', {
    getItem: (key) => sessionStore[key] ?? null,
    setItem: (key, value) => {
      sessionStore[key] = String(value);
    },
    removeItem: (key) => {
      delete sessionStore[key];
    },
  });
});

describe('panelLeftWidthSession', () => {
  it('uid별로 sessionStorage에 저장·복원한다', () => {
    persistSessionPanelLeftWidth('user-a', 520);
    persistSessionPanelLeftWidth('user-b', 600);
    expect(readSessionPanelLeftWidth('user-a')).toBe(520);
    expect(readSessionPanelLeftWidth('user-b')).toBe(600);
  });

  it('로그아웃 시 해당 uid 폭을 지운다', () => {
    persistSessionPanelLeftWidth('user-a', 540);
    clearSessionPanelLeftWidth('user-a');
    expect(readSessionPanelLeftWidth('user-a')).toBeNull();
  });

  it('저장값이 없으면 null이다', () => {
    expect(readSessionPanelLeftWidth('user-a')).toBeNull();
  });
});
