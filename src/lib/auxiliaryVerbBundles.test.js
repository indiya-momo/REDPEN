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
  it('3개 묶음·전체 on/off (비아/어 줄은 2026-11-19 띄어쓰기 폴더로 이관)', () => {
    const bundles = listAuxiliaryVerbBundles();
    expect(bundles).toHaveLength(3);
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

  it('비아/어 줄(말다·게이트)은 묶음에 없고 규칙은 항상 꺼짐', () => {
    const bundles = listAuxiliaryVerbBundles();
    expect(
      bundles.find((b) => b.bundleId === BON_BOJO_UI_GROUP.SPACE_REQUIRED_NON_AEO),
    ).toBeUndefined();
    const longSplit = bundles.find(
      (b) => b.bundleId === BON_BOJO_UI_GROUP.SPACE_REQUIRED,
    );
    expect(longSplit?.itemIds).toEqual([BON_BOJO_LONG_COMPOUND_SPLIT_ID]);
    expect(bundles.flatMap((b) => b.itemIds)).not.toContain('verb-boida');
    expect(bundles.flatMap((b) => b.itemIds)).not.toContain('verb-malda');
    expect(bundles.flatMap((b) => b.itemIds)).not.toContain(
      BON_BOJO_NON_AEO_SPACE_ID,
    );

    let rules = ensureDefaultAuxiliaryVerbs([]);
    const gate = rules.find((r) => r.bonBojoItemId === BON_BOJO_NON_AEO_SPACE_ID);
    expect(gate?.auxNonAeoGate).toBe(true);
    expect(gate?.enabled).toBe(false);

    rules = setAllAuxiliaryVerbBundles(rules, true);
    rules = ensureDefaultAuxiliaryVerbs(rules);
    expect(
      rules
        .filter(
          (r) =>
            r.bonBojoItemId === 'verb-malda' ||
            r.bonBojoItemId === BON_BOJO_NON_AEO_SPACE_ID,
        )
        .every((r) => r.enabled === false),
    ).toBe(true);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
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

  it('띄어쓰기 필수 칸은 3음절 복합어만으로 체크가 유지된다', () => {
    let rules = ensureDefaultAuxiliaryVerbs([]);
    rules = rules.map((r) =>
      r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
        ? { ...r, enabled: true }
        : { ...r, enabled: r.bonBojoItemId === 'verb-boida' ? false : r.enabled },
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
    rules = toggleAuxiliaryVerbBundle(
      rules,
      BON_BOJO_UI_GROUP.SPACE_REQUIRED,
      true,
    );
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
  });

  it('3음절 칸이 켜져 있어도 보이다는 제47항 칸 소속이라 재시드에서 같이 켜지지 않는다', () => {
    let rules = ensureDefaultAuxiliaryVerbs([])
      .filter((r) => r.bonBojoItemId !== 'verb-boida')
      .map((r) =>
        r.bonBojoItemId === BON_BOJO_LONG_COMPOUND_SPLIT_ID
          ? { ...r, enabled: true }
          : r,
      );
    rules = ensureDefaultAuxiliaryVerbs(rules);
    expect(
      isAuxiliaryVerbBundleEnabled(rules, BON_BOJO_UI_GROUP.SPACE_REQUIRED),
    ).toBe(true);
    const boida = rules.find((r) => r.bonBojoItemId === 'verb-boida');
    expect(boida?.enabled).toBe(false);
  });
});
