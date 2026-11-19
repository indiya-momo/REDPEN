import { describe, expect, it } from 'vitest';
import verbForms from '../../public/data/stdict-verb-forms.json';
import {
  AEO_CONTRACTED_FRONTS,
  auxOnsetsForItem,
  enrichAuxiliaryNonAeoSpace,
  isAeoFrontAtEnd,
  isRetiredNonAeoAuxGroup,
  isWordBoundedTail,
  listAeoConnectiveFrontsFromSheet,
  clearAeoConnectiveFrontCache,
  nonAeoConnectiveAtEnd,
} from './auxiliaryNonAeoSpace.js';
import {
  BON_BOJO_NON_AEO_SPACE_ID,
  listBonBojoBundleDefinitions,
  BON_BOJO_UI_GROUP,
} from './bonBojoRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { setStdictVerbFormsForTests } from './stdictVerbForms.js';

describe('auxiliaryNonAeoSpace helpers', () => {
  it('닫힌 연결어미·아/어 축약 집합', () => {
    expect(nonAeoConnectiveAtEnd('뛰지')).toBe('지');
    expect(nonAeoConnectiveAtEnd('먹도록')).toBe('도록');
    expect(nonAeoConnectiveAtEnd('해')).toBe('');
    clearAeoConnectiveFrontCache();
    const aeo = listAeoConnectiveFrontsFromSheet();
    for (const f of AEO_CONTRACTED_FRONTS) expect(aeo.has(f)).toBe(true);
    expect(isAeoFrontAtEnd('해', aeo)).toBe(true);
    expect(isAeoFrontAtEnd('뛰', aeo)).toBe(false);
  });

  it('어절 경계', () => {
    // 뛰지|말라|.
    expect(isWordBoundedTail('뛰지말라.', 2, 4)).toBe(true);
    // 뛰지|말라|고 — 꼬리 뒤 한글
    expect(isWordBoundedTail('뛰지말라고', 2, 4)).toBe(false);
  });
});

describe('auxOnsetsForItem', () => {
  it('보다 항목 onset에 보', () => {
    expect(auxOnsetsForItem('verb-boda1')).toContain('보');
  });

  it('말다 onset에 말·마', () => {
    expect(auxOnsetsForItem('verb-malda')).toEqual(
      expect.arrayContaining(['말', '마']),
    );
  });
});

/** @param {string} matchedText @param {string} suggestedText */
function inst(matchedText, suggestedText = matchedText, index = 0) {
  return { find: 'x', replace: '$0', matchedText, suggestedText, pageNum: 1, index };
}

describe('enrichAuxiliaryNonAeoSpace — 비아/어는 본조 탭에서 뺀다(2026-11-19)', () => {
  it('붙여쓰기 가능 칸의 비아/어는 붙임·띄움 모두 빠지고 -아/-어·사전 단어는 남는다', async () => {
    setStdictVerbFormsForTests(verbForms);
    const group = {
      find: 'auxiliary-item:보다',
      replace: '$0',
      label: '(아/어) + 보다',
      groupDisplayLabel: '(아/어) + 보다',
      category: 'consistency',
      patternKind: 'auxiliary-verb',
      bonBojoItemId: 'verb-boda1',
      instances: [
        inst('먹다보니', '먹다 보니', 0),
        inst('먹다 보니', '먹다 보니', 10),
        inst('먹어보다', '먹어 보다', 20),
        inst('내다보다', '내다 보다', 30),
      ],
    };
    const out = await enrichAuxiliaryNonAeoSpace([group], [], { rules: [] });
    expect(out).toHaveLength(1);
    expect(out[0].instances.map((i) => i.matchedText)).toEqual([
      '먹어보다',
      '내다보다',
    ]);
    expect(out.some((g) => g.auxNonAeoSpace)).toBe(false);
  });

  it('말다 줄·옛 게이트 줄·옛 2차 생성 줄은 결과에서 뺀다', async () => {
    const malda = {
      find: '지 말',
      replace: '$0',
      label: '(-지/게/고) + 말다',
      category: 'consistency',
      patternKind: 'auxiliary-verb',
      bonBojoItemId: 'verb-malda',
      instances: [inst('뛰지말라', '뛰지 말라')],
    };
    const gate = {
      find: 'auxiliary:non-aeo:verb-non-aeo-space',
      replace: '$0',
      category: 'consistency',
      patternKind: 'auxiliary-verb',
      bonBojoItemId: BON_BOJO_NON_AEO_SPACE_ID,
      auxNonAeoSpace: true,
      instances: [inst('먹고봐', '먹고 봐')],
    };
    const other = { find: 'x', category: 'consistency', instances: [] };
    expect(isRetiredNonAeoAuxGroup(malda)).toBe(true);
    expect(isRetiredNonAeoAuxGroup(gate)).toBe(true);
    expect(isRetiredNonAeoAuxGroup(other)).toBe(false);
    const out = await enrichAuxiliaryNonAeoSpace([malda, gate, other], [], {
      rules: [],
    });
    expect(out).toEqual([other]);
  });
});

describe('본조 체크 목록에서 비아/어 줄 폐지', () => {
  it('체크 묶음에 띄어쓰기 필수(비아/어) 줄이 없다', () => {
    const ids = listBonBojoBundleDefinitions().map((b) => b.id);
    expect(ids).not.toContain(BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO);
  });

  it('옛 저장에서 말다·게이트를 켰어도 규칙은 꺼진다', () => {
    const on = ensureDefaultAuxiliaryVerbs([]).map((r) =>
      r.patternKind === 'auxiliary-verb' ? { ...r, enabled: true } : r,
    );
    const rules = ensureDefaultAuxiliaryVerbs(on);
    const retired = rules.filter(
      (r) =>
        r.bonBojoItemId === 'verb-malda' ||
        r.bonBojoItemId === BON_BOJO_NON_AEO_SPACE_ID,
    );
    expect(retired.length).toBeGreaterThan(0);
    expect(retired.every((r) => r.enabled === false)).toBe(true);
    expect(
      rules.some((r) => r.bonBojoItemId === 'verb-boda1' && r.enabled === true),
    ).toBe(true);
  });
});
