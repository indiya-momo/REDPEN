import { describe, expect, it } from 'vitest';
import { nextVersion, shouldSkipVersionBump } from './bumpVersion.js';

describe('nextVersion', () => {
  it('0.001씩 올린다', () => {
    expect(nextVersion('0.75')).toBe('0.751');
    expect(nextVersion('0.90')).toBe('0.901');
    expect(nextVersion('0.901')).toBe('0.902');
    expect(nextVersion('0.999')).toBe('1.000');
  });
});

describe('shouldSkipVersionBump', () => {
  it('CI에서는 건너뛴다', () => {
    expect(
      shouldSkipVersionBump({ GITHUB_ACTIONS: 'true' }, ['src/foo.js']),
    ).toBe(true);
  });

  it('docs/만 스테이징되면 건너뛴다', () => {
    expect(
      shouldSkipVersionBump({}, ['docs/index.html', 'docs/assets/x.js']),
    ).toBe(true);
  });

  it('소스 변경이 있으면 버전을 올린다', () => {
    expect(shouldSkipVersionBump({}, ['src/foo.js'])).toBe(false);
    expect(shouldSkipVersionBump({}, ['docs/x', 'package.json'])).toBe(false);
  });

  it('SKIP_VERSION_BUMP=1이면 건너뛴다', () => {
    expect(
      shouldSkipVersionBump({ SKIP_VERSION_BUMP: '1' }, ['src/foo.js']),
    ).toBe(true);
  });
});
