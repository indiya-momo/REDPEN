import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { enrichAuxiliaryGluedFromSpaced } from './auxiliaryGluedFromSpaced.js';

/** 테스트용 — 표면을 용언으로 인정 (실 Kiwi 없이 glue 경로 검증) */
function confirmAll(text) {
  const t = String(text ?? '');
  if (!t) return null;
  return { tokens: [{ str: t, tag: 'VV' }] };
}

function gadaRule() {
  const row = buildAuxiliaryVerbFindRules('아 가')[0];
  return {
    ...row,
    enabled: true,
    bonBojoItemId: 'verb-gada',
    label: '(아/어) + 가다',
  };
}

describe('enrichAuxiliaryGluedFromSpaced', () => {
  it('같은 stem 규칙으로 붙임 표면을 검사 건으로 보강한다', async () => {
    const groups = [
      {
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-gada',
        label: '(아/어) + 가다',
        instances: [
          {
            find: 'f',
            replace: '$0',
            matchedText: '살아 가는',
            suggestedText: '살아 가는',
            pageNum: 1,
            index: 0,
          },
        ],
      },
    ];
    const pages = [
      { pageNum: 1, text: '살아 가는 길' },
      { pageNum: 2, text: '함께 살아가는 사람들' },
    ];
    const next = await enrichAuxiliaryGluedFromSpaced(groups, pages, {
      rules: [gadaRule()],
      analyze: confirmAll,
    });
    const texts = next[0].instances.map((i) => i.matchedText);
    expect(texts).toContain('살아 가는');
    expect(texts).toContain('살아가는');
    const glued = next[0].instances.find((i) => i.matchedText === '살아가는');
    expect(glued?.pageNum).toBe(2);
    expect(glued?.suggestedText).toBe('살아 가는');
  });

  it('띄움 매치가 없어도 붙임만 있으면 그룹을 만든다', async () => {
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 2, text: '함께 살아가는 사람들' }],
      {
        rules: [gadaRule()],
        analyze: confirmAll,
      },
    );
    expect(next).toHaveLength(1);
    expect(next[0].instances.map((i) => i.matchedText)).toEqual(['살아가는']);
    expect(next[0].instances[0].suggestedText).toBe('살아 가는');
  });

  it('아 들·라 들 — 형태소가 복수·명사면 버리고 녹아들어·빠져들어는 유지', async () => {
    const aDeul = {
      ...buildAuxiliaryVerbFindRules('아 들')[0],
      enabled: true,
      bonBojoItemId: 'verb-delda',
      label: '(아/어) + 들다',
    };
    const raDeul = {
      ...buildAuxiliaryVerbFindRules('라 들')[0],
      enabled: true,
      bonBojoItemId: 'verb-delda',
      label: '(아/어) + 들다',
    };
    const jeoDeul = {
      ...buildAuxiliaryVerbFindRules('져 들')[0],
      enabled: true,
      bonBojoItemId: 'verb-delda',
      label: '(아/어) + 들다',
    };
    const pages = [
      {
        pageNum: 1,
        text: '아들아 아들딸에게 나라들과 녹아들어 마음 빠져들어',
      },
    ];
    const analyze = (text) => {
      /** @type {Record<string, { surface1to1: true, tokens: { str: string, tag: string, position: number, length: number }[] }>} */
      const table = {
        아들아: {
          surface1to1: true,
          tokens: [
            { str: '아들', tag: 'NNG', position: 0, length: 2 },
            { str: '아', tag: 'JKV', position: 2, length: 1 },
          ],
        },
        아들딸에게: {
          surface1to1: true,
          tokens: [
            { str: '아들', tag: 'NNG', position: 0, length: 2 },
            { str: '딸', tag: 'NNG', position: 2, length: 1 },
            { str: '에게', tag: 'JKB', position: 3, length: 2 },
          ],
        },
        나라들과: {
          surface1to1: true,
          tokens: [
            { str: '나라', tag: 'NNG', position: 0, length: 2 },
            { str: '들', tag: 'XSN', position: 2, length: 1 },
            { str: '과', tag: 'JC', position: 3, length: 1 },
          ],
        },
        녹아들어: {
          surface1to1: true,
          tokens: [
            { str: '녹', tag: 'VV', position: 0, length: 1 },
            { str: '아', tag: 'EC', position: 1, length: 1 },
            { str: '들', tag: 'VX', position: 2, length: 1 },
            { str: '어', tag: 'EC', position: 3, length: 1 },
          ],
        },
        빠져들어: {
          surface1to1: true,
          tokens: [
            { str: '빠지', tag: 'VV', position: 0, length: 2 },
            { str: '어', tag: 'EC', position: 2, length: 1 },
            { str: '들', tag: 'VX', position: 3, length: 1 },
            { str: '어', tag: 'EC', position: 4, length: 1 },
          ],
        },
      };
      return table[text] ?? null;
    };
    const next = await enrichAuxiliaryGluedFromSpaced([], pages, {
      rules: [aDeul, raDeul, jeoDeul],
      analyze,
    });
    const texts = next.flatMap((g) =>
      (g.instances ?? []).map((i) => i.matchedText),
    );
    expect(texts).not.toContain('아들아');
    expect(texts.some((t) => t.includes('아들딸'))).toBe(false);
    expect(texts.some((t) => t.includes('나라들'))).toBe(false);
    expect(texts).toContain('녹아들어');
    expect(texts).toContain('빠져들어');
  });

  it('해보이는 → 보이다 줄에서 해 보이는 띄움 제안', async () => {
    const row = buildAuxiliaryVerbFindRules('해 보이')[0];
    const rule = {
      ...row,
      enabled: true,
      bonBojoItemId: 'verb-boida',
      label: '(아/어) + 보이다',
    };
    const analyze = (text) =>
      text === '해보이는'
        ? {
            tokens: [
              { str: '하', tag: 'VV' },
              { str: '어', tag: 'EC' },
              { str: '보이', tag: 'VV' },
              { str: '는', tag: 'ETM' },
            ],
          }
        : null;
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 32, text: '자비롭기만 해보이는 약사여래' }],
      { rules: [rule], analyze },
    );
    const hit = next[0]?.instances?.find((i) => i.matchedText.includes('해보'));
    expect(hit?.matchedText).toBe('해보이는');
    expect(hit?.suggestedText).toBe('해 보이는');
  });

  it('두다 줄은 어두운 붙임을 올리지 않는다', async () => {
    const row = buildAuxiliaryVerbFindRules('어 두')[0];
    const rule = {
      ...row,
      enabled: true,
      bonBojoItemId: 'verb-duda',
      label: '(아/어) + 두다',
    };
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [
        {
          pageNum: 1,
          text: '어두운 전시실에 적어 두고 적어두고 메모',
        },
      ],
      { rules: [rule], analyze: confirmAll },
    );
    const texts = (next[0]?.instances ?? []).map((i) => i.matchedText);
    expect(texts).not.toContain('어두운');
    expect(texts).toContain('적어두고');
  });

  it('보다 줄은 해보이는 붙임을 올리지 않는다', async () => {
    const row = buildAuxiliaryVerbFindRules('해 보')[0];
    const rule = {
      ...row,
      enabled: true,
      bonBojoItemId: 'verb-boda1',
      label: '(아/어) + 보다',
    };
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 32, text: '자비롭기만 해보이는 약사여래' }],
      { rules: [rule], analyze: confirmAll },
    );
    expect(next).toHaveLength(0);
  });

  it('다른 글자 안의 짧은 부분일치는 올리지 않는다', async () => {
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 2, text: '가격은 달러가 기준이다' }],
      { rules: [gadaRule()], analyze: confirmAll },
    );
    expect(next).toHaveLength(0);
  });

  it('라 가 — 명사+조사 신라가는 용언 미확인으로 버리고 살아가는은 남긴다', async () => {
    const raGa = {
      ...buildAuxiliaryVerbFindRules('라 가')[0],
      enabled: true,
      bonBojoItemId: 'verb-gada',
      label: '(아/어) + 가다',
    };
    const aGa = gadaRule();
    const analyze = (text) => {
      if (text === '신라가') {
        return {
          tokens: [
            { str: '신라', tag: 'NNP' },
            { str: '가', tag: 'JKS' },
          ],
        };
      }
      if (text === '살아가는') {
        return {
          tokens: [
            { str: '살아가', tag: 'VV' },
            { str: '는', tag: 'ETM' },
          ],
        };
      }
      return null;
    };
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 1, text: '신라가 망하고 함께 살아가는 길' }],
      { rules: [raGa, aGa], analyze },
    );
    const texts = next.flatMap((g) =>
      (g.instances ?? []).map((i) => i.matchedText),
    );
    expect(texts).not.toContain('신라가');
    expect(texts).toContain('살아가는');
  });

  it('이미 가까운 index면 중복 추가하지 않는다', async () => {
    const groups = [
      {
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-gada',
        instances: [
          {
            matchedText: '살아가는',
            suggestedText: '살아가는',
            pageNum: 2,
            index: 3,
          },
        ],
      },
    ];
    const pages = [{ pageNum: 2, text: '함께 살아가는 사람들' }];
    const next = await enrichAuxiliaryGluedFromSpaced(groups, pages, {
      rules: [gadaRule()],
      analyze: confirmAll,
    });
    expect(next[0].instances).toHaveLength(1);
  });

  it('긴복합 분리 규칙은 붙임 보강에 쓰지 않는다', async () => {
    const rule = {
      ...gadaRule(),
      auxSplitLongCompound: true,
    };
    const next = await enrichAuxiliaryGluedFromSpaced(
      [],
      [{ pageNum: 1, text: '살아가는' }],
      { rules: [rule], analyze: confirmAll },
    );
    expect(next).toHaveLength(0);
  });
});
