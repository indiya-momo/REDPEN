import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearStdictLinkIndexCache,
  ensureStdictLinkIndexLoaded,
  getStdictLinkIndex,
} from './stdictLinkIndex.js';

/** @param {{ ok: boolean, json?: () => unknown }} res */
function fakeFetch(res, calls = []) {
  return async (url) => {
    calls.push(url);
    return res;
  };
}

describe('표준국어대사전 색인 로더', () => {
  beforeEach(() => {
    clearStdictLinkIndexCache();
  });

  it('성공하면 entries를 돌려주고 캐시한다(두 번째 호출은 fetch하지 않음)', async () => {
    const calls = [];
    const fetchImpl = fakeFetch(
      { ok: true, json: () => ({ entries: { 가닿: [1848] } }) },
      calls,
    );
    const first = await ensureStdictLinkIndexLoaded({ fetchImpl });
    expect(first).toEqual({ 가닿: [1848] });
    expect(getStdictLinkIndex()).toEqual({ 가닿: [1848] });

    const second = await ensureStdictLinkIndexLoaded({ fetchImpl });
    expect(second).toEqual({ 가닿: [1848] });
    expect(calls).toEqual(['/data/stdict-link-index.json']);
  });

  it('HTTP 실패면 null을 돌려주고 캐시하지 않아, 다음 호출에서 다시 읽는다', async () => {
    const calls = [];
    const fetchImpl = fakeFetch({ ok: false }, calls);
    expect(await ensureStdictLinkIndexLoaded({ fetchImpl })).toBeNull();
    expect(getStdictLinkIndex()).toBeNull();

    expect(await ensureStdictLinkIndexLoaded({ fetchImpl })).toBeNull();
    expect(calls.length).toBe(2);
  });

  it('네트워크 예외면 null을 돌려주고 캐시하지 않는다', async () => {
    let count = 0;
    const fetchImpl = async () => {
      count += 1;
      if (count === 1) throw new Error('offline');
      return { ok: true, json: () => ({ entries: { 맞닿: [112711] } }) };
    };
    expect(await ensureStdictLinkIndexLoaded({ fetchImpl })).toBeNull();
    expect(await ensureStdictLinkIndexLoaded({ fetchImpl })).toEqual({
      맞닿: [112711],
    });
  });

  it('형식이 맞지 않으면(entries 없음) 실패로 보고 캐시하지 않는다', async () => {
    const fetchImpl = fakeFetch({ ok: true, json: () => ({ count: 0 }) });
    expect(await ensureStdictLinkIndexLoaded({ fetchImpl })).toBeNull();
    expect(getStdictLinkIndex()).toBeNull();
  });

  it('같은 시점의 동시 호출은 fetch를 한 번만 한다', async () => {
    const calls = [];
    const fetchImpl = fakeFetch(
      { ok: true, json: () => ({ entries: { 참고삼: [487509] } }) },
      calls,
    );
    const [a, b] = await Promise.all([
      ensureStdictLinkIndexLoaded({ fetchImpl }),
      ensureStdictLinkIndexLoaded({ fetchImpl }),
    ]);
    expect(a).toEqual(b);
    expect(calls.length).toBe(1);
  });
});
