import { describe, expect, it } from 'vitest';
import {
  CRITERIA_NAME_PLACEHOLDER,
  LEGACY_DEFAULT_CRITERIA_HINT,
  criteriaNameForInput,
  criteriaNameForSave,
} from './criteriaName.js';

describe('criteriaName', () => {
  it('treats placeholder and legacy hint as empty for input', () => {
    expect(criteriaNameForInput('')).toBe('');
    expect(criteriaNameForInput('  ')).toBe('');
    expect(criteriaNameForInput(CRITERIA_NAME_PLACEHOLDER)).toBe('');
    expect(criteriaNameForInput(LEGACY_DEFAULT_CRITERIA_HINT)).toBe('');
  });

  it('keeps user-entered names', () => {
    expect(criteriaNameForInput('  내 기준  ')).toBe('내 기준');
  });

  it('rejects non-saveable names on save', () => {
    expect(criteriaNameForSave(CRITERIA_NAME_PLACEHOLDER)).toBe('');
    expect(criteriaNameForSave(LEGACY_DEFAULT_CRITERIA_HINT)).toBe('');
    expect(criteriaNameForSave('출판 기준')).toBe('출판 기준');
  });
});
