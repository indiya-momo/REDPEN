import { describe, expect, it } from 'vitest';
import {
  SPACING_FOLDER_BUNDLES,
  defaultSpacingFolderEnabled,
  getSpacingFolderBundle,
  isAnySpacingFolderEnabled,
  listEnabledSpacingModuleRefs,
  normalizeSpacingFolderEnabled,
  spacingCategoryForBundle,
} from './spacingFolderBundles.js';

describe('spacingFolderBundles', () => {
  it('defines bundles in spec order with expected moduleIds', () => {
    expect(SPACING_FOLDER_BUNDLES.map((b) => b.bundleId)).toEqual([
      'numberUnit',
      'dependentRieulKka',
      'punct',
      'nonAeoAux',
    ]);
    expect(getSpacingFolderBundle('numberUnit')?.moduleIds).toEqual([
      'numeral',
      'man-eok-jo',
      'digit-unit',
    ]);
    expect(getSpacingFolderBundle('dependentRieulKka')?.moduleIds).toEqual([
      'adnominal-dep',
      'n-ji',
      'n-ba',
      'rieul-kka',
    ]);
    expect(getSpacingFolderBundle('punct')?.moduleIds).toEqual(['punct']);
    expect(getSpacingFolderBundle('nonAeoAux')?.moduleIds).toEqual([
      'non-aeo-aux',
    ]);
  });

  it('defaults all bundles off except nonAeoAux (본조 탭에서 옮겨 옴)', () => {
    expect(defaultSpacingFolderEnabled()).toEqual({
      numberUnit: false,
      dependentRieulKka: false,
      punct: false,
      nonAeoAux: true,
    });
  });

  it('normalize ignores unknown keys and coerces non-boolean to the bundle default', () => {
    expect(
      normalizeSpacingFolderEnabled({
        numberUnit: true,
        dependentRieulKka: 'yes',
        futureKey: true,
      }),
    ).toEqual({
      numberUnit: true,
      dependentRieulKka: false,
      punct: false,
      nonAeoAux: true,
    });
    expect(normalizeSpacingFolderEnabled({ nonAeoAux: 'no' }).nonAeoAux).toBe(
      true,
    );
    expect(normalizeSpacingFolderEnabled({ nonAeoAux: false }).nonAeoAux).toBe(
      false,
    );
    expect(normalizeSpacingFolderEnabled(null)).toEqual(
      defaultSpacingFolderEnabled(),
    );
  });

  it('isAnySpacingFolderEnabled reflects known keys only', () => {
    // nonAeoAux는 기본 켜짐 — 끈 것만 false
    expect(isAnySpacingFolderEnabled({})).toBe(true);
    expect(isAnySpacingFolderEnabled({ nonAeoAux: false })).toBe(false);
    expect(isAnySpacingFolderEnabled({ numberUnit: true })).toBe(true);
    expect(
      isAnySpacingFolderEnabled({ futureKey: true, nonAeoAux: false }),
    ).toBe(false);
  });

  it('listEnabledSpacingModuleRefs expands in bundle then module order', () => {
    const refs = listEnabledSpacingModuleRefs({
      punct: true,
      numberUnit: true,
      dependentRieulKka: false,
      nonAeoAux: false,
    });
    expect(refs.map((r) => r.moduleId)).toEqual([
      'numeral',
      'man-eok-jo',
      'digit-unit',
      'punct',
    ]);
    expect(refs[0].bundleId).toBe('numberUnit');
    expect(refs[3].bundleId).toBe('punct');
  });

  it('spacingCategoryForBundle matches spacing:{bundleId}', () => {
    expect(spacingCategoryForBundle('dependentRieulKka')).toBe(
      'spacing:dependentRieulKka',
    );
  });
});
