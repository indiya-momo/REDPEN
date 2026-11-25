/**
 * 제47항 사전 게이트 회귀 — A안 재조합 + stems 나열.
 *
 * 이 파일의 hit는 오직 `findNonAeoAuxSpacingHits`(모듈 id `non-aeo-aux`)만 호출한다.
 * 맞춤법 시트·다른 띄어쓰기 모듈은 끼지 않는다. 병합 후 카드 category는
 * `spacing:nonAeoAux` (= spacingCategoryForBundle('nonAeoAux')).
 *
 * 등재 판정은 현재 `stdict-verb-forms.json` 기준이다. 추출본이 갱신되어
 * 비등재로 둔 표제어가 등재되면 테스트가 깨질 수 있다(코드 회귀가 아니라 데이터 변화).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import verbForms from '../../public/data/stdict-verb-forms.json';
import bonBojoJson from '../data/bon-bojo-rules.json';
import { replaceBonBojoRulesData } from './bonBojoRules.js';
import {
  clearStdictVerbFormsCache,
  setStdictVerbFormsForTests,
  isSpaceRequiredCompoundLemma,
} from './stdictVerbForms.js';
import {
  NON_AEO_AUX_SPACING_LABEL,
  clearNonAeoAuxSpacingCache,
  findNonAeoAuxSpacingHits,
} from './nonAeoAuxSpacing.js';
import { auxOnsetsForItem } from './auxiliaryNonAeoSpace.js';
import { spacingHitsToGroups } from './spacingCategoryRegistry.js';
import { spacingCategoryForBundle } from './spacingFolderBundles.js';

const NON_AEO_MODULE_ID = 'non-aeo-aux';
const NON_AEO_CATEGORY = spacingCategoryForBundle('nonAeoAux');

/** 규칙·사전 게이트만 — 형태소는 통과 */
function permissive(text) {
  const n = String(text ?? '').length;
  const tokens = [];
  for (let i = 1; i < n; i += 1) {
    tokens.push({ str: 'e', tag: 'EC', position: i - 1, length: 1 });
    tokens.push({ str: 'v', tag: 'VX', position: i, length: 1 });
  }
  return { tokens };
}

/**
 * non-aeo-aux 모듈 hit만 → 맞춤법 탭에 붙는 것과 같은 category 그룹.
 * @param {string} text
 */
function nonAeoAuxGroups(text) {
  const raw = findNonAeoAuxSpacingHits(text, { analyze: permissive });
  return spacingHitsToGroups(
    raw.map((h) => ({
      pageNum: 1,
      index: h.index,
      matchedText: h.matchedText,
      suggestedText: h.suggestedText,
      categoryId: NON_AEO_CATEGORY,
      label: NON_AEO_AUX_SPACING_LABEL,
    })),
  ).map((g) => ({
    ...g,
    instances: g.instances.map((inst) => ({
      ...inst,
      moduleId: NON_AEO_MODULE_ID,
    })),
  }));
}

function matchedFrom(groups) {
  return groups.flatMap((g) => g.instances.map((i) => i.matchedText));
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
  clearNonAeoAuxSpacingCache();
  setStdictVerbFormsForTests(verbForms);
});

