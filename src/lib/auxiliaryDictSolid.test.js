import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { matches } from '../test/matchText.js';
import {
  auxiliaryDictSolidStdictCallCount,
  auxiliarySolidHitLabel,
  bonVerbHeadFromAuxInstance,
  clearAuxiliaryDictSolidCache,
  bonVerbCitation,
  citationOfSplitRow,
  compoundLemma,
  enrichAuxiliaryDictSolid,
  gluedCompoundLemma,
  headwordHasCompoundHyphen,
  isAuxiliaryDictSolidInstance,
  isAuxiliaryGluedDictSolidInstance,
  longCompoundSplitLemma,
  pruneCompoundHeadsFromGlueOptional,
  resetAuxiliaryDictSolidStdictCallCount,
  solidSurface,
} from './auxiliaryDictSolid.js';
import { setStdictVerbFormsForTests } from './stdictVerbForms.js';
import bonBojoJson from '../data/bon-bojo-rules.json';
import { replaceBonBojoRulesData } from './bonBojoRules.js';

/** 추출본 대신 쓰는 작은 fixture. 등재·붙임표(H∖K) 판정. */
const FIXTURE_VERB_FORMS = {
  meta: { source: 'test' },
  lemmas: {
    들어오다: ['들어오니', '들어와'],
    쉬어가다: ['쉬어가'],
    날아오르다: ['날아올라'],
    정리해주다: ['정리해줘'],
  },
  hyphenLemmasOutsideK: ['어루만지다', '생각하다', '제출하다'],
};

beforeEach(() => {
  clearAuxiliaryDictSolidCache();
  resetAuxiliaryDictSolidStdictCallCount();
  setStdictVerbFormsForTests(FIXTURE_VERB_FORMS);
});

function dictFetch(word, pos, status = 200) {
  const body =
    status === 200
      ? { channel: { item: { word, pos } } }
      : {};
  return async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  });
}

function auxGroup(itemId, label, matchedText) {
  return {
    patternKind: 'auxiliary-verb',
    bonBojoItemId: itemId,
    groupDisplayLabel: label,
    label,
    tip: '',
    instances: [{ pageNum: 1, matchedText, start: 0, end: matchedText.length }],
  };
}

function dictByQuery(map) {
  return async (url) => {
    const q = new URL(String(url), 'http://127.0.0.1').searchParams.get('q');
    const row = map[q];
    if (row?.status) {
      return {
        status: row.status,
        ok: false,
        text: async () => row.text || 'ERR',
      };
    }
    const body = row
      ? { channel: { item: { word: row.word, pos: row.pos } } }
      : { channel: {} };
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify(body),
    };
  };
}

function analyzeHead(head) {
  const stems = {
    어루만져: [
      { str: '어루만지', tag: 'VV' },
      { str: '어', tag: 'EF' },
    ],
    생각해: [
      { str: '생각', tag: 'NNG' },
      { str: '하', tag: 'XSV' },
      { str: '어', tag: 'EF' },
    ],
    가르쳐: [
      { str: '가르치', tag: 'VV' },
      { str: '어', tag: 'EF' },
    ],
    정리해: [
      { str: '정리', tag: 'NNG' },
      { str: '하', tag: 'XSV' },
      { str: '어', tag: 'EF' },
    ],
    제출해: [
      { str: '제출', tag: 'NNG' },
      { str: '하', tag: 'XSV' },
      { str: '어', tag: 'EF' },
    ],
  };
  const tokens = stems[head];
  return tokens ? { tokens } : null;
}

