import { describe, expect, it } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { getHighlightOverlayReplace } from './highlightOverlayReplace.js';
import {
  VERB_BOIDA_ITEM_ID,
  VERB_BOIDA_SPACING_CATEGORY,
  finalizeVerbBoidaSpacingGroups,
  isVerbBoidaItem,
  markVerbBoidaGroupsAsSpacing,
  verbBoidaRulesForSpacingCheck,
} from './verbBoidaSpacingFolder.js';

describe('verbBoidaSpacingFolder', () => {
  it('제47항이 켜져 있으면 보이다 규칙을 켠다(저장값이 꺼져 있어도)', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      isVerbBoidaItem(r) ? { ...r, enabled: false } : r,
    );
    const out = verbBoidaRulesForSpacingCheck(rules, { nonAeoAux: true });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.bonBojoItemId === VERB_BOIDA_ITEM_ID)).toBe(true);
    expect(out.every((r) => r.enabled === true)).toBe(true);
    expect(out.every((r) => r.category === VERB_BOIDA_SPACING_CATEGORY)).toBe(
      true,
    );
  });

  it('제47항이 꺼져 있으면 보이다 규칙을 넣지 않는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      isVerbBoidaItem(r) ? { ...r, enabled: true } : r,
    );
    expect(verbBoidaRulesForSpacingCheck(rules, { nonAeoAux: false })).toEqual(
      [],
    );
  });

  it('결과 그룹을 띄어쓰기 제47항 범주로 표시한다', () => {
    const groups = markVerbBoidaGroupsAsSpacing([
      {
        bonBojoItemId: VERB_BOIDA_ITEM_ID,
        patternKind: 'auxiliary-verb',
        category: 'consistency',
        instances: [],
      },
      {
        bonBojoItemId: 'verb-gada',
        patternKind: 'auxiliary-verb',
        category: 'consistency',
        instances: [],
      },
    ]);
    expect(groups[0].category).toBe(VERB_BOIDA_SPACING_CATEGORY);
    expect(groups[1].category).toBe('consistency');
  });

  it('제47항이 켜져 있으면 해보이는 → 해 보이는를 찾고 ∨을 쓴다', async () => {
    const rules = verbBoidaRulesForSpacingCheck([], { nonAeoAux: true });
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
    const groups = await finalizeVerbBoidaSpacingGroups(
      [],
      rules,
      [{ pageNum: 32, text: '자비롭기만 해보이는 약사여래' }],
      { analyze },
    );
    const hit = groups
      .flatMap((g) => (g.instances ?? []).map((inst) => ({ g, inst })))
      .find(({ inst }) => inst.matchedText === '해보이는');
    expect(hit?.inst.suggestedText).toBe('해 보이는');
    expect(hit?.g.category).toBe(VERB_BOIDA_SPACING_CATEGORY);
    expect(hit?.g.patternKind).toBe('auxiliary-verb');
    expect(hit?.g.bonBojoItemId).toBe(VERB_BOIDA_ITEM_ID);
    expect(getHighlightOverlayReplace(hit.inst, { group: hit.g })).toBe(
      '→해∨보이는',
    );
  });
});
