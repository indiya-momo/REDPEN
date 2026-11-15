import { describe, expect, it } from 'vitest';
import spellingRulesJson from '../data/spelling-rules.json';
import {
  BUILT_IN_RULES,
  SPELLING_RULES_FP,
  buildSpellingCheckRuleFromBuiltIn,
  getBuiltInOverlayReplace,
  isBuiltInRuleVisible,
  migrateBuiltInEnabled,
} from './builtInRules.js';

describe('migrateBuiltInEnabled', () => {
  it('동일 fingerprint에서는 저장된 체크 상태를 우선한다', () => {
    const saved = {
      '과반수 이상': false,
      '우리 나라': false,
    };
    const merged = migrateBuiltInEnabled(saved, SPELLING_RULES_FP);
    expect(merged['과반수 이상']).toBe(false);
    expect(merged['우리 나라']).toBe(false);
  });

  it('finds 규칙은 예전 find 키가 켜져 있으면 ruleId로 이전한다', () => {
    const merged = migrateBuiltInEnabled(
      { 애덤: true, 애썸: false },
      SPELLING_RULES_FP,
    );
    if (merged['foreign-adam'] !== undefined) {
      expect(merged['foreign-adam']).toBe(true);
    }
  });

  it('저장 맵에 없는 새 finds 규칙은 시트 기본값을 유지한다', () => {
    const defaults = migrateBuiltInEnabled({}, null);
    const withoutNew = { ...defaults };
    delete withoutNew['봄 비'];
    delete withoutNew['봄 날'];
    const merged = migrateBuiltInEnabled(withoutNew, SPELLING_RULES_FP);
    expect(merged['봄 비']).toBe(true);
    expect(merged['봄 날']).toBe(true);
  });
});

describe('getBuiltInOverlayReplace', () => {
  it('finds 이형태 규칙 — spellingRuleId(대표 find)로 overlay를 찾는다', () => {
    // J가 있는 finds 행(시트 순서에 기대지 않고 데이터에서 고름)
    const row = spellingRulesJson.find(
      (r) => r.finds?.length >= 2 && r.overlayReplace && !r.findReplaces && !r.ruleId,
    );
    expect(row).toBeTruthy();
    const rule = buildSpellingCheckRuleFromBuiltIn(
      BUILT_IN_RULES.find((r) => r.find === row.find && r.replace === row.replace),
    );
    // find가 regex alternation으로 바뀌어도 spellingRuleId(=대표 find)로 찾는다
    expect(rule.pattern).toBe('regex');
    expect(rule.spellingRuleId).toBe(row.find);
    expect(getBuiltInOverlayReplace(rule.find, row.replace, rule.spellingRuleId)).toBe(
      row.overlayReplace,
    );
    expect(getBuiltInOverlayReplace(row.find, row.replace)).toBe(row.overlayReplace);
  });

  it('findReplaces 행은 J가 있어도 overlay를 돌려주지 않는다', () => {
    const row = spellingRulesJson.find((r) => r.findReplaces);
    if (!row) return;
    const id = String(row.ruleId ?? '').trim() || row.find;
    expect(getBuiltInOverlayReplace(row.find, row.replace, id)).toBeNull();
  });
});

describe('isBuiltInRuleVisible', () => {
  it('visible이 false가 아니면 UI에 보인다', () => {
    expect(isBuiltInRuleVisible({ visible: true })).toBe(true);
    expect(isBuiltInRuleVisible({})).toBe(true);
    expect(isBuiltInRuleVisible({ visible: false })).toBe(false);
  });
});

