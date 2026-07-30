#!/usr/bin/env node
/**
 * §13 수동 검증용 mock 추론 서버 (OpenAI 호환).
 * 실 SLM 없이 serverRunner·Vite 프록시 연동만 확인할 때 사용.
 *
 *   node scripts/josa-slm-mock-vllm.mjs
 */
import http from 'node:http';

const PORT = Number(process.env.JOSA_SLM_MOCK_PORT || 8000);
const HOST = process.env.JOSA_SLM_MOCK_HOST || '127.0.0.1';

/**
 * @param {string} userMsg
 * @returns {object}
 */
function mockSlmResult(userMsg) {
  const idMatch = userMsg.match(/id="([^"]+)"/);
  const id = idMatch?.[1] || 'unknown';
  const hasContext =
    /contextBefore="[^"]+"/.test(userMsg) || /contextAfter="[^"]+"/.test(userMsg);

  if (id.includes('가치평가')) {
    return {
      id,
      isBoundary: false,
      kind: 'compound_word',
      confidence: 'high',
      reason: 'mock-compound',
    };
  }
  if (id.includes('지속')) {
    return {
      id,
      isBoundary: true,
      kind: 'uncertain',
      confidence: 'high',
      reason: 'mock-uncertain',
    };
  }

  return {
    id,
    isBoundary: true,
    kind: 'josa_or_suffix',
    confidence: 'high',
    reason: hasContext ? 'mock-with-context' : 'mock-no-context',
  };
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '';

  if (req.method === 'GET' && url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        object: 'list',
        data: [{ id: 'kakaocorp/kanana-2-1.3b-instruct-mock' }],
      }),
    );
    return;
  }

  if (req.method === 'POST' && url === '/v1/chat/completions') {
    let body = '';
    for await (const chunk of req) body += chunk;
    /** @type {{ messages?: { role: string, content: string }[] }} */
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('bad json');
      return;
    }
    const userMsg =
      parsed.messages?.find((m) => m.role === 'user')?.content ?? '';
    const result = mockSlmResult(userMsg);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
    );
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log(`[josa-slm-mock] http://${HOST}:${PORT}/v1 (Ctrl+C 종료)`);
});