describe('nonAeoAux 사전 게이트 회귀 (A안 재조합)', () => {
  it('묶음 category·모듈 id 단언 기준이 맞다', () => {
    expect(NON_AEO_CATEGORY).toBe('spacing:nonAeoAux');
    expect(NON_AEO_MODULE_ID).toBe('non-aeo-aux');
  });

  it('추출본에 등재·비등재 표본이 실제로 갈린다(공허 통과 방지)', () => {
    expect(isSpaceRequiredCompoundLemma('올려다보다')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('내다보다')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('들여다보다')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('갖다주다')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('버려두다')).toBe(true);
    // 비등재 — 재조합해도 기본형 키가 없음(추출본 갱신 시 등재되면 이 expect가 깨짐 = 데이터 변화)
    expect(
      isSpaceRequiredCompoundLemma('먹다보다'),
      '데이터 변화? 먹다보다가 추출본에 등재됨',
    ).toBe(false);
    expect(
      isSpaceRequiredCompoundLemma('먹다가보다'),
      '데이터 변화? 먹다가보다가 추출본에 등재됨',
    ).toBe(false);
    expect(
      isSpaceRequiredCompoundLemma('먹고버리다'),
      '데이터 변화? 먹고버리다가 추출본에 등재됨',
    ).toBe(false);
  });

  it('보다 stems에 받침·축약 onset이 있다(데이터 회귀)', () => {
    expect(auxOnsetsForItem('verb-boda1')).toEqual(
      expect.arrayContaining(['보', '본', '볼', '봅', '봐', '봤']),
    );
  });

  it('등재 합성 활용형(올려다보*)은 spacing:nonAeoAux hit가 없다', () => {
    const surfaces = [
      '올려다보고',
      '올려다보니',
      '올려다본',
      '올려다볼',
      '올려다봐',
      '올려다봤',
      '올려다봅니다',
      '올려다보며',
    ];
    for (const s of surfaces) {
      const groups = nonAeoAuxGroups(s);
      expect(groups, s).toEqual([]);
    }
  });

  it('등재 합성을 문장에 넣어도 spacing:nonAeoAux hit가 없다', () => {
    expect(
      nonAeoAuxGroups(
        '창밖을 올려다보고 하늘을 내다보니 구멍을 들여다봤다.',
      ),
    ).toEqual([]);
  });

  it('비등재 붙여 씀은 findNonAeoAuxSpacingHits → spacing:nonAeoAux 만 낸다', () => {
    // 말다(먹지마) 경로가 아님 — 보다·버리다 onset + 비아/어 연결.
    // 추출본에 먹다보다·먹다가보다·먹고버리다 없음. 등재되면 위 lemma expect와 함께 깨짐(=데이터 변화).
    const cases = [
      {
        text: '먹다가보니 배가 불렀다.',
        matched: '먹다가보니',
        suggested: '먹다가 보니',
      },
      {
        text: '결국 먹고버리고 말았다.',
        matched: '먹고버리고',
        suggested: '먹고 버리고',
      },
      {
        text: '서둘러 먹으러갔다.',
        matched: '먹으러갔다',
        suggested: '먹으러 갔다',
      },
    ];
    for (const c of cases) {
      const groups = nonAeoAuxGroups(c.text);
      expect(
        groups.every((g) => g.category === NON_AEO_CATEGORY),
        c.matched,
      ).toBe(true);
      expect(
        groups.every((g) =>
          g.instances.every((i) => i.moduleId === NON_AEO_MODULE_ID),
        ),
        c.matched,
      ).toBe(true);
      expect(matchedFrom(groups), c.matched).toContain(c.matched);
      const inst = groups
        .flatMap((g) => g.instances)
        .find((i) => i.matchedText === c.matched);
      expect(inst?.suggestedText, c.matched).toBe(c.suggested);
    }
  });

  it('다른 보조용언 등재 합성(다-연결 머리)도 spacing:nonAeoAux hit가 없다', () => {
    expect(isSpaceRequiredCompoundLemma('갖다주다')).toBe(true);
    expect(isSpaceRequiredCompoundLemma('버려두다')).toBe(true);
    expect(nonAeoAuxGroups('갖다줘')).toEqual([]);
    expect(nonAeoAuxGroups('갖다줬다')).toEqual([]);
    expect(nonAeoAuxGroups('버려둬')).toEqual([]);
    expect(nonAeoAuxGroups('버려뒀다')).toEqual([]);
    expect(
      nonAeoAuxGroups('책을 갖다주고 짐을 버려둔 채로 떠났다.'),
    ).toEqual([]);
  });
});
