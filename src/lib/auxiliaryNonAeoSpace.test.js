import { describe, expect, it, vi } from 'vitest';
import {
  AEO_CONTRACTED_FRONTS,
  auxOnsetsForItem,
  collectNonAeoGluedHits,
  enrichAuxiliaryNonAeoSpace,
  isAeoFrontAtEnd,
  isNonAeoSpaceGateEnabled,
  isWordBoundedTail,
  listAeoConnectiveFrontsFromSheet,
  clearAeoConnectiveFrontCache,
  nonAeoConnectiveAtEnd,
  enabledAuxItemIdsForNonAeo,
} from './auxiliaryNonAeoSpace.js';
import { BON_BOJO_NON_AEO_SPACE_ID } from './bonBojoRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { toggleAuxiliaryVerbBundle } from './auxiliaryVerbRegister.js';
import { BON_BOJO_UI_GROUP } from './bonBojoRules.js';

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

describe('collectNonAeoGluedHits', () => {
  it('고+보 붙임은 잡고 해봐·공부하다는 안 잡음', () => {
    const hits = collectNonAeoGluedHits('한번먹고봐 해봐 공부하다', 'verb-boda1');
    expect(hits.some((h) => h.matchedText.includes('먹고봐'))).toBe(true);
    expect(hits.every((h) => !h.matchedText.includes('공부'))).toBe(true);
    expect(hits.every((h) => h.matchedText !== '해봐')).toBe(true);
  });
});

describe('enrichAuxiliaryNonAeoSpace', () => {
  it('게이트 off면 그대로', async () => {
    const rules = ensureDefaultAuxiliaryVerbs([]);
    expect(isNonAeoSpaceGateEnabled(rules)).toBe(false);
    const groups = [{ find: 'x', instances: [], patternKind: 'auxiliary-verb' }];
    const out = await enrichAuxiliaryNonAeoSpace(groups, [{ pageNum: 1, text: '뛰지마라' }], {
      rules,
    });
    expect(out).toEqual(groups);
  });

  it('게이트 on + 켠 보다 — 고+보 붙임(먹고봐)', async () => {
    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO,
      true,
    );
    rules = toggleAuxiliaryVerbBundle(rules, BON_BOJO_UI_GROUP.GLUE_OPTIONAL, true);
    expect(isNonAeoSpaceGateEnabled(rules)).toBe(true);
    expect(enabledAuxItemIdsForNonAeo(rules)).toContain('verb-boda1');

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ channel: '', item: [] }),
    }));
    const out = await enrichAuxiliaryNonAeoSpace(
      [],
      [{ pageNum: 1, text: '한번먹고봐' }],
      { rules, fetchImpl },
    );
    const nonAeo = out.filter((g) => g.auxNonAeoSpace);
    expect(nonAeo.length).toBeGreaterThan(0);
    const inst = nonAeo[0].instances[0];
    expect(inst.matchedText).toContain('먹고봐');
    expect(inst.suggestedText).toContain(' ');
    expect(inst.suggestedText.replace(/\s+/g, '')).toBe(
      inst.matchedText.replace(/\s+/g, ''),
    );
  });

  it('공부하다·해봐는 후보에 안 넣음', async () => {
    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO,
      true,
    );
    rules = toggleAuxiliaryVerbBundle(rules, BON_BOJO_UI_GROUP.GLUE_REQUIRED, true);
    rules = toggleAuxiliaryVerbBundle(rules, BON_BOJO_UI_GROUP.GLUE_OPTIONAL, true);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ channel: '', item: [] }),
    }));
    const out = await enrichAuxiliaryNonAeoSpace(
      [],
      [{ pageNum: 1, text: '공부하다 해봐 줘봐' }],
      { rules, fetchImpl },
    );
    expect(out.filter((g) => g.auxNonAeoSpace)).toEqual([]);
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

describe('말다 non-aeo', () => {
  it('게이트+말다 on이면 뛰지말라를 띄움 필수로 잡는다', async () => {
    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO,
      true,
    );
    expect(enabledAuxItemIdsForNonAeo(rules)).toContain('verb-malda');

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ channel: '', item: [] }),
    }));
    const out = await enrichAuxiliaryNonAeoSpace(
      [],
      [{ pageNum: 1, text: '여기서는뛰지말라' }],
      { rules, fetchImpl },
    );
    const nonAeo = out.filter((g) => g.auxNonAeoSpace);
    expect(nonAeo.length).toBeGreaterThan(0);
    const inst = nonAeo.flatMap((g) => g.instances).find((i) =>
      String(i.matchedText).includes('뛰지말'),
    );
    expect(inst).toBeTruthy();
    expect(inst.suggestedText).toContain(' ');
    expect(inst.suggestedText.replace(/\s+/g, '')).toBe(
      inst.matchedText.replace(/\s+/g, ''),
    );
  });
});
