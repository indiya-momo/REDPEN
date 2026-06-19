import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAUTION_ENABLED_POLICY_VERSION,
  CAUTION_RULES,
  CAUTION_RULES_FP,
} from './cautionRules.js';
import { SPELLING_RULES_FP } from './builtInRules.js';
import { restoreCheckResults } from './checkResultUtils.js';
import { normalizeRuleSet } from './ruleSetNormalize.js';
import {
  clearWorkSession,
  loadWorkSession,
  saveWorkSession,
} from './sessionStore.js';
import { loadRuleSets, saveRuleSets } from './ruleSetsStorage.js';
import {
  installSessionTestGlobals,
  localStore,
  uninstallSessionTestGlobals,
} from './sessionTestMocks.js';

beforeEach(() => {
  installSessionTestGlobals();
});

afterEach(() => {
  uninstallSessionTestGlobals();
});

describe('toggle persistence smoke', () => {
  it('localStorage round-trip 후 fingerprint가 맞으면 맞춤법 토글 유지', () => {
    const before = normalizeRuleSet({
      id: 'set_1',
      name: '테스트',
      builtInEnabled: { '우리 나라': false },
      spellingRulesFingerprint: SPELLING_RULES_FP,
      customRules: [],
    });
    saveRuleSets([before]);

    const loaded = loadRuleSets()[0];
    const after = normalizeRuleSet(loaded);
    expect(after.builtInEnabled['우리 나라']).toBe(false);
    expect(after.spellingRulesFingerprint).toBe(SPELLING_RULES_FP);
  });

  it('localStorage round-trip 후 fingerprint가 맞으면 주의 토글 유지', () => {
    const sampleId = CAUTION_RULES[0]?.id;
    expect(sampleId).toBeTruthy();

    const before = normalizeRuleSet({
      id: 'set_1',
      name: '테스트',
      cautionEnabled: { [sampleId]: false },
      cautionRulesFingerprint: CAUTION_RULES_FP,
      cautionEnabledPolicyVersion: CAUTION_ENABLED_POLICY_VERSION,
      customRules: [],
    });
    saveRuleSets([before]);

    const loaded = loadRuleSets()[0];
    const after = normalizeRuleSet(loaded);
    expect(after.cautionEnabled[sampleId]).toBe(false);
    expect(after.cautionRulesFingerprint).toBe(CAUTION_RULES_FP);
  });
});

describe('restore check results smoke', () => {
  it('규칙 fingerprint가 일치하면 맞춤법 결과를 복원한다', () => {
    const grouped = [{ find: 'A', replace: 'B', instances: [] }];
    const { spelling, staleRules } = restoreCheckResults({
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      groupedResults: grouped,
      consistencyGroupedResults: [],
    });
    expect(spelling).toEqual(grouped);
    expect(staleRules).toBe(false);
  });

  it('맞춤법 fingerprint가 다르면 맞춤법 결과는 비우고 staleRules 표시', () => {
    const { spelling, staleRules } = restoreCheckResults({
      spellingRulesFingerprint: 'old-fp',
      cautionRulesFingerprint: CAUTION_RULES_FP,
      groupedResults: [{ find: 'A', replace: 'B', instances: [] }],
      consistencyGroupedResults: [{ find: 'C', replace: 'D', instances: [] }],
    });
    expect(spelling).toEqual([]);
    expect(staleRules).toBe(true);
  });

  it('일관성 결과는 맞춤법 fingerprint와 무관하게 유지한다', () => {
    const consistency = [{ find: 'C', replace: 'D', instances: [] }];
    const { consistency: restored } = restoreCheckResults({
      spellingRulesFingerprint: 'old-fp',
      cautionRulesFingerprint: CAUTION_RULES_FP,
      groupedResults: [],
      consistencyGroupedResults: consistency,
    });
    expect(restored).toEqual(consistency);
  });
});

