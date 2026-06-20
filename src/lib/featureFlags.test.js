import { afterEach, describe, expect, it } from 'vitest';
import {
  isSpellingExportEnabled,
  isTocBodyCheckEnabled,
} from './featureFlags.js';

describe('featureFlags', () => {
  const prevDev = import.meta.env.DEV;
  const prevToc = import.meta.env.VITE_FEATURE_TOC_BODY_CHECK;
  const prevExport = import.meta.env.VITE_FEATURE_SPELLING_EXPORT;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = prevToc;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = prevExport;
  });

  it('dev에서는 목차·본문·엑셀 export가 켜진다', () => {
    import.meta.env.DEV = true;
    expect(isTocBodyCheckEnabled()).toBe(true);
    expect(isSpellingExportEnabled()).toBe(true);
  });

  it('프로덕션에서는 env 없으면 둘 다 꺼진다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_TOC_BODY_CHECK = undefined;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = undefined;
    expect(isTocBodyCheckEnabled()).toBe(false);
    expect(isSpellingExportEnabled()).toBe(false);
  });

  it('프로덕션 preview는 env로 켤 수 있다', () => {
    import.meta.env.DEV = false;
    import.meta.env.VITE_FEATURE_SPELLING_EXPORT = 'true';
    expect(isSpellingExportEnabled()).toBe(true);
  });
});
