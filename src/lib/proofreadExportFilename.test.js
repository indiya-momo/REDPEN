import { describe, expect, it } from 'vitest';
import {
  buildCheckResultsZipBasename,
  buildProofreadExportFilename,
  formatProofreadYymmdd,
  proofreadExportLabelForKind,
  sanitizeProofreadProjectPart,
} from './proofreadExportFilename.js';

describe('proofreadExportFilename', () => {
  const day = new Date(2026, 6, 19); // 2026-07-19 local

  it('formatProofreadYymmdd', () => {
    expect(formatProofreadYymmdd(day)).toBe('260719');
  });

  it('sanitizeProofreadProjectPart: 확장자·금지문자', () => {
    expect(sanitizeProofreadProjectPart('고구려조선본없음.pdf')).toBe(
      '고구려조선본없음',
    );
    expect(sanitizeProofreadProjectPart('a/b:c.pdf')).toBe('a_b_c');
    expect(sanitizeProofreadProjectPart('')).toBe('프로젝트명');
  });

  it('buildProofreadExportFilename: 연월일_프로젝트_맞춤법검수', () => {
    expect(
      buildProofreadExportFilename('고구려조선본없음.pdf', '맞춤법검수', day),
    ).toBe('260719_고구려조선본없음_맞춤법검수.xlsx');
    expect(
      buildProofreadExportFilename('고구려조선본없음.pdf', '표기통일검수', day),
    ).toBe('260719_고구려조선본없음_표기통일검수.xlsx');
  });

  it('buildCheckResultsZipBasename', () => {
    expect(buildCheckResultsZipBasename('고구려조선본없음', day)).toBe(
      '260719_고구려조선본없음_검수결과',
    );
  });

  it('proofreadExportLabelForKind', () => {
    expect(proofreadExportLabelForKind('spelling')).toBe('맞춤법검수');
    expect(proofreadExportLabelForKind('consistency')).toBe('표기통일검수');
  });
});
