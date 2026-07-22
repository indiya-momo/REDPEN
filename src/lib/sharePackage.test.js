import { describe, expect, it } from 'vitest';
import {
  buildRuleSetFromSharePackage,
  buildSharePackagePayload,
  buildSharePackageUrl,
  extractShareCriteria,
  isSharePackageExpired,
  omitUndefinedDeep,
  planApplySharePackage,
  formatShareIssuedLabel,
  sanitizeCheckResultForShare,
} from './sharePackage.js';

function sampleRuleSet(overrides = {}) {
  return {
    id: 'set_src',
    name: '고구려조선본없음',
    savedAt: '2026-07-20T00:00:00.000Z',
    builtInEnabled: { a: true },
    cautionEnabled: { c1: true },
    customRules: [{ id: 'r1', find: '제미니', replace: '제미나이' }],
    globalExcludePhrases: ['제외'],
    consistencyDecisions: [
      {
        id: 'd1',
        kind: 'unify',
        pinned: '제미나이',
        variants: ['제미니'],
      },
    ],
    tags: ['문학'],
    memo: '메모',
    projectContext: { formatLabel: '신국판' },
    ...overrides,
  };
}

describe('sharePackage', () => {
  it('extractShareCriteria omits projectContext/pdf', () => {
    const criteria = extractShareCriteria(sampleRuleSet());
    expect(criteria.builtInEnabled).toEqual({ a: true });
    expect(criteria.customRules).toHaveLength(1);
    expect(criteria).not.toHaveProperty('projectContext');
    expect(JSON.stringify(criteria)).not.toMatch(/pdfBytes|fileBytes/);
  });

  it('buildSharePackagePayload copies criteria and non-expired results', () => {
    const now = Date.UTC(2026, 6, 21);
    const payload = buildSharePackagePayload({
      ruleSet: sampleRuleSet(),
      createdByUid: 'uid1',
      now,
      checkResults: [
        {
          kind: 'spelling',
          schemaVersion: 1,
          createdAt: now - 1000,
          expiresAt: now + 86400000,
          projectId: 'set_src',
          pdfFileName: 'a.pdf',
          sheetName: '맞춤법 확인',
          filename: 'x.xlsx',
          summaryLine: 's',
          summary: {},
          rows: [{ label: '가디건' }],
          truncated: false,
          rowCount: 1,
        },
        {
          kind: 'spelling',
          schemaVersion: 1,
          createdAt: now - 2000,
          expiresAt: now - 1,
          projectId: 'set_src',
          rows: [],
        },
      ],
    });
    expect(payload).not.toBeNull();
    expect(payload.createdByUid).toBe('uid1');
    expect(payload.sourceName).toBe('고구려조선본없음');
    expect(payload.meta.tags).toEqual(['문학']);
    expect(payload.criteria.consistencyDecisions).toHaveLength(1);
    expect(payload.checkResults).toHaveLength(1);
    expect(payload.checkResults[0].pdfFileName).toBe('a.pdf');
    expect(payload.checkResults[0].rowCount).toBe(1);
    expect(payload.checkResults[0].rows).toEqual([]);
    expect(JSON.stringify(payload)).not.toMatch(/"pdfBytes"|"fileBytes"/);
  });

  it('buildSharePackagePayload rejects unsaved set', () => {
    expect(
      buildSharePackagePayload({
        ruleSet: sampleRuleSet({ savedAt: undefined }),
        createdByUid: 'uid1',
      }),
    ).toBeNull();
  });

  it('sanitizeCheckResultForShare drops unknown kind', () => {
    expect(sanitizeCheckResultForShare({ kind: 'other' })).toBeNull();
  });

  it('planApplySharePackage creates saved RuleSet for recipient', () => {
    const now = Date.now();
    const pkg = buildSharePackagePayload({
      ruleSet: sampleRuleSet(),
      createdByUid: 'owner',
      now,
      checkResults: [],
    });
    const result = planApplySharePackage(pkg, [], 'recv', '', 'paid');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toHaveLength(1);
    expect(result.next[0].name).toMatch(/^공유 · /);
    expect(result.next[0].savedAt).toBeTruthy();
    expect(
      result.next[0].customRules.some(
        (r) => r.id === 'r1' && r.find === '제미니' && r.replace === '제미나이',
      ),
    ).toBe(true);
    expect(result.next[0].globalExcludePhrases).toEqual(['제외']);
    expect(result.next[0].tags).toEqual(['문학']);
    expect(result.newSetId).toBe(result.next[0].id);
  });

  it('planApplySharePackage rejects expired package', () => {
    const pkg = buildSharePackagePayload({
      ruleSet: sampleRuleSet(),
      createdByUid: 'owner',
      now: Date.now() - 40 * 24 * 60 * 60 * 1000,
    });
    expect(planApplySharePackage(pkg, [], 'recv').ok).toBe(false);
  });

  it('buildRuleSetFromSharePackage builds preview ruleSet', () => {
    const pkg = buildSharePackagePayload({
      ruleSet: sampleRuleSet(),
      createdByUid: 'owner',
      now: Date.now(),
    });
    const set = buildRuleSetFromSharePackage(pkg);
    expect(set).not.toBeNull();
    expect(set.name).toBe('고구려조선본없음');
    expect(set.tags).toEqual(['문학']);
    expect(set.memo).toBe('메모');
    expect(set.projectContext?.formatLabel).toBe('신국판');
    expect(set.customRules.some((r) => r.find === '제미니')).toBe(true);
  });

  it('buildSharePackagePayload omits undefined fields for Firestore', () => {
    const payload = buildSharePackagePayload({
      ruleSet: sampleRuleSet({ pillarMemos: undefined }),
      createdByUid: 'uid1',
      now: Date.now(),
    });
    expect(payload).not.toBeNull();
    expect(payload.meta).not.toHaveProperty('pillarMemos');
    expect(JSON.stringify(payload)).not.toMatch(/undefined/);
    // JSON.stringify는 undefined를 지우므로, 객체에 undefined가 남지 않았는지도 검사
    expect(omitUndefinedDeep(payload)).toEqual(payload);
  });

  it('omitUndefinedDeep drops nested undefined', () => {
    expect(
      omitUndefinedDeep({
        a: 1,
        b: undefined,
        c: { d: undefined, e: 2 },
        f: [1, undefined, { g: undefined, h: 3 }],
      }),
    ).toEqual({
      a: 1,
      c: { e: 2 },
      f: [1, { h: 3 }],
    });
  });

  it('isSharePackageExpired', () => {
    expect(isSharePackageExpired({ expiresAt: Date.now() - 1 })).toBe(true);
    expect(isSharePackageExpired({ expiresAt: Date.now() + 10000 })).toBe(false);
  });

  it('buildSharePackageUrl sets share query', () => {
    expect(buildSharePackageUrl('abc123')).toContain('share=abc123');
  });

  it('formatShareIssuedLabel', () => {
    expect(formatShareIssuedLabel(0)).toBe('');
    expect(formatShareIssuedLabel(null)).toBe('');
    const label = formatShareIssuedLabel(new Date(2026, 6, 21, 11, 13).getTime());
    expect(label).toBe('26.07.21.11:13 공유');
  });
});
