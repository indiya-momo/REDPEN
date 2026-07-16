import { describe, expect, it } from 'vitest';
import { buildProjectCardViewModelFromRuleSet } from '../../presentation/ruleSetProjectCard.js';
import {
  MOCK_PROJECT_RULE_SETS,
  applyMockProjectCriteria,
  buildMockProjectCards,
} from './mockProjectRuleSets.js';
import {
  isAuxiliaryVerbEntryEnabled,
  listAuxiliaryVerbEntries,
} from '../../lib/auxiliaryVerbRegister.js';
import { listPhraseSlotEntries } from '../../lib/phraseSlotRegister.js';

describe('MOCK_PROJECT_RULE_SETS', () => {
  it('proj-1 카드 건수와 본보조 체크리스트가 일치한다', () => {
    const set = MOCK_PROJECT_RULE_SETS.find((row) => row.id === 'proj-1');
    expect(set).toBeTruthy();

    const card = buildProjectCardViewModelFromRuleSet(set, { isActive: true });
    expect(card.counts.auxiliary).toBe(8);
    expect(card.counts.editorReview + card.counts.spelling).toBe(15);
    expect(card.counts.find).toBe(4);
    expect(card.counts.commonString).toBe(1);
    expect(listPhraseSlotEntries(set.customRules)).toHaveLength(1);

    const enabledAux = listAuxiliaryVerbEntries(set.customRules).filter(
      (entry) => isAuxiliaryVerbEntryEnabled(set.customRules, entry),
    );
    expect(enabledAux).toHaveLength(8);
  });

  it('카드는 RuleSet에서 파생된다', () => {
    const cards = buildMockProjectCards(MOCK_PROJECT_RULE_SETS, {
      activeId: 'proj-1',
      dirtyIds: new Set(['proj-1']),
    });
    // 만든/저장 시각 오름차순 — 목업 id는 set_ms 형식이 아니므로 savedAt 대체
    expect(cards.map((c) => c.id)).toEqual(['proj-3', 'proj-1']);
    const active = cards.find((c) => c.id === 'proj-1');
    expect(active?.title).toBe('검수냥 모모 이야기2');
    expect(active?.isActive).toBe(true);
    expect(active?.dirty).toBe(true);
    expect(active?.counts.auxiliary).toBe(8);
  });

  it('기준 패치 후 카드 건수가 갱신된다', () => {
    const next = applyMockProjectCriteria(MOCK_PROJECT_RULE_SETS, 'proj-3', {
      customRules: MOCK_PROJECT_RULE_SETS.find((set) => set.id === 'proj-3')
        .customRules.map((rule) =>
        rule.patternKind === 'auxiliary-verb' &&
        rule.bonBojoItemId === 'verb-itta'
          ? { ...rule, enabled: false }
          : rule,
      ),
    });
    const card = buildProjectCardViewModelFromRuleSet(
      next.find((set) => set.id === 'proj-3'),
    );
    expect(card.counts.auxiliary).toBe(2);
  });
});
