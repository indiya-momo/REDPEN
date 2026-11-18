import { describe, expect, it } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import {
  countAuxiliaryVerbBundlesActive,
  isAuxiliaryVerbBundleEnabled,
  listAuxiliaryVerbBundles,
  setAllAuxiliaryVerbBundles,
  toggleAuxiliaryVerbBundle,
} from './auxiliaryVerbRegister.js';
import {
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_NON_AEO_SPACE_ID,
  BON_BOJO_UI_GROUP,
} from './bonBojoRules.js';

describe('auxiliaryVerbBundles', () => {
  it('4개 묶음·전체 on/off', () => {
    const bundles = listAuxiliaryVerbBundles();
    expect(bundles).toHaveLength(4);
    expect(bundles[0].bundleId).toBe(BON_BOJO_UI_GROUP.GLUE_OPTIONAL);
    expect(bundles[0].itemIds.length).toBeGreaterThan(10);

    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = setAllAuxiliaryVerbBundles(rules, false);
    expect(countAuxiliaryVerbBundlesActive(rules)).toBe(0);

    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.GLUE_REQUIRED,
      true,
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.GLUE_REQUIRED),
    ).toBe(true);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.GLUE_OPTIONAL),
    ).toBe(false);
  });

  it('non-aeo 줄은 전용 게이트 item만 — 3음절과 분리·기본 off', () => {
    const bundles = listAuxiliaryVerbBundles();
    const nonAeo = bundles.find(
      (b) => b.bundleId === BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO,
    );
    const longSplit = bundles.find(
      (b) => b.bundleId === BON_BOJO_UI_GROUP.SPACE_REQUIRED,
    );
    expect(nonAeo?.itemIds).toEqual([
      'verb-malda',
      BON_BOJO_NON_AEO_SPACE_ID,
    ]);
    expect(longSplit?.itemIds).toEqual([
      'verb-boida',
      BON_BOJO_LONG_COMPOUND_SPLIT_ID,
    ]);

    let rules = ensureDefaultAuxiliaryVerbs([]);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO),
    ).toBe(false);

    const gate = rules.find((r) => r.bonBojoItemId === BON_BOJO_NON_AEO_SPACE_ID);
    expect(gate?.auxNonAeoGate).toBe(true);
    expect(gate?.enabled).toBe(false);

    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO,
      true,
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO),
    ).toBe(true);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(false);

    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED,
      true,
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO),
    ).toBe(true);
  });

  it('옛 저장에 게이트 id 없으면 non-aeo는 off 유지(마이그레이션)', () => {
    const withoutGate = ensureDefaultAuxiliaryVerbs([])
      .filter((r) => r.bonBojoItemId !== BON_BOJO_NON_AEO_SPACE_ID)
      .map((r) =>
        r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID ||
        r.bonBojoItemId === 'verb-boida'
          ? { ...r, enabled: true }
          : r,
      );
    const rules = ensureDefaultAuxiliaryVerbs(withoutGate);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO),
    ).toBe(false);
  });

  it('띄어쓰기 필수 칸은 3음절·보이다를 같이 켜야 체크가 유지된다', () => {
    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = rules.map((r) =>
      r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
        ? { ...r, enabled: true }
        : r,
    );
    // 보이다만 꺼져 있으면 마스터 체크는 꺼진 것으로 본다
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(false);
    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED,
      true,
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
    rules = ensureDefaultAuxiliaryVerbs(rules);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
  });

  it('묶음이 켜진 채 새 item이 생기면 형제도 켜서 마스터 체크를 유지한다', () => {
    let rules = ensureDefaultAuxiliaryVerbs([])
      .filter((r) => r.bonBojoItemId !== 'verb-boida')
      .map((r) =>
        r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
          ? { ...r, enabled: true }
          : r,
      );
    // 보이다 규칙이 아직 없을 때 3음절만 on → 재시드 후 보이다도 on
    rules = ensureDefaultAuxiliaryVerbs(rules);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
  });
});
