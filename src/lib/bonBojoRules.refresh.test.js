import { describe, expect, it } from 'vitest';
import {
  bonVerbAllowForItemId,
  bonBojoRulesFingerprint,
  replaceBonBojoRulesData,
} from './bonBojoRules.js';
import bonBojoJson from '../data/bon-bojo-rules.json';

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
