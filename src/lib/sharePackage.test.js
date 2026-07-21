import { describe, expect, it } from 'vitest';
import {
  buildSharePackagePayload,
  buildSharePackageUrl,
  extractShareCriteria,
  isSharePackageExpired,
  planApplySharePackage,
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

  it('isSharePackageExpired', () => {
    expect(isSharePackageExpired({ expiresAt: Date.now() - 1 })).toBe(true);
    expect(isSharePackageExpired({ expiresAt: Date.now() + 10000 })).toBe(false);
  });

  it('buildSharePackageUrl sets share query', () => {
    expect(buildSharePackageUrl('abc123')).toContain('share=abc123');
  });
});
