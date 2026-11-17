import { describe, expect, it } from 'vitest';
import {
  bonVerbAllowForItemId,
  bonBojoRulesFingerprint,
  replaceBonBojoRulesData,
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
  BON_BOJO_UI_GROUP,
  bonBojoUiGroupForItemId,
} from './bonBojoRules.js';
import bonBojoJson from '../data/bon-bojo-rules.json';

describe('bonBojoUiGroupForItemId', () => {
  it('3그룹 UI 분류', () => {
    expect(bonBojoUiGroupForItemId('verb-gada')).toBe(
      BON_BOJO_UI_GROUP.GLUE_OPTIONAL,
    );
    expect(bonBojoUiGroupForItemId('verb-jida')).toBe(
      BON_BOJO_UI_GROUP.GLUE_REQUIRED,
    );
    expect(bonBojoUiGroupForItemId('verb-hada')).toBe(
      BON_BOJO_UI_GROUP.GLUE_REQUIRED,
    );
    expect(bonBojoUiGroupForItemId(BON_BOJO_LONG_COMPOUND_SPLIT_ID)).toBe(
      BON_BOJO_UI_GROUP.SPACE_REQUIRED,
    );
  });
});

describe('replaceBonBojoRulesData', () => {
  it('bonVerbAllow 갱신', () => {
    const base = bonBojoRulesFingerprint(bonBojoJson);
    expect(base.length).toBeGreaterThan(0);

    const next = structuredClone(bonBojoJson);
    const group = next.groups.find((g) => g.id === 'verb-bon');
    group.bonVerbAllow = ['테스트허용'];

    replaceBonBojoRulesData(next);
    expect(bonVerbAllowForItemId('verb-boda1')).toContain('테스트허용');

    replaceBonBojoRulesData(bonBojoJson);
    expect(bonVerbAllowForItemId('verb-boda1')).not.toContain('테스트허용');
  });
});
