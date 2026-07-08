/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeReturnToMainWorkspace,
  markReturnToMainWorkspace,
  returnToWorkspace,
  shouldReopenMainWorkspace,
} from './returnToWorkspace.js';

describe('returnToMainWorkspace flags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mark 후 should/consume로 메인 복귀 플래그를 다룬다', () => {
    expect(shouldReopenMainWorkspace()).toBe(false);
    markReturnToMainWorkspace();
    expect(shouldReopenMainWorkspace()).toBe(true);
    expect(consumeReturnToMainWorkspace()).toBe(true);
    expect(shouldReopenMainWorkspace()).toBe(false);
    expect(consumeReturnToMainWorkspace()).toBe(false);
  });
});

describe('returnToWorkspace', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let replaceMock;

  beforeEach(() => {
    replaceMock = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      replace: replaceMock,
      origin: 'http://127.0.0.1:5173',
      href: 'http://127.0.0.1:5173/?window=mypage',
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('opener 없을 때 close 없이 메인 URL로 replace한다', () => {
    vi.stubGlobal('opener', null);
    vi.stubGlobal('close', vi.fn());

    returnToWorkspace();

    expect(shouldReopenMainWorkspace()).toBe(true);
    expect(replaceMock).toHaveBeenCalledWith('http://127.0.0.1:5173/');
    expect(window.close).not.toHaveBeenCalled();
  });

  it('opener가 살아 있으면 focus·close 후, 닫히지 않으면 replace로 폴백한다', () => {
    vi.useFakeTimers();
    const focusMock = vi.fn();
    const closeMock = vi.fn();
    vi.stubGlobal('opener', { closed: false, focus: focusMock });
    vi.stubGlobal('close', closeMock);

    returnToWorkspace();

    expect(shouldReopenMainWorkspace()).toBe(true);
    expect(focusMock).toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(replaceMock).toHaveBeenCalledWith('http://127.0.0.1:5173/');
  });

  it('opener가 닫혀 있으면 popup close 없이 replace만 한다', () => {
    vi.stubGlobal('opener', { closed: true, focus: vi.fn() });
    vi.stubGlobal('close', vi.fn());

    returnToWorkspace();

    expect(replaceMock).toHaveBeenCalledWith('http://127.0.0.1:5173/');
    expect(window.close).not.toHaveBeenCalled();
  });
});
