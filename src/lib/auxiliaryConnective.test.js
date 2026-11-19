import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { classifyConnectiveBeforeAux, isAeoRaReoHead } from './auxiliaryConnective.js';
import {
  collectNonAeoAuxCandidates,
  findNonAeoAuxSpacingHits,
} from './nonAeoAuxSpacing.js';

describe('auxiliaryConnective — 라/러 어절의 -아/-어 판정', () => {
  it('르 불규칙 -아/-어는 -아/-어로 본다 (잘라·얼러 포함)', () => {
    for (const head of ['잘라', '얼러', '골라', '흘러', '불러', '따라', '이르러']) {
      expect(isAeoRaReoHead(head), head).toBe(true);
    }
  });

  it('으 탈락 -라/-러는 비아/어로 본다', () => {
    for (const head of ['하라', '가라', '하러', '놀러', '먹으라', '먹으러']) {
      expect(isAeoRaReoHead(head), head).toBe(false);
    }
  });

});

describe('auxiliaryConnective — -려 + 하다·들다', () => {
  it('-려 뒤가 하다·들다면 비아/어, 다른 보조용언이면 -아/-어', () => {
    expect(classifyConnectiveBeforeAux('하려', 'verb-hada')).toBe('non-aeo');
    expect(classifyConnectiveBeforeAux('가려', 'verb-delda')).toBe('non-aeo');
    expect(classifyConnectiveBeforeAux('가려', 'verb-juda1')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('내려', 'verb-boda1')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('가려')).toBe('aeo');
    expect(classifyConnectiveBeforeAux('먹으려', 'verb-juda1')).toBe('non-aeo');
  });

  it('띄어쓰기 후보: 하려하다·먹으려들다는 잡고 가려주다·오려붙여보다는 안 잡는다', () => {
    const heads = (text) => collectNonAeoAuxCandidates(text).map((c) => c.suggestedText);
    expect(heads('그걸 하려하다')).toContain('하려 하다');
    expect(heads('자꾸 먹으려들다')).toContain('먹으려 들다');
    expect(heads('눈을 가려주다')).toEqual([]);
    expect(heads('종이를 오려붙여보다')).toEqual([]);
    expect(heads('하려 하다')).toEqual([]);
  });
});

describe('띄어쓰기 — -아서/-어서 + 보조용언(형태소 확인)', () => {
  it.skipIf(
    !fs.existsSync(
      new URL('../../tmp/kiwi-models/models/cong/base/cong.mdl', import.meta.url),
    ),
  )(
    '어미 어서/아서면 잡고, 서다 계열 + -어(일어서·나서)는 안 잡는다',
    async () => {
      const { loadKiwiNode } = await import('./kiwiMorph/loadNode.js');
      const { analyzeLine } = await import('./kiwiMorph/analyze.js');
      await loadKiwiNode({ register: true });
      const hit = (text) =>
        findNonAeoAuxSpacingHits(text, { requireDictionary: false, analyze: analyzeLine }).map(
          (h) => h.suggestedText,
        );
      expect(hit('밥을 먹어서보다')).toEqual(['먹어서 보다']);
      expect(hit('그걸 해서주다')).toEqual(['해서 주다']);
      expect(hit('의자에 앉아서보다')).toEqual(['앉아서 보다']);
      expect(hit('자리에서 일어서보다')).toEqual([]);
      expect(hit('앞에 나서주다')).toEqual([]);
      expect(hit('맞서보다')).toEqual([]);
    },
    120000,
  );
});