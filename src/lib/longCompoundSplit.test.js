import { describe, expect, it } from 'vitest';
import { buildLongCompoundSplitRules } from './auxiliaryVerbPattern.js';
import { shouldSkipLongCompoundSplit } from './auxiliaryVerbMatchFilters.js';
import { runRuleCheck } from './ruleEngine.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { BON_BOJO_LONG_COMPOUND_SPLIT_ID } from './bonBojoRules.js';
import { listAuxiliaryVerbEntries } from './auxiliaryVerbRegister.js';
import { getHighlightOverlayReplace } from './highlightOverlayReplace.js';

const rule = {
  ...buildLongCompoundSplitRules(['져 주', '해 주', '어 보', '려 보'])[0],
  enabled: true,
  bonBojoItemId: BON_BOJO_LONG_COMPOUND_SPLIT_ID,
};

function hits(text) {
  const { results } = runRuleCheck([{ pageNum: 1, text }], [rule]);
  return results.flatMap((group) =>
    group.instances.map((inst) => [inst.matchedText, inst.suggestedText]),
  );
}

describe('3음절 이상 복합어 띄어쓰기', () => {
  it('어루만져주세요는 띄우고, 짧은 말과 이미 띄운 말은 두지 않는다', () => {
    expect(hits('어루만져주세요')).toEqual([
      ['어루만져주세요', '어루만져 주세요'],
    ]);
    expect(hits('만져주세요')).toEqual([]);
    expect(hits('어루만져 주세요')).toEqual([]);
    expect(hits('생각해 주세요')).toEqual([]);
  });

  it('생각해주세요는 띄운다', () => {
    expect(hits('생각해주세요')).toEqual([['생각해주세요', '생각해 주세요']]);
  });

  it('허용 목록의 깨트려·깨뜨려는 3음절 칸 1차에서 빼 둔다', () => {
    for (const matched of ['깨트려보았다', '깨뜨려보았다']) {
      const re = new RegExp(rule.find, 'gu');
      const m = re.exec(matched);
      expect(m?.[0], matched).toBe(matched);
      expect(shouldSkipLongCompoundSplit(rule, m), matched).toBe(true);
      expect(hits(matched), matched).toEqual([]);
    }
  });

  it('체크는 본용언 목록 맨 뒤에 있고 기본은 꺼져 있다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    const entries = listAuxiliaryVerbEntries(rules);
    expect(entries.at(-1)?.bonBojoItemId).toBe(BON_BOJO_LONG_COMPOUND_SPLIT_ID);
    expect(entries.at(-1)?.displayLabel).toBe(
      '본용언이 3음절 이상 복합어/파생어(띄어쓰기 필수)',
    );
    const row = rules.find(
      (r) => r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID,
    );
    expect(row?.enabled).toBe(false);
    expect(row?.auxSplitLongCompound).toBe(true);
    expect(row?.find).toBeTruthy();
  });

  it('연결 어미 -다가는 가다 보조로 보지 않는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
        ? { ...r, enabled: true }
        : { ...r, enabled: false },
    );
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '관람하다가 집에 갔다.' }],
      rules,
    );
    expect(results).toEqual([]);
  });

  it('시트로 켠 규칙도 어루만져주세요를 찾는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
        ? { ...r, enabled: true }
        : { ...r, enabled: false },
    );
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '어루만져주세요' }],
      rules,
    );
    expect(
      results.flatMap((g) =>
        (g.instances ?? []).map((i) => [i.matchedText, i.suggestedText]),
      ),
    ).toEqual([['어루만져주세요', '어루만져 주세요']]);
  });

  it('지다·하다 붙여 쓴 형태는 3음절 칸에서 띄우라고 하지 않는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
        ? { ...r, enabled: true }
        : { ...r, enabled: false },
    );
    for (const text of ['궁금해하다', '선명해집니다', '예뻐한다', '지워진다']) {
      const { results } = runRuleCheck([{ pageNum: 1, text }], rules);
      expect(results).toEqual([]);
    }
  });

  it('잘못 띄운 지다·하다는 붙여쓰기 필수 칸이 잡는다', () => {
    const rules = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      r.bonBojoItemId === 'verb-jida' || r.bonBojoItemId === 'verb-hada'
        ? { ...r, enabled: true }
        : { ...r, enabled: false },
    );
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: '예뻐 한다. 지워 진다.' }],
      rules,
    );
    const hits = results.flatMap((g) =>
      (g.instances ?? []).map((i) => [g.bonBojoItemId, i.matchedText]),
    );
    expect(hits).toEqual(
      expect.arrayContaining([
        ['verb-hada', '예뻐 한다'],
        ['verb-jida', '지워 진다'],
      ]),
    );
  });

  it('결과 하이라이트에 띄운 말을 올린다', () => {
    const { results } = runRuleCheck([{ pageNum: 1, text: '어루만져주세요' }], [
      rule,
    ]);
    const group = results[0];
    const inst = group.instances[0];
    expect(getHighlightOverlayReplace(inst, { group })).toBe(
      '→어루만져\u2228주세요',
    );
  });
});