describe('session store smoke', () => {
  it('PDF 없이 저장하면 실패한다', async () => {
    const result = await saveWorkSession({
      fileName: 'empty.pdf',
      pageTexts: [],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PDF 데이터/);
  });

  it('fileHandle 경로로 표시 제외 상태를 저장하고 다시 불러온다', async () => {
    const grouped = [
      {
        find: 'F1',
        replace: 'R1',
        label: '먹고사',
        instances: [
          {
            find: 'F1',
            replace: 'R1',
            matchedText: '먹고 사',
            suggestedText: '먹고사',
            pageNum: 8,
            index: 1,
          },
        ],
      },
    ];
    const resultVisibility = {
      hiddenGroups: {},
      hiddenInstances: {
        'spelling:F1\0R1': { '8:1:먹고 사': true },
      },
    };
    const fileHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => ({
        name: 'vis.pdf',
        arrayBuffer: async () => new ArrayBuffer(16),
      }),
    };

    const saved = await saveWorkSession({
      fileName: 'vis.pdf',
      fileHandle,
      pageTexts: [{ pageNum: 1, text: 'hello' }],
      groupedResults: grouped,
      consistencyGroupedResults: [],
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      currentPage: 1,
      spellingCheckDone: true,
      resultVisibility,
    });
    expect(saved.ok).toBe(true);

    const loaded = await loadWorkSession();
    expect(loaded?.resultVisibility).toEqual(resultVisibility);
    expect(loaded?.spellingCheckDone).toBe(true);
  });

  it('fileHandle 경로로 메타·결과를 저장하고 다시 불러온다', async () => {
    const grouped = [{ find: 'X', replace: 'Y', instances: [] }];
    const fileHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => ({
        name: 'smoke.pdf',
        arrayBuffer: async () => new ArrayBuffer(16),
      }),
    };

    const saved = await saveWorkSession({
      fileName: 'smoke.pdf',
      fileHandle,
      pageTexts: [{ pageNum: 1, text: 'hello' }],
      groupedResults: grouped,
      consistencyGroupedResults: [],
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      currentPage: 2,
    });
    expect(saved.ok).toBe(true);

    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.fileName).toBe('smoke.pdf');
    expect(loaded?.currentPage).toBe(2);
    expect(loaded?.groupedResults).toEqual(grouped);
    expect(loaded?.spellingRulesFingerprint).toBe(SPELLING_RULES_FP);
    expect(loaded?.pdfBuffer?.byteLength).toBe(16);
  });

  it('clearWorkSession 후 load는 null이다', async () => {
    const fileHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => ({
        name: 'gone.pdf',
        arrayBuffer: async () => new ArrayBuffer(4),
      }),
    };

    await saveWorkSession({
      fileName: 'gone.pdf',
      fileHandle,
      pageTexts: [],
    });
    await clearWorkSession();
    const loaded = await loadWorkSession();
    expect(loaded).toBeNull();
  });

  it('pdfBuffer는 OPFS/Cache 없을 때 청크 저장 후 바이트·일관성 결과를 복원한다', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const consistency = [{ find: '본보', replace: '본·보', instances: [] }];

    const saved = await saveWorkSession({
      fileName: 'chunk-smoke.pdf',
      pdfBuffer: pdfBytes.buffer,
      pageTexts: [{ pageNum: 1, text: 'page one' }],
      groupedResults: [],
      consistencyGroupedResults: consistency,
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      currentPage: 1,
    });
    expect(saved.ok).toBe(true);
    expect(saved.mode).toBe('chunks');

    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.fileName).toBe('chunk-smoke.pdf');
    expect(loaded?.pdfBuffer?.byteLength).toBe(8);
    expect(new Uint8Array(loaded?.pdfBuffer ?? [])).toEqual(pdfBytes);
    expect(loaded?.consistencyGroupedResults).toEqual(consistency);
    expect(loaded?.spellingRulesFingerprint).toBe(SPELLING_RULES_FP);
  });

  it('fileHandle 읽기 권한 거부 시 needFilePermission과 검사 메타만 반환한다', async () => {
    let readDenied = false;
    const fileHandle = {
      queryPermission: async () => (readDenied ? 'denied' : 'granted'),
      requestPermission: async () => 'granted',
      getFile: async () => ({
        name: 'perm.pdf',
        arrayBuffer: async () => new ArrayBuffer(12),
      }),
    };
    const grouped = [{ find: 'A', replace: 'B', instances: [{ pageNum: 3 }] }];

    const saved = await saveWorkSession({
      fileName: 'perm.pdf',
      fileHandle,
      pageTexts: [{ pageNum: 1, text: 'x' }],
      groupedResults: grouped,
      consistencyGroupedResults: [],
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      currentPage: 3,
      selectedInstance: { pageNum: 3, index: 0 },
    });
    expect(saved.ok).toBe(true);

    readDenied = true;
    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.needFilePermission).toBe(true);
    expect(loaded?.fileHandle).toBe(fileHandle);
    expect(loaded?.fileName).toBe('perm.pdf');
    expect(loaded?.currentPage).toBe(3);
    expect(loaded?.groupedResults).toEqual(grouped);
    expect(loaded?.selectedInstance).toEqual({ pageNum: 3, index: 0 });
    expect(loaded?.pdfBuffer).toBeUndefined();
  });
});
