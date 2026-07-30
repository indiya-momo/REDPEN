import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JOSA_SLM_DEV_PROXY_PREFIX,
  resolveJosaSlmEndpoint,
} from './resolveEndpoint.js';

describe('resolveJosaSlmEndpoint', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opts.endpoint가 최우선', () => {
    expect(resolveJosaSlmEndpoint('http://custom/v1')).toBe('http://custom/v1');
  });

  it('VITE_UNIFY_JOSA_SLM_ENDPOINT가 두 번째', () => {
    vi.stubEnv('VITE_UNIFY_JOSA_SLM_ENDPOINT', 'http://127.0.0.1:9000/v1');
    vi.stubEnv('VITE_UNIFY_JOSA_SLM', 'true');
    vi.stubEnv('DEV', true);
    expect(resolveJosaSlmEndpoint()).toBe('http://127.0.0.1:9000/v1');
  });

  it('dev + 플래그 ON이면 프록시 prefix 기본', () => {
    vi.stubEnv('VITE_UNIFY_JOSA_SLM', 'true');
    vi.stubEnv('DEV', true);
    expect(resolveJosaSlmEndpoint()).toBe(JOSA_SLM_DEV_PROXY_PREFIX);
  });

  it('플래그 OFF면 빈 문자열', () => {
    vi.stubEnv('DEV', true);
    expect(resolveJosaSlmEndpoint()).toBe('');
  });
});
