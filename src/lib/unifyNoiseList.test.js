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
  shouldRejectByNoiseListEojeol,
  shouldRejectUnifyCandidateNoise,
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

  it('예외는 NNG 오통과만 — 120개 미만(재검토 알람)', () => {
    expect(hasUnifyNoiseDenyEojeol('대부분')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('일부')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('공무원')).toBe(false);
    // 합의(2026-08-07): 예외 ≥100 → 형태소 재검토. depressione 수확 후 104 — 알람 120.
    expect(
      UNIFY_NOISE_EXCEPTION_EOJEOLS.size,
      `예외 ${UNIFY_NOISE_EXCEPTION_EOJEOLS.size}개 ≥120 — 형태소(서버 C·DEV 2차 boot) 방향 재검토 시점`,
    ).toBeLessThan(120);
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
    // 좌우 동일 — 예외·관형 휴리스틱
    expect(shouldRejectByNoiseList('이런 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('공무원 이런')).toBe(true);
    expect(shouldRejectByNoiseList('금융 관련')).toBe(true);
    expect(shouldRejectByNoiseList('관련 금융')).toBe(true);
    expect(shouldRejectByNoiseList('아는 사람')).toBe(true);
    expect(shouldRejectByNoiseList('사람 아는')).toBe(true);
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
    // Kiwi NNG+JKB — 처소격은 음절 수 무제한
    expect(isSpacedLeftJosaNoiseEojeol('앞에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('뒤에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('끝에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('곳에서')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('금융에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('시장에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('캐나다에')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('이제')).toBe(false);
    expect(isSpacedLeftJosaNoiseEojeol('아예')).toBe(false);
    expect(shouldRejectByNoiseList('앞에 주택')).toBe(true);
    expect(shouldRejectByNoiseList('금융에 시장')).toBe(true);
    expect(shouldRejectByNoiseList('캐나다에 정부')).toBe(true);
    expect(shouldRejectByNoiseList('캐나다 정부')).toBe(false);
    // 2음절+격조사 (마음이 시대)
    expect(isSpacedLeftJosaNoiseEojeol('마음이')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('시장을')).toBe(true);
    expect(shouldRejectByNoiseList('마음이 시대')).toBe(true);
    // 양보·관형격·접속격 (@금융 앞)
    expect(isSpacedLeftJosaNoiseEojeol('아시아의')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('경제라도')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('규제와')).toBe(true);
    // 거+의 오탐 가드(조사 휴리스틱만) — 예외 표면 DROP은 별도
    expect(isSpacedLeftJosaNoiseEojeol('거의')).toBe(false);
    expect(isSpacedLeftJosaNoiseEojeol('사과')).toBe(false);
    expect(isSpacedLeftJosaNoiseEojeol('주식시장이')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('부문도')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('호황과')).toBe(true);
    expect(shouldRejectByNoiseList('아시아의 금융')).toBe(true);
    expect(shouldRejectByNoiseList('이번 금융')).toBe(true);
    expect(shouldRejectByNoiseList('경제라도 금융')).toBe(true);
    expect(shouldRejectByNoiseList('규제와 금융')).toBe(true);
    expect(shouldRejectByNoiseList('그래도 금융')).toBe(true);
    expect(shouldRejectByNoiseList('나라의 금융')).toBe(true);
    expect(shouldRejectByNoiseList('무역이나 금융')).toBe(true);
    expect(shouldRejectByNoiseList('더해 금융')).toBe(true);
    expect(shouldRejectByNoiseList('미친 금융')).toBe(true);
    expect(shouldRejectByNoiseList('바로 금융')).toBe(true);
    expect(shouldRejectByNoiseList('방식의 금융')).toBe(true);
    expect(shouldRejectByNoiseList('빠진 금융')).toBe(true);
    expect(shouldRejectByNoiseList('재빨리 금융')).toBe(true);
    expect(shouldRejectByNoiseList('조카의 금융')).toBe(true);
    expect(shouldRejectByNoiseList('직접적인 금융')).toBe(true);
    expect(shouldRejectByNoiseList('최악의 금융')).toBe(true);
    expect(shouldRejectByNoiseList('나라라면 투자')).toBe(true);
    expect(shouldRejectByNoiseList('낮았고 투자')).toBe(true);
    expect(shouldRejectByNoiseList('년짜리 투자')).toBe(true);
    expect(shouldRejectByNoiseList('달러만이 투자')).toBe(true);
    expect(shouldRejectByNoiseList('실제로 위기')).toBe(true);
    expect(shouldRejectByNoiseList('걸쳐 위기')).toBe(true);
    expect(shouldRejectByNoiseList('이번 위기')).toBe(true);
    expect(shouldRejectByNoiseList('현재의 위기')).toBe(true);
    expect(shouldRejectByNoiseList('이미 붕괴')).toBe(true);
    expect(shouldRejectByNoiseList('주식시장이 붕괴')).toBe(true);
    expect(shouldRejectByNoiseList('호황과 붕괴')).toBe(true);
    expect(shouldRejectByNoiseList('부문도 붕괴')).toBe(true);
    expect(shouldRejectByNoiseList('거의 붕괴')).toBe(true);
    expect(shouldRejectByNoiseList('되자 상황')).toBe(true);
    expect(shouldRejectByNoiseList('드러난 상황')).toBe(true);
    expect(shouldRejectByNoiseList('일어난 상황')).toBe(true);
    expect(shouldRejectByNoiseList('사실 상황')).toBe(true);
    expect(shouldRejectByNoiseList('시장심리가 상황')).toBe(true);
    expect(shouldRejectByNoiseList('작금의 상황')).toBe(true);
    expect(shouldRejectByNoiseList('재난 상황')).toBe(false);
    expect(shouldRejectByNoiseList('마치 성장')).toBe(true);
    expect(shouldRejectByNoiseList('빠른 성장')).toBe(true);
    expect(shouldRejectByNoiseList('빠져도 성장')).toBe(true);
    expect(shouldRejectByNoiseList('속도로 성장')).toBe(true);
    expect(shouldRejectByNoiseList('경로 성장')).toBe(false);
    expect(shouldRejectByNoiseList('전국적인 거품')).toBe(true);
    expect(shouldRejectByNoiseList('갖가지 거품')).toBe(true);
    expect(shouldRejectByNoiseList('오르면서 거품')).toBe(true);
    expect(shouldRejectByNoiseList('급진적인 개혁')).toBe(true);
    expect(shouldRejectByNoiseList('않았다 투자')).toBe(true);
    expect(shouldRejectByNoiseList('달랐다 투자')).toBe(true);
    expect(shouldRejectByNoiseList('쪼개어 투자')).toBe(true);
    expect(shouldRejectByNoiseList('터지자 투자')).toBe(true);
    expect(shouldRejectByNoiseList('해보자 투자')).toBe(true);
    expect(shouldRejectByNoiseList('휩싸인 투자')).toBe(true);
    expect(shouldRejectByNoiseList('투자 시장')).toBe(false);
    expect(shouldRejectByNoiseList('개인 투자')).toBe(false);
    expect(shouldRejectByNoiseList('설령 금융')).toBe(true);
    expect(shouldRejectByNoiseList('아니다 금융')).toBe(true);
    expect(shouldRejectByNoiseList('안겨주었다 금융')).toBe(true);
    expect(shouldRejectByNoiseList('이들 금융')).toBe(true);
    expect(shouldRejectByNoiseList('없다 금융')).toBe(true);
    expect(shouldRejectByNoiseList('휩쓴 금융')).toBe(true);
    expect(shouldRejectByNoiseList('깨뜨렸다 통화')).toBe(true);
    expect(shouldRejectByNoiseList('달리 통화')).toBe(true);
    expect(shouldRejectByNoiseList('아니다 통화')).toBe(true);
    expect(shouldRejectByNoiseList('아니면 통화')).toBe(true);
    expect(shouldRejectByNoiseList('나왔다 시장')).toBe(true);
    expect(shouldRejectByNoiseList('만들었다 시장')).toBe(true);
    expect(shouldRejectByNoiseList('오로지 시장')).toBe(true);
    expect(shouldRejectByNoiseList('있었다 시장')).toBe(true);
    expect(shouldRejectByNoiseList('좀먹고 시장')).toBe(true);
    expect(shouldRejectByNoiseList('사고 시장')).toBe(false);
    expect(isSpacedLeftJosaNoiseEojeol('속도로')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('경로')).toBe(false);
    expect(isSpacedLeftJosaNoiseEojeol('무역이나')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('나라라면')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('달러만이')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('나라의')).toBe(true);
    // 선택·열거 이든 — JSON 예외/꼬리 없이 조사 휴리스틱
    expect(isSpacedLeftJosaNoiseEojeol('이든')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('기업이든')).toBe(true);
    expect(isSpacedLeftJosaNoiseEojeol('학생이든')).toBe(true);
    expect(shouldRejectByNoiseList('기업 이든')).toBe(true);
    expect(shouldRejectByNoiseListEojeol('기업이든')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('이든')).toBe(false);
    expect(matchesNoiseListMorphTail('기업이든')).toBe(false);
  });

  it('1·2차 공통 경로 — 띄움은 리스트·휴리스틱, 붙임키는 Surface(캐나다정부 유지)', () => {
    expect(shouldRejectUnifyCandidateNoise('캐나다 정부', '캐나다정부')).toBe(
      false,
    );
    expect(shouldRejectUnifyCandidateNoise('캐나다정부', '캐나다정부')).toBe(
      false,
    );
    expect(shouldRejectUnifyCandidateNoise('붉은 표시', '붉은표시')).toBe(true);
    expect(shouldRejectUnifyCandidateNoise('쉽게 대출', '쉽게대출')).toBe(true);
    expect(shouldRejectUnifyCandidateNoise('내가 공무원')).toBe(true);
  });
});
