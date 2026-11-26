import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileRegexSpec, validateVisualGolden } from './goldenSchema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('goldenSchema', () => {
  it('RegexSpec에 u를 붙이고 컴파일한다', () => {
    const r = compileRegexSpec({ source: '불치병\\s*의' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.re.test('불치병 의')).toBe(true);
  });

  it('불리언·평문 정규식은 거부한다', () => {
    expect(compileRegexSpec(true).ok).toBe(false);
    expect(compileRegexSpec('foo').ok).toBe(false);
  });

  it('저장소 골든 파일이 스키마를 통과한다', () => {
    for (const name of ['depressione.golden.json', 'street.golden.json']) {
      const raw = JSON.parse(
        readFileSync(join(root, 'test-fixtures/visual-golden', name), 'utf8'),
      );
      const v = validateVisualGolden(raw);
      expect(v.ok, name + (v.ok ? '' : `: ${v.errors?.join('; ')}`)).toBe(true);
    }
  });

  it('labelEvidence 없으면 거부한다', () => {
    const v = validateVisualGolden({
      schemaVersion: 1,
      book: { id: 'x', pdfFileName: 'x.pdf' },
      labeledBy: 'human',
      labeledAt: '2026-11-26',
      labelSource: 'test',
      labelEvidence: [],
      checks: {},
    });
    expect(v.ok).toBe(false);
  });
});
