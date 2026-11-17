import { describe, expect, it } from 'vitest';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import {
  countAuxiliaryVerbBundlesActive,
  isAuxiliaryVerbBundleEnabled,
  listAuxiliaryVerbBundles,
  setAllAuxiliaryVerbBundles,
  toggleAuxiliaryVerbBundle,
} from './auxiliaryVerbRegister.js';
import { BON_BOJO_UI_GROUP } from './bonBojoRules.js';

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
});