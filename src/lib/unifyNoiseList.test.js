import { describe, expect, it } from 'vitest';
import {
  UNIFY_NOISE_BON_BOJO_REFS,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
  UNIFY_NOISE_TAG_TEMPLATES,
  UNIFY_NOISE_VERBAL_TAILS,
  hasUnifyNoiseDenyEojeol,
  isSpacedLeftJosaNoiseEojeol,
  matchesNoiseListMorphTail,
  shouldRejectByNoiseList,
  spacedVariantHitsNoiseDenylist,
} from './unifyNoiseList.js';

describe('unifyNoiseList (1차 정적 리스트)', () => {
  it('예외·꼬리·본보조 ref 메타가 있다', () => {
    expect(UNIFY_NOISE_EXCEPTION_EOJEOLS.has('대부분')).toBe(true);
    expect(UNIFY_NOISE_VERBAL_TAILS).toContain('있다고');
    expect(UNIFY_NOISE_BON_BOJO_REFS).toContain('verb-hada');
    expect(UNIFY_NOISE_TAG_TEMPLATES.some((t) => t.id === 'noun-verbal-connective')).toBe(
      true,
    );
    expect(hasUnifyNoiseDenyEojeol('기록하다')).toBe(false);
    expect(hasUnifyNoiseDenyEojeol('가정하고')).toBe(false);
  });

  it('예외는 NNG 오통과만', () => {
    expect(hasUnifyNoiseDenyEojeol('대부분')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('일부')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('공무원')).toBe(false);
    expect(UNIFY_NOISE_EXCEPTION_EOJEOLS.size).toBeLessThanOrEqual(20);
  });

  it('unifyNoiseListData에는 조사 휴리스틱 하드코딩이 없다', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const file = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'unifyNoiseListData.js',
    );
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/SPACED_LEFT/);
    expect(src).not.toMatch(/isSpacedLeftJosaNoiseEojeol/);
  });

  it('수확 꼬리로 가치있다고·구성되며·것이고를 잡는다', () => {
    expect(matchesNoiseListMorphTail('가치있다고')).toBe(true);
    expect(matchesNoiseListMorphTail('구성되며')).toBe(true);
    expect(matchesNoiseListMorphTail('것이고')).toBe(true);
    expect(matchesNoiseListMorphTail('주식')).toBe(false);
  });

  it('띄움 1차 리스트 — 잡음 제외·명사복합 유지', () => {
    expect(spacedVariantHitsNoiseDenylist('대부분 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('대부분 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('가정하고 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('가치있다고 시장')).toBe(true);
    expect(shouldRejectByNoiseList('구성되며 시장')).toBe(true);
    expect(shouldRejectByNoiseList('기록하여 결과')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
    // 오른쪽 예외·의존명사
    expect(spacedVariantHitsNoiseDenylist('가족 모두')).toBe(true);
    expect(spacedVariantHitsNoiseDenylist('가족 끼리')).toBe(true);
    expect(spacedVariantHitsNoiseDenylist('결혼 직전')).toBe(true);
    expect(shouldRejectByNoiseList('가족 모두')).toBe(true);
    expect(shouldRejectByNoiseList('결혼 직전')).toBe(true);
  });

  it('활용·이다 꼬리 — 담당하던·광고니까', () => {
    expect(matchesNoiseListMorphTail('담당하던')).toBe(true);
    expect(matchesNoiseListMorphTail('광고니까')).toBe(true);
    expect(matchesNoiseListMorphTail('가족끼리')).toBe(true);
    expect(matchesNoiseListMorphTail('결혼직전')).toBe(true);
  });

  it('명사+하다 활용 — 결혼하고자·하려고·하였고·했어', () => {
    expect(matchesNoiseListMorphTail('결혼하고자')).toBe(true);
    expect(matchesNoiseListMorphTail('결혼하려고')).toBe(true);
    expect(matchesNoiseListMorphTail('결혼하였고')).toBe(true);
    expect(matchesNoiseListMorphTail('결혼했어')).toBe(true);
    expect(matchesNoiseListMorphTail('하고자')).toBe(true);
    expect(matchesNoiseListMorphTail('했어')).toBe(true);
    expect(shouldRejectByNoiseList('결혼 하고자')).toBe(true);
    expect(shouldRejectByNoiseList('결혼 하려고')).toBe(true);
    expect(shouldRejectByNoiseList('결혼 하였고')).toBe(true);
    expect(shouldRejectByNoiseList('결혼 했어')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
  });

  it('띄움 왼쪽 조사·용언 연결 — 내가·들어서·등이·보면', () => {
    expect(shouldRejectByNoiseList('내가 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('들어서 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('등이 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('보면 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
    expect(shouldRejectByNoiseList('캐나다 정부')).toBe(false);
    // 조사 가드: 붉은 ≠ 붉+은 (후보는 관형형으로 DROP)
    expect(isSpacedLeftJosaNoiseEojeol('붉은')).toBe(false);
    expect(shouldRejectByNoiseList('붉은 표시')).toBe(true);
  });
});
