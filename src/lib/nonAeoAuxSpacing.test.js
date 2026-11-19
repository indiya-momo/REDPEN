import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import verbForms from '../../public/data/stdict-verb-forms.json';
import bonBojoJson from '../data/bon-bojo-rules.json';
import { replaceBonBojoRulesData } from './bonBojoRules.js';
import {
  clearStdictVerbFormsCache,
  setStdictVerbFormsForTests,
} from './stdictVerbForms.js';
import {
  NON_AEO_AUX_SPACING_LABEL,
  clearNonAeoAuxSpacingCache,
  collectNonAeoAuxCandidates,
  findNonAeoAuxSpacingHits,
  hasExplicitNonAeoConnective,
  isConfirmedNonAeoAuxMorph,
  listNonAeoAuxOnsets,
} from './nonAeoAuxSpacing.js';
import { SPACING_CATEGORY_DEFS } from './spacingCategoryRegistry.js';
import {
  defaultSpacingFolderEnabled,
  getSpacingFolderBundle,
  normalizeSpacingFolderEnabled,
} from './spacingFolderBundles.js';
import { mergeSpacingFolderIntoSpellingResults } from './spacingFolderCheck.js';
import { loadKiwiNode, resolveKiwiNodePaths } from './kiwiMorph/loadNode.js';
import { clearKiwiInstance } from './kiwiMorph/runtime.js';

/** 규칙만 보는 형태소 대역 — 모든 자리에 「어미 끝 → 보조용언 시작」 */
function permissive(text) {
  const n = String(text ?? '').length;
  const tokens = [];
  for (let i = 1; i < n; i += 1) {
    tokens.push({ str: 'e', tag: 'EC', position: i - 1, length: 1 });
    tokens.push({ str: 'v', tag: 'VX', position: i, length: 1 });
  }
  return { tokens };
}

beforeAll(() => {
  replaceBonBojoRulesData(JSON.parse(JSON.stringify(bonBojoJson)));
  clearNonAeoAuxSpacingCache();
});

afterAll(() => {
  replaceBonBojoRulesData(bonBojoJson);
  clearNonAeoAuxSpacingCache();
  clearStdictVerbFormsCache();
});

beforeEach(() => {
  setStdictVerbFormsForTests(verbForms);
});

describe('nonAeoAuxSpacing 후보', () => {
  it('시트 보조용언 onset을 쓴다(말다·보다·가다·있다)', () => {
    const onsets = listNonAeoAuxOnsets().map((o) => o.onset);
    for (const o of ['마', '말', '보', '가', '있', '버리', '하', '지']) {
      expect(onsets).toContain(o);
    }
  });

  it('명시적 비아/어 연결어미만 본용언으로 본다', () => {
    expect(hasExplicitNonAeoConnective('먹지')).toBe(true);
    expect(hasExplicitNonAeoConnective('먹다가')).toBe(true);
    expect(hasExplicitNonAeoConnective('먹으러')).toBe(true);
    expect(hasExplicitNonAeoConnective('놀러')).toBe(true);
    expect(hasExplicitNonAeoConnective('기다렸다')).toBe(true);
    // -아/-어
    expect(hasExplicitNonAeoConnective('먹어')).toBe(false);
    expect(hasExplicitNonAeoConnective('따라')).toBe(false);
    expect(hasExplicitNonAeoConnective('흘러')).toBe(false);
    // 연결어미 꼴이 아님(명사 등)
    expect(hasExplicitNonAeoConnective('학교')).toBe(false);
  });

  it('붙여 쓴 비아/어+보조 → 띄움 제안', () => {
    const text = '먹지마. 하지마라. 먹다보니 먹으러갔다 먹고버리다 기다렸다보니';
    const got = collectNonAeoAuxCandidates(text).map((c) => c.suggestedText);
    expect(got).toEqual(
      expect.arrayContaining([
        '먹지 마',
        '하지 마라',
        '먹다 보니',
        '먹으러 갔다',
        '먹고 버리다',
        '기다렸다 보니',
      ]),
    );
  });

  it('먹다가보니는 먹다가|보니를 먼저 둔다', () => {
    const c = collectNonAeoAuxCandidates('먹다가보니.');
    expect(c[0].suggestedText).toBe('먹다가 보니');
  });

  it('-다가 연결어미(먹다가·놀다간)는 가다로 보지 않는다', () => {
    expect(collectNonAeoAuxCandidates('먹다가 놀다간 하다가도')).toEqual([]);
    expect(
      collectNonAeoAuxCandidates('놀다갔다').map((c) => c.suggestedText),
    ).toContain('놀다 갔다');
  });

  it('띄어 쓴 것·-아/-어·제47항(듯하다·만하다) 붙임은 후보가 아니다', () => {
    const text =
      '먹지 마 먹다 보니 먹어보다 해봐 줘봐 공부하다 비가올듯하다 도울만하다 아는체하다 할법하다';
    expect(collectNonAeoAuxCandidates(text)).toEqual([]);
  });

  it('영숫자 붙은 어절·경계 아닌 꼬리는 보지 않는다', () => {
    expect(collectNonAeoAuxCandidates('A먹지마')).toEqual([]);
    expect(collectNonAeoAuxCandidates('먹지마)')).toEqual([]);
  });
});

