import { describe, it, expect } from 'vitest';
import { runRuleCheck } from './ruleEngine.js';
import { correctionPairsOfGroup, isDictBundleGroup } from './stdictLinkPairs.js';
import { formatVariantPairsLabel } from './spellingFindReplaces.js';

/** 실제 규칙 엔진을 돌린 결과 카드에서, 쌍이 카드 문구(찾은 말 → 고칠 말)와 같은지 확인 */
describe('규칙 엔진 결과 카드 ↔ 표준국어대사전 쌍', () => {
  it('변형(findReplaces) 묶음: 쌍이 카드 라벨과 같다', () => {
    const rule = {
      find: '그 중',
      replace: '그중',
      pattern: 'literal',
      enabled: true,
      category: 'spelling',
      spellingRuleId: 'test-geu-jung',
      dividerLabel: '표준국어대사전 등재(명사)',
      finds: ['그 중', '도 중'],
      findReplaces: { '그 중': '그중', '도 중': '도중' },
    };
    const pages = [{ pageNum: 1, text: '그 중 하나와 도 중 하나.' }];
    const { results, errors } = runRuleCheck(pages, [rule]);
    expect(errors ?? []).toEqual([]);

    const group = results.find((g) => isDictBundleGroup(g));
    expect(group).toBeTruthy();

    const pairs = correctionPairsOfGroup(group);
    expect(pairs.map((p) => p.find).sort()).toEqual(['그 중', '도 중']);
    expect(pairs.find((p) => p.find === '도 중')?.replace).toBe('도중');

    // 카드 문구와 같은 쌍 목록
    const cardLabel = formatVariantPairsLabel(group.instances);
    const fromPairs = pairs.map((p) => `${p.find} → ${p.replace}`).join(', ');
    expect(cardLabel.split(', ').sort()).toEqual(fromPairs.split(', ').sort());
  });
});
