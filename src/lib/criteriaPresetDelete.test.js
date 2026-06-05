import { describe, expect, it } from 'vitest';
import { planCriteriaPresetDelete } from './criteriaPresetDelete.js';

function set(id, name, savedAt = undefined) {
  return {
    id,
    name,
    savedAt,
    builtInEnabled: {},
    cautionEnabled: {},
    customRules: [],
  };
}

describe('planCriteriaPresetDelete', () => {
  it('rejects missing or unsaved targets', () => {
    expect(
      planCriteriaPresetDelete([set('a', 'A', '2026-01-01')], 'a', 'missing'),
    ).toEqual({ ok: false, reason: 'not_found' });
    expect(
      planCriteriaPresetDelete([set('a', 'A')], 'a', 'a'),
    ).toEqual({ ok: false, reason: 'not_saved' });
  });

  it('keeps active id when deleting a non-active saved preset', () => {
    const sets = [
      set('draft', ''),
      set('saved', '내 기준', '2026-02-01'),
      set('other', '다른 기준', '2026-01-01'),
    ];
    const result = planCriteriaPresetDelete(sets, 'draft', 'other');
    expect(result).toMatchObject({
      ok: true,
      nextActiveId: 'draft',
      needsDefault: false,
      label: '다른 기준',
    });
    expect(result.next.map((s) => s.id)).toEqual(['draft', 'saved']);
  });

  it('switches to an unsaved draft after deleting the active saved preset', () => {
    const sets = [
      set('draft', ''),
      set('saved', '내 기준', '2026-02-01'),
    ];
    const result = planCriteriaPresetDelete(sets, 'saved', 'saved');
    expect(result).toMatchObject({
      ok: true,
      nextActiveId: 'draft',
      needsDefault: false,
    });
    expect(result.next).toHaveLength(1);
  });

  it('switches to the latest saved preset when no draft remains', () => {
    const sets = [
      set('old', '옛 기준', '2026-01-01'),
      set('new', '새 기준', '2026-03-01'),
    ];
    const result = planCriteriaPresetDelete(sets, 'new', 'new');
    expect(result).toMatchObject({
      ok: true,
      nextActiveId: 'old',
      needsDefault: false,
    });
  });

  it('needs a fresh default set when the last saved preset is removed', () => {
    const sets = [set('only', '유일', '2026-01-01')];
    const result = planCriteriaPresetDelete(sets, 'only', 'only');
    expect(result).toMatchObject({
      ok: true,
      next: [],
      nextActiveId: null,
      needsDefault: true,
      label: '유일',
    });
  });
});
