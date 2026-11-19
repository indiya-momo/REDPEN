import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import bonBojoJson from '../data/bon-bojo-rules.json';
import { replaceBonBojoRulesData } from './bonBojoRules.js';
import { setStdictVerbFormsForTests, resolveSpaceRequiredLemma } from './stdictVerbForms.js';
import { compoundLemma, gluedCompoundLemma } from './auxiliaryDictSolid.js';

const extract = new URL('../../public/data/stdict-verb-forms.json', import.meta.url);

describe('사전 한 단어 — 한 글자 본용언(해-보다·커-지다)', () => {
  beforeAll(() => {
    replaceBonBojoRulesData(bonBojoJson);
    setStdictVerbFormsForTests(JSON.parse(fs.readFileSync(extract, 'utf8')));
  });

  const resolve = (lemma) => resolveSpaceRequiredLemma(lemma, '');

  it('붙여 쓴 해보다·해봤다·커졌다는 사전 표제어로 찾는다', () => {
    expect(resolve(gluedCompoundLemma('해보다', 'verb-boda1'))).toBe('해보다');
    expect(resolve(gluedCompoundLemma('해봤다', 'verb-boda1'))).toBe('해보다');
    expect(resolve(gluedCompoundLemma('커졌다', 'verb-jida'))).toBe('커지다');
  });

  it('띄어 쓴 해 보다도 사전 표제어로 찾는다', () => {
    expect(resolve(compoundLemma('해 보다', 'verb-boda1'))).toBe('해보다');
    expect(resolve(compoundLemma('커 졌다', 'verb-jida'))).toBe('커지다');
  });

  it('사전에 없는 먹어보다는 표제어로 찾지 않는다', () => {
    expect(resolve(gluedCompoundLemma('먹어보다', 'verb-boda1'))).toBe('');
  });
});