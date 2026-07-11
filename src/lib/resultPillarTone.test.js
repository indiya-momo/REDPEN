import { describe, expect, it } from 'vitest';
import {
  pdfHighlightHasOutline,
  pdfHighlightPillarClass,
  resultBadgeTone,
  resultPillarTone,
  resultPillarToneClass,
} from './resultPillarTone.js';

describe('resultPillarTone', () => {
  it('맞춤법은 spelling', () => {
    expect(resultPillarTone('spelling', null)).toBe('spelling');
    expect(resultPillarTone('spelling', { patternKind: 'auxiliary-verb' })).toBe(
      'spelling',
    );
  });

  it('본+보는 auxiliary, 그 외 표기 통일은 consistency', () => {
    expect(
      resultPillarTone('consistency', { patternKind: 'auxiliary-verb' }),
    ).toBe('auxiliary');
    expect(
      resultPillarTone('consistency', { patternKind: 'compound-find' }),
    ).toBe('consistency');
    expect(resultPillarTone('consistency', null)).toBe('consistency');
  });

  it('클래스 접두를 붙인다', () => {
    expect(resultPillarToneClass('auxiliary')).toBe('result-pillar--auxiliary');
    expect(pdfHighlightPillarClass('spelling')).toBe(
      'pdf-highlight--pillar-spelling',
    );
  });
});

describe('resultBadgeTone', () => {
  it('맞춤법 안에서 편집자 검토와 맞춤법을 나눈다', () => {
    expect(resultBadgeTone('spelling', { category: 'caution' })).toBe(
      'spelling-caution',
    );
    expect(resultBadgeTone('spelling', {})).toBe('spelling-builtin');
  });

  it('표기 통일 안에서 여러 개·통일형·공통 문자열을 나눈다', () => {
    expect(
      resultBadgeTone('consistency', { patternKind: 'compound-find' }),
    ).toBe('consistency-literal');
    expect(
      resultBadgeTone('consistency', {
        patternKind: 'compound-find',
        isUnify: true,
      }),
    ).toBe('consistency-unify');
    expect(
      resultBadgeTone('consistency', { patternKind: 'phrase-slot-find' }),
    ).toBe('consistency-common');
    expect(
      resultBadgeTone('consistency', { patternKind: 'auxiliary-verb' }),
    ).toBe('auxiliary');
  });

  it('맞춤법·통일형만 원고 테두리', () => {
    expect(pdfHighlightHasOutline('spelling-builtin')).toBe(true);
    expect(pdfHighlightHasOutline('consistency-unify')).toBe(true);
    expect(pdfHighlightHasOutline('spelling-caution')).toBe(false);
    expect(pdfHighlightHasOutline('consistency-literal')).toBe(false);
    expect(pdfHighlightHasOutline('auxiliary')).toBe(false);
  });
});
