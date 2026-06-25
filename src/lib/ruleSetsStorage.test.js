import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  duplicateRuleSet,
  formatRuleSetSavedDate,
  formatRuleSetSummary,
  loadActiveSetId,
  loadRuleSets,
  migrateLegacyRuleSetsToUid,
  ruleSetsStorageKey,
  RULE_SETS_ACTIVE_KEY,
  RULE_SETS_STORAGE_KEY,
  saveActiveSetId,
  saveRuleSets,
} from './ruleSetsStorage.js';

describe('formatRuleSetSavedDate', () => {
  it('저장일을 짧은 한국어 날짜로 표시한다', () => {
    expect(formatRuleSetSavedDate('2023-06-18T12:00:00.000Z')).toMatch(
      /^23년 6월 18일$/,
    );
  });
});

describe('formatRuleSetSummary', () => {
  it('저장일과 규칙 건수를 한 줄로 만든다', () => {
    expect(
      formatRuleSetSummary({
        savedAt: '2023-06-18T12:00:00.000Z',
        builtInRuleCount: 10,
        spacingRuleCount: 3,
        consistencyRuleCount: 4,
      }),
    ).toBe(
      '23년 6월 18일 맞춤법 확인 10 · 규칙 제외 0 · 편집자 검토 3 · 일관성 4',
    );
  });

  it('저장 전에는 건수만 표시한다', () => {
    expect(
      formatRuleSetSummary({
        builtInRuleCount: 2,
        spacingRuleCount: 1,
        consistencyRuleCount: 0,
      }),
    ).toBe('맞춤법 확인 2 · 규칙 제외 0 · 편집자 검토 1 · 일관성 0');
  });
});

describe('duplicateRuleSet', () => {
  it('새 id와 복사 이름, 규칙 스냅샷을 만든다', () => {
    const source = {
      id: 'set_a',
      name: '경제서',
      builtInEnabled: { foo: true },
      customRules: [{ find: 'RED PEN', replace: '' }],
      globalExcludePhrases: ['테스트'],
      cautionEnabled: { c1: true },
    };
    const copy = duplicateRuleSet(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe('경제서 (복사)');
    expect(copy.builtInEnabled).toEqual({ foo: true });
    expect(copy.builtInEnabled).not.toBe(source.builtInEnabled);
    expect(copy.cautionEnabled).toEqual({ c1: true });
    expect(copy.cautionEnabled).not.toBe(source.cautionEnabled);
    expect(copy.customRules).toEqual(source.customRules);
    expect(copy.customRules).not.toBe(source.customRules);
    expect(copy.globalExcludePhrases).toEqual(['테스트']);
    expect(copy.globalExcludePhrases).not.toBe(source.globalExcludePhrases);
  });
});

describe('saveRuleSets / loadRuleSets', () => {
  const store = new Map();

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  it('builtInEnabled·cautionEnabled를 localStorage에 유지한다', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });

    const sets = [
      {
        id: 'set_1',
        name: '테스트',
        builtInEnabled: { '우리 나라': false },
        cautionEnabled: { c1: false },
        customRules: [],
      },
    ];
    saveRuleSets(sets);
    const loaded = loadRuleSets();
    expect(loaded[0].builtInEnabled).toEqual({ '우리 나라': false });
    expect(loaded[0].cautionEnabled).toEqual({ c1: false });
  });
});

describe('uid-scoped rule set storage', () => {
  const store = new Map();

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  function stubStorage() {
    vi.stubGlobal('localStorage', {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });
  }

  it('uid별 키로 ruleSets·activeSetId를 분리 저장한다', () => {
    stubStorage();
    const uidA = 'user_a';
    const uidB = 'user_b';
    const setsA = [
      {
        id: 'set_a',
        name: 'A 프로젝트',
        builtInEnabled: {},
        cautionEnabled: {},
        customRules: [],
      },
    ];
    const setsB = [
      {
        id: 'set_b',
        name: 'B 프로젝트',
        builtInEnabled: {},
        cautionEnabled: {},
        customRules: [],
      },
    ];

    saveRuleSets(setsA, uidA);
    saveActiveSetId('set_a', uidA);
    saveRuleSets(setsB, uidB);
    saveActiveSetId('set_b', uidB);

    expect(store.has(ruleSetsStorageKey(uidA))).toBe(true);
    expect(store.has(ruleSetsStorageKey(uidB))).toBe(true);
    expect(loadRuleSets(uidA)[0].name).toBe('A 프로젝트');
    expect(loadRuleSets(uidB)[0].name).toBe('B 프로젝트');
    expect(loadActiveSetId(uidA)).toBe('set_a');
    expect(loadActiveSetId(uidB)).toBe('set_b');
  });

  it('legacy 공용 키를 uid 키로 1회 이전한다', () => {
    stubStorage();
    const legacySets = [
      {
        id: 'set_legacy',
        name: '이전 데이터',
        builtInEnabled: {},
        cautionEnabled: {},
        customRules: [],
      },
    ];
    store.set(RULE_SETS_STORAGE_KEY, JSON.stringify(legacySets));
    store.set(RULE_SETS_ACTIVE_KEY, 'set_legacy');

    const uid = 'user_migrate';
    const migrated = migrateLegacyRuleSetsToUid(uid);

    expect(migrated[0].name).toBe('이전 데이터');
    expect(store.has(ruleSetsStorageKey(uid))).toBe(true);
    expect(loadActiveSetId(uid)).toBe('set_legacy');
    expect(loadRuleSets(uid)[0].id).toBe('set_legacy');
  });

  it('uid 키가 이미 있으면 legacy를 다시 이전하지 않는다', () => {
    stubStorage();
    const uid = 'user_existing';
    const scopedSets = [
      {
        id: 'set_scoped',
        name: 'uid 전용',
        builtInEnabled: {},
        cautionEnabled: {},
        customRules: [],
      },
    ];
    store.set(RULE_SETS_STORAGE_KEY, JSON.stringify([
      {
        id: 'set_legacy',
        name: 'legacy',
        builtInEnabled: {},
        cautionEnabled: {},
        customRules: [],
      },
    ]));
    store.set(ruleSetsStorageKey(uid), JSON.stringify(scopedSets));

    const migrated = migrateLegacyRuleSetsToUid(uid);

    expect(migrated[0].name).toBe('uid 전용');
    expect(migrated[0].id).toBe('set_scoped');
  });
});
