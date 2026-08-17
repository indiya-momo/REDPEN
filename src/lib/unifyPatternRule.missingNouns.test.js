import { describe, expect, it } from 'vitest';
import {
  isPatternRuleHeadBlacklisted,
  shouldRejectPatternMismatchByNoiseAndCompound,
  passesPatternRuleUnifyFilter,
  findPatternMismatches,
  visualAttestsPatternSurface,
} from './unifyPatternRule.js';
import { shouldRejectUnifyCandidateNoise } from './unifyNoiseList.js';

describe('missing N+N phase2 filters', () => {
  const cases = [
    ['분위기', '분위기 경제', '분위기경제'],
    ['정부', '정부 지출', '정부지출'],
    ['미국', '미국 노동통계국', '미국노동통계국'],
    ['국채', '국채 금리', '국채금리'],
    ['고전파', '고전파 경제', '고전파경제'],
  ];

  it('헤드·잡음 필터가 명사+명사를 막지 않는다', () => {
    for (const [head, spaced, glued] of cases) {
      expect(isPatternRuleHeadBlacklisted(head), `headBL ${head}`).toBe(false);
      expect(passesPatternRuleUnifyFilter(spaced), `pass ${spaced}`).toBe(true);
      expect(
        shouldRejectUnifyCandidateNoise(spaced, glued),
        `noise ${spaced}`,
      ).toBe(false);
      expect(
        shouldRejectPatternMismatchByNoiseAndCompound(spaced, glued, glued),
        `pair ${spaced}`,
      ).toBe(false);
    }
  });

  it('1차 등록 키를 skipKeys로 넣지 않으면 mismatch에 남는다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '분위기 경제와 고전파 경제를 비교한다.',
        textLayout: '분위기 경제와 고전파 경제를 비교한다.',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    // 예전 버그: registered 전체를 skipKeys에 넣으면 분위기경제가 탈락
    const withOldBug = findPatternMismatches(pages, rule, {
      skipKeys: ['분위기경제', '수석경제'],
    });
    expect(withOldBug.map((m) => m.from)).not.toContain('분위기 경제');

    // 수정: 등록 키 전체 skip 금지 — soft/시드 N+N이 2차에 남음
    const fixed = findPatternMismatches(pages, rule);
    const froms = fixed.map((m) => m.from);
    expect(froms).toContain('분위기 경제');
    expect(froms).toContain('고전파 경제');
  });

  it('confirmedKey가 분위기경제여도 띄움 어긋남은 남는다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '분위기 경제와 고전파 경제를 비교한다.',
        textLayout: '분위기 경제와 고전파 경제를 비교한다.',
      },
    ];
    // soft 1순위로 시드가 분위기경제가 된 경우(검수5에서 분위기만 빠진 원인)
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '분위기경제',
      confirmedKey: '분위기경제',
    };
    const froms = findPatternMismatches(pages, rule).map((m) => m.from);
    expect(froms).toContain('분위기 경제');
    expect(froms).toContain('고전파 경제');
  });

  it('opts.skipKeys로만 명시 제외한다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '분위기 경제와 고전파 경제를 비교한다.',
        textLayout: '분위기 경제와 고전파 경제를 비교한다.',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    const froms = findPatternMismatches(pages, rule, {
      skipKeys: ['분위기경제'],
    }).map((m) => m.from);
    expect(froms).toContain('고전파 경제');
    expect(froms).not.toContain('분위기 경제');
  });

  it('4교 실제 표면(목차·장제목)의 분위기 경제를 찾는다', () => {
    const pages = [
      {
        pageNum: 9,
        text: '장 경제 왕국 → \n장 분위기 경제 → \n장 수요와 공급',
        textLayout: '장 경제 왕국 → \n장 분위기 경제 → \n장 수요와 공급',
      },
      {
        pageNum: 10,
        text: 'PART Ⅰ. 분위기 경제\nCHAPTER 2. 분위기 경제',
        textLayout: 'PART Ⅰ. 분위기 경제\nCHAPTER 2. 분위기 경제',
      },
      {
        pageNum: 13,
        text: 'PART \nI\n분위기 경제\n',
        textLayout: 'PART \nI\n분위기 경제\n',
      },
      {
        pageNum: 18,
        text: 'CHAPTER 2\n분위기 경제\n경제학이란 무엇일까?',
        textLayout: 'CHAPTER 2\n분위기 경제\n경제학이란 무엇일까?',
      },
      {
        pageNum: 23,
        text: '우리는 분위기 경제모형을 현실 세상에도 적용할 수 있다.',
        textLayout: '우리는 분위기 경제모형을 현실 세상에도 적용할 수 있다.',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    const bun = findPatternMismatches(pages, rule).find(
      (m) => m.key === '분위기경제' || m.from === '분위기 경제',
    );
    expect(bun, JSON.stringify(findPatternMismatches(pages, rule).map((m) => m.from))).toBeTruthy();
  });

  it('layout에만 띄움·text에 붙임키 — 분위기 경제를 찾는다', () => {
    const pages = [
      {
        pageNum: 32,
        text: '이 책은 분위기경제를 설명한다.',
        textLayout: '이 책은 분위기 경제를 설명한다.',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    const froms = findPatternMismatches(pages, rule).map((m) => m.from);
    expect(froms).toContain('분위기 경제');
  });

  it('분위기와 경제·분위기·경제 제목형도 mismatch로 잡는다', () => {
    const pages = [
      {
        pageNum: 2,
        text: 'CHAPTER 2.\n분위기와 경제\n본문',
        textLayout: 'CHAPTER 2.\n분위기와 경제\n본문',
      },
      {
        pageNum: 3,
        text: 'PART I\n분위기·경제\n본문',
        textLayout: 'PART I\n분위기·경제\n본문',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    const keys = findPatternMismatches(pages, rule).map((m) => m.key);
    expect(keys).toContain('분위기경제');
  });

  it('visualAttests는 온전한 분위기 경제를 통과', () => {
    expect(
      visualAttestsPatternSurface(
        '이 책에서 분위기 경제를 다룬다.',
        '분위기 경제',
      ),
    ).toBe(true);
  });

  it('1음절+의 OCR 조각 head는 @패턴에서 제외', () => {
    expect(isPatternRuleHeadBlacklisted('분위기')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('고전파')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('년의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('련의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('나라의')).toBe(true);
    const pages = [
      {
        pageNum: 16,
        text: '…년의 경제가 성장했다.',
        textLayout: '…년의 경제가 성장했다.',
      },
    ];
    const rule = {
      id: 'suffix:경제:glued',
      template: '@경제',
      affix: '경제',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '수석경제',
      confirmedKey: '수석경제',
    };
    expect(findPatternMismatches(pages, rule).map((m) => m.from)).not.toContain(
      '년의 경제',
    );
  });
});
