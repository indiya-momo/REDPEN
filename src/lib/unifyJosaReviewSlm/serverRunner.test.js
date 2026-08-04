import { describe, expect, it, vi } from 'vitest';
import {
  extractAssistantContent,
  createServerRunner,
} from './runner/serverRunner.js';
import { buildJosaSlmUserMessage } from './prompt.js';

describe('extractAssistantContent', () => {
  it('OpenAI chat completion content를 읽는다', () => {
    expect(
      extractAssistantContent({
        choices: [{ message: { content: '{"id":"a","isBoundary":true}' } }],
      }),
    ).toContain('isBoundary');
  });
});

describe('buildJosaSlmUserMessage', () => {
  it('맥락 필드를 포함한다', () => {
    const msg = buildJosaSlmUserMessage(
      {
        id: '역학은',
        variant: '역학 은',
        gluedVariant: '역학은',
        ruleStem: '역학',
        ruleSuffix: '은',
      },
      { contextBefore: '양자', contextAfter: '은 물리' },
    );
    expect(msg).toContain('contextBefore="양자"');
    expect(msg).toContain('id="역학은"');
  });
});

describe('createServerRunner', () => {
  it('endpoint 없으면 uncertain fallback', async () => {
    const runner = createServerRunner({ endpoint: '' });
    const [result] = await runner.reviewBatch([
      {
        id: '역학은',
        variant: '역학 은',
        gluedVariant: '역학은',
        ruleStem: '역학',
        ruleSuffix: '은',
      },
    ]);
    expect(result.kind).toBe('uncertain');
    expect(result.confidence).toBe('low');
  });

  it('HTTP 응답 JSON을 파싱한다', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes('/models')) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"id":"역학은","isBoundary":true,"kind":"josa_or_suffix","confidence":"high"}',
              },
            },
          ],
        }),
      };
    });
    const runner = createServerRunner({
      endpoint: 'http://127.0.0.1:8000/v1',
      fetchImpl,
    });
    const [result] = await runner.reviewBatch([
      {
        id: '역학은',
        variant: '역학 은',
        gluedVariant: '역학은',
        ruleStem: '역학',
        ruleSuffix: '은',
      },
    ]);
    expect(result.kind).toBe('josa_or_suffix');
    expect(result.confidence).toBe('high');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('서버 ping 실패 시 전 항목 uncertain fallback (긴 timeout 회피)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect refused');
    });
    const runner = createServerRunner({
      endpoint: 'http://127.0.0.1:8000/v1',
      fetchImpl,
      timeoutMs: 180_000,
    });
    const results = await runner.reviewBatch([
      {
        id: '역학은',
        variant: '역학 은',
        gluedVariant: '역학은',
        ruleStem: '역학',
        ruleSuffix: '은',
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('uncertain');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
