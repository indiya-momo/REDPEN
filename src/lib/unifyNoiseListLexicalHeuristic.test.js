import { describe, expect, it } from 'vitest';
import {
  isSpacedAdverbGeNoiseEojeol,
  isSpacedAdverbHiNoiseEojeol,
  isSpacedClosedConjunctionNoiseEojeol,
  SPACED_ADVERB_GE_NOUN_EXCLUDE,
  SPACED_CLOSED_CONJUNCTIONS,
} from './unifyNoiseListLexicalHeuristic.js';
import { shouldRejectByNoiseList } from './unifyNoiseList.js';
import { hasUnifyNoiseDenyEojeol } from './unifyNoiseListData.js';

describe('unifyNoiseListLexicalHeuristic', () => {
  it('접속 닫힌 Set — 순접·역접·인과·전환 등', () => {
    for (const w of [
      '그리고',
      '또한',
      '그러나',
      '하지만',
      '그런데',
      '그래서',
      '그러므로',
      '따라서',
      '그러면',
      '한편',
      '결국',
      '즉',
      '우선',
      '먼저',
      '게다가',
      '뿐만',
      '단',
      '또',
      '그럼',
    ]) {
      expect(SPACED_CLOSED_CONJUNCTIONS.has(w), w).toBe(true);
      expect(isSpacedClosedConjunctionNoiseEojeol(w), w).toBe(true);
      expect(hasUnifyNoiseDenyEojeol(w), w).toBe(false);
    }
    expect(isSpacedClosedConjunctionNoiseEojeol('경리')).toBe(false);
    expect(shouldRejectByNoiseList('그런데 시장')).toBe(true);
    expect(shouldRejectByNoiseList('시장 그리고')).toBe(true);
    expect(shouldRejectByNoiseList('그러나 정책')).toBe(true);
    expect(shouldRejectByNoiseList('정책 따라서')).toBe(true);
    expect(shouldRejectByNoiseList('또한 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
  });

  it('부사 -히 (Kiwi MAG) — 예외 JSON 없이도 DROP', () => {
    expect(isSpacedAdverbHiNoiseEojeol('꾸준히')).toBe(true);
    expect(isSpacedAdverbHiNoiseEojeol('신속히')).toBe(true);
    expect(isSpacedAdverbHiNoiseEojeol('간단히')).toBe(true);
    expect(isSpacedAdverbHiNoiseEojeol('히')).toBe(false);
    expect(isSpacedAdverbHiNoiseEojeol('주식')).toBe(false);
    expect(hasUnifyNoiseDenyEojeol('꾸준히')).toBe(false);
    expect(hasUnifyNoiseDenyEojeol('신속히')).toBe(false);
    expect(shouldRejectByNoiseList('꾸준히 성장')).toBe(true);
    expect(shouldRejectByNoiseList('신속히 자금')).toBe(true);
  });

  it('부사 -게 — 가게·집게만 제외 (단계는 계)', () => {
    expect(isSpacedAdverbGeNoiseEojeol('쉽게')).toBe(true);
    expect(isSpacedAdverbGeNoiseEojeol('빠르게')).toBe(true);
    expect(isSpacedAdverbGeNoiseEojeol('높게')).toBe(true);
    expect(isSpacedAdverbGeNoiseEojeol('게')).toBe(false);
    expect(isSpacedAdverbGeNoiseEojeol('단계')).toBe(false);
    expect(isSpacedAdverbGeNoiseEojeol('가게')).toBe(false);
    expect(isSpacedAdverbGeNoiseEojeol('집게')).toBe(false);
    expect(SPACED_ADVERB_GE_NOUN_EXCLUDE.has('가게')).toBe(true);
    expect(SPACED_ADVERB_GE_NOUN_EXCLUDE.has('집게')).toBe(true);
    expect(hasUnifyNoiseDenyEojeol('쉽게')).toBe(false);
    expect(shouldRejectByNoiseList('쉽게 대출')).toBe(true);
    expect(shouldRejectByNoiseList('빠르게 성장')).toBe(true);
    expect(shouldRejectByNoiseList('가게 주인')).toBe(false);
    expect(shouldRejectByNoiseList('집게 도구')).toBe(false);
    expect(shouldRejectByNoiseList('성장 단계')).toBe(false);
  });

  it('중복 예외 제거분 — 관형·꼬리로 유지', () => {
    expect(hasUnifyNoiseDenyEojeol('과열된')).toBe(false);
    expect(hasUnifyNoiseDenyEojeol('야기시킨')).toBe(false);
    expect(shouldRejectByNoiseList('과열된 시장')).toBe(true);
    expect(shouldRejectByNoiseList('야기시킨 공무원')).toBe(true);
  });
});
