import { describe, expect, it } from 'vitest';
import {
  conjugationTailsForBonBojoPattern,
  formatBonBojoDisplayLabel,
  getBonBojoMorphPattern,
  listBonBojoAuxiliaryLemmas,
  listBonBojoMorphPatternIds,
  listBonBojoMorphPatterns,
  matchesBonBojoVerbalConnectiveHeuristic,
  parseBonBojoDisplayLabel,
} from './bonBojoMorphPatterns.js';
import { shouldRejectByNoiseList } from './unifyNoiseList.js';

describe('bonBojoMorphPatterns', () => {
  it('displayLabel을 connective·auxiliary로 파싱·재조립한다 (라벨 정리용)', () => {
    expect(parseBonBojoDisplayLabel('(아/어) + 하다')).toEqual({
      connective: '아/어',
      auxiliary: '하다',
      raw: '(아/어) + 하다',
    });
    expect(formatBonBojoDisplayLabel('아/어', '하다')).toBe('(아/어) + 하다');
  });

  it('본보조 시트를 동사 연결 패턴 카탈로그로 노출한다', () => {
    const patterns = listBonBojoMorphPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(10);
    expect(patterns.every((p) => p.kind === 'auxiliary-verb')).toBe(true);

    const hada = getBonBojoMorphPattern('verb-hada');
    expect(hada?.displayLabel).toBe('(아/어) + 하다');
    expect(hada?.connective).toBe('아/어');
    expect(hada?.auxiliary).toBe('하다');
    expect(hada?.stems.some((s) => s.includes('하'))).toBe(true);

    expect(listBonBojoAuxiliaryLemmas()).toContain('하다');
    expect(listBonBojoMorphPatternIds()).toContain('verb-hada');
  });

  it('활용 꼬리는 패턴에서 만들고 단어장 표면을 나열하지 않는다', () => {
    const hada = getBonBojoMorphPattern('verb-hada');
    expect(hada).toBeTruthy();
    const tails = conjugationTailsForBonBojoPattern(hada);
    expect(tails).toContain('하다');
    expect(tails.some((t) => t.startsWith('하'))).toBe(true);
    // 기록하다 같은 완성형 어절은 꼬리 목록에 없음
    expect(tails).not.toContain('기록하다');
  });

  it('동사 연결 휴리스틱으로 가정하고·기록하여를 잡고 명사는 통과한다', () => {
    expect(matchesBonBojoVerbalConnectiveHeuristic('가정하고')).toBe(true);
    expect(matchesBonBojoVerbalConnectiveHeuristic('기록하여')).toBe(true);
    expect(matchesBonBojoVerbalConnectiveHeuristic('기록하다')).toBe(true);
    expect(matchesBonBojoVerbalConnectiveHeuristic('것이고')).toBe(true);
    expect(matchesBonBojoVerbalConnectiveHeuristic('가정')).toBe(false);
    expect(matchesBonBojoVerbalConnectiveHeuristic('공무원')).toBe(false);
  });

  it('표기통일 1차 리스트가 본보조 패턴을 재사용한다', () => {
    expect(shouldRejectByNoiseList('가정하고 공무원')).toBe(true);
    expect(shouldRejectByNoiseList('기록하여 결과')).toBe(true);
    expect(shouldRejectByNoiseList('경리 업무')).toBe(false);
  });
});