describe('nonAeoAuxSpacing 형태소 확인', () => {
  it('어미가 본용언 끝에서 끝나고 그 자리에서 용언이 시작해야 한다', () => {
    // 먹/VV 다/EC 보/VX 니/EC
    const ok = {
      tokens: [
        { str: '먹', tag: 'VV', position: 0, length: 1 },
        { str: '다', tag: 'EC', position: 1, length: 1 },
        { str: '보', tag: 'VX', position: 2, length: 1 },
        { str: '니', tag: 'EC', position: 3, length: 1 },
      ],
    };
    expect(isConfirmedNonAeoAuxMorph(ok, 2)).toBe(true);
    // 먹/VV 지/EC 가/JX — 먹지가
    const josa = {
      tokens: [
        { str: '먹', tag: 'VV', position: 0, length: 1 },
        { str: '지', tag: 'EC', position: 1, length: 1 },
        { str: '가', tag: 'JX', position: 2, length: 1 },
      ],
    };
    expect(isConfirmedNonAeoAuxMorph(josa, 2)).toBe(false);
    // 바다/NNG 보다/JKB
    const noun = {
      tokens: [
        { str: '바다', tag: 'NNG', position: 0, length: 2 },
        { str: '보다', tag: 'JKB', position: 2, length: 2 },
      ],
    };
    expect(isConfirmedNonAeoAuxMorph(noun, 2)).toBe(false);
    // 분석 없음 → fail-closed
    expect(isConfirmedNonAeoAuxMorph(null, 2)).toBe(false);
  });
});

describe('findNonAeoAuxSpacingHits', () => {
  it('사전 한 단어(내다보다·들여다보다)는 내지 않는다', () => {
    expect(
      findNonAeoAuxSpacingHits('창밖을 내다보다. 구멍을 들여다보다.', {
        analyze: permissive,
      }),
    ).toEqual([]);
  });

  it('어절마다 hit 하나 · index는 어절 시작', () => {
    const text = '그만 먹지마. 먹다가보니 배가 불렀다.';
    const hits = findNonAeoAuxSpacingHits(text, { analyze: permissive });
    expect(hits).toEqual([
      { index: 3, matchedText: '먹지마', suggestedText: '먹지 마' },
      { index: 8, matchedText: '먹다가보니', suggestedText: '먹다가 보니' },
    ]);
  });

  it('형태소 분석이 없으면 내지 않는다(fail-closed)', () => {
    expect(findNonAeoAuxSpacingHits('먹지마.', { analyze: () => null })).toEqual([]);
  });

  it('사전 추출본이 아직 없으면 내지 않는다', () => {
    clearStdictVerbFormsCache();
    expect(findNonAeoAuxSpacingHits('먹지마.', { analyze: permissive })).toEqual([]);
  });
});

describe('띄어쓰기 폴더 등록', () => {
  it('registry·묶음에 non-aeo-aux가 있고 묶음은 기본 켜짐', () => {
    const def = SPACING_CATEGORY_DEFS.find((d) => d.id === 'non-aeo-aux');
    expect(def?.label).toBe(NON_AEO_AUX_SPACING_LABEL);
    expect(typeof def?.findHits).toBe('function');
    expect(getSpacingFolderBundle('nonAeoAux')?.moduleIds).toEqual([
      'non-aeo-aux',
    ]);
    expect(defaultSpacingFolderEnabled().nonAeoAux).toBe(true);
    // 옛 저장(키 없음)도 켜짐, 사용자가 끈 것은 유지
    expect(normalizeSpacingFolderEnabled({ numberUnit: true }).nonAeoAux).toBe(true);
    expect(normalizeSpacingFolderEnabled({ nonAeoAux: false }).nonAeoAux).toBe(false);
  });
});

const kiwiReady = resolveKiwiNodePaths().ready;

describe.skipIf(!kiwiReady)('맞춤법 탭 병합 — 실제 Kiwi', () => {
  beforeAll(async () => {
    await loadKiwiNode();
  }, 60_000);

  afterAll(() => {
    clearKiwiInstance();
  });

  it('nonAeoAux 묶음 hit가 spacing:nonAeoAux 카드로 붙는다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '그러다보니 바다보다 넓었다. 사고가 났다. 먹지가 않다. 먹으러갔다.',
      },
    ];
    const groups = mergeSpacingFolderIntoSpellingResults(pages, [], {
      nonAeoAux: true,
    });
    expect(groups.every((g) => g.category === 'spacing:nonAeoAux')).toBe(true);
    expect(
      groups.flatMap((g) => g.instances.map((i) => [i.matchedText, i.suggestedText])),
    ).toEqual([
      ['그러다보니', '그러다 보니'],
      ['먹으러갔다', '먹으러 갔다'],
    ]);
  });

  it('시트 결과와 겹치면 띄어쓰기 폴더 hit를 뺀다', () => {
    const pages = [{ pageNum: 1, text: '먹으러갔다.' }];
    const sheet = [
      {
        category: 'spelling',
        instances: [{ pageNum: 1, index: 0, matchedText: '먹으러갔다' }],
      },
    ];
    expect(
      mergeSpacingFolderIntoSpellingResults(pages, sheet, { nonAeoAux: true }),
    ).toEqual([]);
  });
});