describe('auxiliaryDictSolid', () => {
  it('합 행은 auxDictSolid(붙임 등재)만 본다', () => {
    expect(
      isAuxiliaryGluedDictSolidInstance({
        matchedText: '들여다보니',
        auxDictSolid: true,
      }),
    ).toBe(true);
    expect(
      isAuxiliaryGluedDictSolidInstance({
        matchedText: '들어 온',
        suggestedText: '들어온',
      }),
    ).toBe(false);
    expect(
      isAuxiliaryDictSolidInstance({
        matchedText: '들어 온',
        suggestedText: '들어온',
      }),
    ).toBe(true);
  });

  it('등재 표시는 페이지를 붙여 한 줄로 쓴다', () => {
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '들어 온', suggestedText: '들어온' },
        '10P',
      ),
    ).toBe('들어 온 → 들어온 10P');
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '날아 올라', suggestedText: '날아올라' },
        '21P 1/2',
      ),
    ).toBe('날아 올라 → 날아올라 21P 1/2');
    expect(
      auxiliarySolidHitLabel(
        { matchedText: '멀리 가려고', suggestedText: '멀리 가려고' },
        '1P',
      ),
    ).toBe('');
  });

  it('들어 온 → 들어오다 / 들어온', () => {
    expect(compoundLemma('들어 온', 'verb-oda', '(아/어) + 오다')).toBe('들어오다');
    expect(solidSurface('들어 온')).toBe('들어온');
  });

  it('쉬어 가라고 → 쉬어가다 / 쉬어가라고', () => {
    expect(compoundLemma('쉬어 가라고', 'verb-gada', '(아/어) + 가다')).toBe(
      '쉬어가다',
    );
    expect(solidSurface('쉬어 가라고')).toBe('쉬어가라고');
    expect(gluedCompoundLemma('쉬어가라고', 'verb-gada', '(아/어) + 가다')).toBe(
      '쉬어가다',
    );
  });

  it('붙여 쓴 표면도 추출본 등재면 합성어로 표시한다', async () => {
    const groups = [
      auxGroup('verb-gada', '(아/어) + 가다', '쉬어가라고'),
    ];
    const next = await enrichAuxiliaryDictSolid(groups, {
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(isAuxiliaryDictSolidInstance(next[0].instances[0])).toBe(true);
    expect(next[0].instances[0].matchedText).toBe('쉬어가라고');
    expect(next[0].instances[0].tip).toBe('표준국어대사전 「쉬어가다」 등재');
    expect(auxiliaryDictSolidStdictCallCount().lastRun).toBe(0);
  });

  it('날아 올라 → 날아오르다 / 날아올라, 1차 규칙이 잡는다', () => {
    expect(compoundLemma('날아 올라', 'verb-oreuda', '(아/어) + 오르다')).toBe(
      '날아오르다',
    );
    expect(solidSurface('날아 올라')).toBe('날아올라');
    const rule = ensureDefaultAuxiliaryVerbs([]).find(
      (row) => row.bonBojoItemId === 'verb-oreuda' && row.tailWord === '아 올라',
    );
    expect(rule).toBeTruthy();
    expect(matches({ ...rule, enabled: true }, '높이 날아 올라갔다.')).toBe(true);
  });

  it('추출본 용언 등재면 수정안과 설명을 붙인다', async () => {
    const groups = [
      auxGroup('verb-oda', '(아/어) + 오다', '들어 온'),
    ];
    const next = await enrichAuxiliaryDictSolid(groups, {
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next[0].instances[0].suggestedText).toBe('들어온');
    expect(next[0].instances[0].tip).toBe('표준국어대사전 「들어오다」 등재');
    expect(auxiliaryDictSolidStdictCallCount().lastRun).toBe(0);
  });

  it('오래 들어 온 노래와 방으로 들어 온을 추출본만으로는 가르지 못한다', async () => {
    const groups = [
      {
        ...auxGroup('verb-oda', '(아/어) + 오다', '들어 온'),
        sourceText: '오래 들어 온 노래',
      },
      {
        ...auxGroup('verb-oda', '(아/어) + 오다', '들어 온'),
        sourceText: '방으로 들어 온 사람',
      },
    ];
    const next = await enrichAuxiliaryDictSolid(groups, {
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next[0].instances[0].suggestedText).toBe('들어온');
    expect(next[0].instances[0].tip).toBe('표준국어대사전 「들어오다」 등재');
    expect(next[1].instances[0].suggestedText).toBe('들어온');
    expect(next[1].sourceText).toBe('방으로 들어 온 사람');
    const stats = auxiliaryDictSolidStdictCallCount();
    expect(stats).toEqual({ lastRun: 0, session: 0 });
  });

  it('3음절 띄어쓰기 표제어는 보조 기본형을 붙인다', () => {
    expect(
      bonVerbCitation([
        { str: '어루만지', tag: 'VV' },
        { str: '어', tag: 'EF' },
      ]),
    ).toBe('어루만지다');
    expect(
      bonVerbCitation([
        { str: '생각', tag: 'NNG' },
        { str: '하', tag: 'XSV' },
        { str: '어', tag: 'EF' },
      ]),
    ).toBe('생각하다');
    expect(bonVerbCitation(null)).toBe('');
    expect(
      headwordHasCompoundHyphen([{ word: '어루-만지다', pos: '동사' }], '어루만지다'),
    ).toBe(true);
    expect(
      headwordHasCompoundHyphen([{ word: '가르치다', pos: '동사' }], '가르치다'),
    ).toBe(false);
    expect(longCompoundSplitLemma('어루만져 주세요')).toBe('어루만져주다');
    expect(longCompoundSplitLemma('생각해 보세요')).toBe('생각해보다');
    expect(longCompoundSplitLemma('만져 주세요')).toBe('');
  });

  it('citationOfSplitRow는 analyze가 null·throw여도 원본과 같이 빈 문자열이다', () => {
    expect(citationOfSplitRow({ suggestedText: '어루만져 주세요' }, analyzeHead)).toBe(
      '어루만지다',
    );
    expect(
      citationOfSplitRow({ suggestedText: '어루만져 주세요' }, () => null),
    ).toBe('');
    expect(
      citationOfSplitRow({ suggestedText: '어루만져 주세요' }, () => {
        throw new Error('kiwi down');
      }),
    ).toBe('');
    expect(citationOfSplitRow({ suggestedText: '' }, analyzeHead)).toBe('');
    expect(citationOfSplitRow({ suggestedText: '   ' }, analyzeHead)).toBe('');
  });

  it('표제어에 붙임표가 있으면 띄우고, 없으면 뺀다', async () => {
    const group = {
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      bonBojoItemId: 'verb-long-compound-split',
      tip: '띄어 씀',
      instances: [
        { matchedText: '어루만져주세요', suggestedText: '어루만져 주세요' },
        { matchedText: '생각해주세요', suggestedText: '생각해 주세요' },
        { matchedText: '가르쳐주세요', suggestedText: '가르쳐 주세요' },
      ],
    };
    const next = await enrichAuxiliaryDictSolid([group], {
      analyze: analyzeHead,
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next).toHaveLength(1);
    expect(next[0].instances).toEqual([
      { matchedText: '어루만져주세요', suggestedText: '어루만져 주세요' },
      { matchedText: '생각해주세요', suggestedText: '생각해 주세요' },
    ]);
    expect(next[0].tip).toBe('띄어 씀');
  });

  it('붙임표가 있어도 본용언+보조가 추출본에 있으면 뺀다', async () => {
    const group = {
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      instances: [
        { matchedText: '정리해주세요', suggestedText: '정리해 주세요' },
      ],
    };
    const next = await enrichAuxiliaryDictSolid([group], {
      analyze: analyzeHead,
      verbForms: {
        ...FIXTURE_VERB_FORMS,
        hyphenLemmasOutsideK: [
          ...(FIXTURE_VERB_FORMS.hyphenLemmasOutsideK ?? []),
          '정리하다',
        ],
      },
    });
    expect(next).toEqual([]);
  });

  it('키위가 없으면 3음절만으로 띄우지 않는다', async () => {
    const group = {
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      instances: [
        { matchedText: '생각해주세요', suggestedText: '생각해 주세요' },
      ],
    };
    const next = await enrichAuxiliaryDictSolid([group], {
      analyze: () => null,
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next).toEqual([]);
    expect(auxiliaryDictSolidStdictCallCount().lastRun).toBe(0);
  });

  it('H에 없으면 음절 수만으로 띄우지 않는다', async () => {
    const group = {
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      instances: [
        { matchedText: '가르쳐주세요', suggestedText: '가르쳐 주세요' },
      ],
    };
    const next = await enrichAuxiliaryDictSolid([group], {
      analyze: analyzeHead,
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next).toEqual([]);
    expect(auxiliaryDictSolidStdictCallCount().lastRun).toBe(0);
  });

  it('붙임표가 확인된 뒤 합성 표제어가 추출본에 없으면 띄운 제안을 남긴다', async () => {
    const group = {
      patternKind: 'auxiliary-verb',
      auxSplitLongCompound: true,
      instances: [
        { matchedText: '제출해주세요', suggestedText: '제출해 주세요' },
      ],
    };
    const next = await enrichAuxiliaryDictSolid([group], {
      analyze: analyzeHead,
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(next[0].instances[0].suggestedText).toBe('제출해 주세요');
  });

  it('미등재면 그대로 둔다', async () => {
    const groups = [auxGroup('verb-gada', '(아/어) + 가다', '되어 간다')];
    const missing = await enrichAuxiliaryDictSolid(groups, {
      verbForms: FIXTURE_VERB_FORMS,
    });
    expect(missing[0].instances[0].suggestedText).toBeUndefined();
    expect(missing[0].tip).toBe('');
  });

  it('줄기 기본형을 못 만들어도 활용형 유일이면 등재로 본다', async () => {
    const verbForms = { lemmas: { 들어오다: ['들어와'] } };
    setStdictVerbFormsForTests(verbForms);
    const groups = [auxGroup('verb-unknown', '(아/어) + 없다', '들어와')];
    const next = await enrichAuxiliaryDictSolid(groups, { verbForms });
    expect(next[0].instances[0].auxDictSolid).toBe(true);
    expect(next[0].instances[0].tip).toBe('표준국어대사전 「들어오다」 등재');
    expect(auxiliaryDictSolidStdictCallCount().lastRun).toBe(0);
  });

  it('붙인 표면이 활용형 유일이면 띄운 발견도 붙인다', async () => {
    const verbForms = { lemmas: { 들어오다: ['들어와'] } };
    setStdictVerbFormsForTests(verbForms);
    const groups = [auxGroup('verb-unknown', '(아/어) + 없다', '들어 와')];
    const next = await enrichAuxiliaryDictSolid(groups, { verbForms });
    expect(next[0].instances[0].suggestedText).toBe('들어와');
    expect(next[0].instances[0].tip).toBe('표준국어대사전 「들어오다」 등재');
  });


  it('본용언 머리가 띄움 필수 활용형이면 붙여쓰기 가능 칸에서 빼고, 단일어·허용 목록은 남긴다', async () => {
    const verbForms = {
      lemmas: {
        덤벼들다: ['덤벼들어'],
        깨뜨리다: ['깨뜨려'],
      },
    };
    setStdictVerbFormsForTests(verbForms);
    const groups = [
      auxGroup('verb-boda1', '(아/어) + 보다', '기다려 보았다'),
      {
        ...auxGroup('verb-boda1', '(아/어) + 보다', '기다려보았다'),
        instances: [
          {
            pageNum: 1,
            matchedText: '기다려보았다',
            suggestedText: '기다려 보았다',
            start: 0,
            end: 6,
          },
        ],
      },
      auxGroup('verb-boda1', '(아/어) + 보다', '덤벼들어 보았다'),
      {
        ...auxGroup('verb-boda1', '(아/어) + 보다', '덤벼들어보았다'),
        instances: [
          {
            pageNum: 1,
            matchedText: '덤벼들어보았다',
            suggestedText: '덤벼들어 보았다',
            start: 0,
            end: 7,
          },
        ],
      },
      auxGroup('verb-boda1', '(아/어) + 보다', '깨뜨려 보았다'),
      auxGroup('verb-boda1', '(아/어) + 보다', '걸려 보았다'),
    ];
    const next = await enrichAuxiliaryDictSolid(groups, { verbForms });
    const kept = next.flatMap((g) =>
      (g.instances ?? []).map((i) => i.matchedText),
    );
    expect(kept).toEqual([
      '기다려 보았다',
      '기다려보았다',
      '깨뜨려 보았다',
      '걸려 보았다',
    ]);
  });

  it('bon_allow에서 기다려를 빼도 단일어는 붙여쓰기 가능 칸에 남고 3음절 칸에서는 빠진다', async () => {
    const verbForms = {
      lemmas: {
        덤벼들다: ['덤벼들어'],
        깨뜨리다: ['깨뜨려'],
      },
    };
    setStdictVerbFormsForTests(verbForms);
    const original = JSON.parse(JSON.stringify(bonBojoJson));
    const reduced = JSON.parse(JSON.stringify(bonBojoJson));
    for (const group of reduced.groups ?? []) {
      if (group.id === 'verb-bon') {
        group.bonVerbAllow = (group.bonVerbAllow ?? []).filter(
          (s) => s !== '기다려' && s !== '만들어' && s !== '그러다',
        );
      }
    }
    replaceBonBojoRulesData(reduced);
    try {
      expect(bonVerbHeadFromAuxInstance({ matchedText: '기다려 보았다' })).toBe(
        '기다려',
      );
      const glue = [
        auxGroup('verb-boda1', '(아/어) + 보다', '기다려 보았다'),
        {
          ...auxGroup('verb-boda1', '(아/어) + 보다', '기다려보았다'),
          instances: [
            {
              pageNum: 1,
              matchedText: '기다려보았다',
              suggestedText: '기다려 보았다',
              start: 0,
              end: 6,
            },
          ],
        },
        auxGroup('verb-boda1', '(아/어) + 보다', '깨뜨려 보았다'),
        auxGroup('verb-boda1', '(아/어) + 보다', '덤벼들어 보았다'),
      ];
      const afterGlue = await enrichAuxiliaryDictSolid(glue, { verbForms });
      expect(
        afterGlue.flatMap((g) => (g.instances ?? []).map((i) => i.matchedText)),
      ).toEqual(['기다려 보았다', '기다려보았다', '깨뜨려 보았다']);

      const split = {
        patternKind: 'auxiliary-verb',
        auxSplitLongCompound: true,
        bonBojoItemId: 'verb-long-compound-split',
        instances: [
          { matchedText: '기다려보았다', suggestedText: '기다려 보았다' },
          { matchedText: '덤벼들어보았다', suggestedText: '덤벼들어 보았다' },
        ],
      };
      const afterSplit = await enrichAuxiliaryDictSolid([split], {
        verbForms: {
          ...verbForms,
          hyphenLemmasOutsideK: [],
        },
        analyze: (head) => {
          if (head === '기다려') {
            return { tokens: [{ str: '기다리', tag: 'VV' }, { str: '어', tag: 'EF' }] };
          }
          if (head === '덤벼들어') {
            return { tokens: [{ str: '덤벼들', tag: 'VV' }, { str: '어', tag: 'EF' }] };
          }
          return null;
        },
      });
      // 덤벼들다∈K → 붙임표 OK, 합성 표제어(덤벼들어보다)는 추출본 밖 → 띄움 제안 유지
      // 기다리다는 H 밖 → plain 제거
      expect(
        afterSplit.flatMap((g) => (g.instances ?? []).map((i) => i.matchedText)),
      ).toEqual(['덤벼들어보았다']);
    } finally {
      replaceBonBojoRulesData(original);
    }
  });

  it('pruneCompoundHeadsFromGlueOptional는 허용 목록 복합어를 남긴다', () => {
    setStdictVerbFormsForTests({
      lemmas: { 깨뜨리다: ['깨뜨려'], 덤벼들다: ['덤벼들어'] },
    });
    const pruned = pruneCompoundHeadsFromGlueOptional([
      auxGroup('verb-boda1', '(아/어) + 보다', '깨뜨려 보았다'),
      auxGroup('verb-boda1', '(아/어) + 보다', '덤벼들어 보았다'),
      auxGroup('verb-boda1', '(아/어) + 보다', '기다려 보았다'),
    ]);
    expect(
      pruned.flatMap((g) => (g.instances ?? []).map((i) => i.matchedText)),
    ).toEqual(['깨뜨려 보았다', '기다려 보았다']);
  });

  it.skipIf(
    !fs.existsSync(
      new URL('../../tmp/kiwi-models/models/cong/base/cong.mdl', import.meta.url),
    ),
  )(
    '키위 실모델은 본용언 기본형만 만든다',
    async () => {
      const { loadKiwiNode } = await import('./kiwiMorph/loadNode.js');
      const { clearKiwiInstance } = await import('./kiwiMorph/runtime.js');
      const { analyzeLine } = await import('./kiwiMorph/analyze.js');
      const kiwi = await loadKiwiNode({ register: true });
      expect(kiwi).toBeTruthy();
      try {
        expect(bonVerbCitation(analyzeLine('생각해')?.tokens)).toBe('생각하다');
        expect(bonVerbCitation(analyzeLine('정리해')?.tokens)).toBe('정리하다');
        expect(bonVerbCitation(analyzeLine('가르쳐')?.tokens)).toBe('가르치다');
        expect(bonVerbCitation(analyzeLine('어루만져')?.tokens)).toBe(
          '어루만지다',
        );
      } finally {
        clearKiwiInstance();
      }
    },
    30_000,
  );
});
