/**
 * 본조 비아/어 연결 기대값 (한글 맞춤법 제47항).
 *
 * 설계(2026-11-19 결정):
 * - 붙여 쓸 수 있는 것은 본용언 -아/-어(하다→해, 써·봐·줘 같은 축약 포함) + 보조용언뿐.
 * - 다른 연결(-다(가), -(으)라, -(으)러, -지, -게, -고, -도록, -었다 …)은
 *   붙여 쓰면 맞춤법 탭 「띄어쓰기」 폴더(`nonAeoAuxSpacing.js`)가 띄움 hit를 내고,
 *   본조 탭에는 카드가 없다. 띄어 쓰면 어느 탭에도 없다.
 *   단, 붙인 전체가 표준국어대사전 한 단어(내다보다·들여다보다)면 본조 기존 처리 유지.
 * - 라/러는 기본 비아/어. 르 불규칙(따라·흘러·불러 …)·러 불규칙(이르러·푸르러)일 때만 -아/-어.
 *
 * 케이스 원본: `__fixtures__/auxiliaryNonAeoExpect.cases.json`
 * 픽스처 `expected`가 `space-required-non-aeo`인 것(옛 본조 띄움 필수 줄)은
 * 이제 「본조 카드 없음 + 띄어쓰기 폴더 hit」로 읽는다. 나머지 기대값은 본조 그대로, 띄어쓰기 hit 없음.
 * 본조 파이프라인: runRuleCheck → finalize → enrichAuxiliaryGluedFromSpaced
 *   → enrichAuxiliaryNonAeoSpace → enrichAuxiliaryDictSolid → finalize
 * 띄어쓰기 폴더: findNonAeoAuxSpacingHits(페이지 텍스트)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import casesJson from './__fixtures__/auxiliaryNonAeoExpect.cases.json';
import bonBojoJson from '../data/bon-bojo-rules.json';
import verbForms from '../../public/data/stdict-verb-forms.json';
import { bonBojoUiGroupForItemId, replaceBonBojoRulesData } from './bonBojoRules.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
import { runRuleCheck } from './ruleEngine.js';
import { enrichAuxiliaryDictSolid } from './auxiliaryDictSolid.js';
import { enrichAuxiliaryGluedFromSpaced } from './auxiliaryGluedFromSpaced.js';
import { enrichAuxiliaryNonAeoSpace } from './auxiliaryNonAeoSpace.js';
import { finalizeConsistencyCheckResults } from './checkResultUtils.js';
import { setStdictVerbFormsForTests } from './stdictVerbForms.js';
import {
  clearNonAeoAuxSpacingCache,
  findNonAeoAuxSpacingHits,
} from './nonAeoAuxSpacing.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { loadKiwiNode, resolveKiwiNodePaths } from './kiwiMorph/loadNode.js';

/** 옛 본조 띄움 필수 줄 기대값 → 이제 띄어쓰기 폴더 */
const MOVED_TO_SPACING = 'space-required-non-aeo';

/**
 * 아직 고치지 않는 것(데이터·별건). 카드 종류/solid를 검사하지 않고 건너뛴다.
 * @type {Record<string, string>}
 */
const PENDING = {};

/**
 * 카드 종류는 맞고 solid 표시만 아직 다른 것.
 * @type {Record<string, string>}
 */
const PENDING_SOLID = {
  'aeo-boda-hae-gl': '세 글자 사전 단어(해-보다) solid 표시 누락 — 별건',
  'jida-aeo-keo-gl': '세 글자 사전 단어(커-지다) solid 표시 누락 — 별건',
};

/** 형태소 분석 대역: 첫 어절은 VV, 나머지는 VX. 형태소 필터를 통과시키기 위함. */
function analyze(text) {
  const parts = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const hangul = (s) => s.replace(/[^\uAC00-\uD7A3]/g, '');
  const first = hangul(parts[0] ?? '');
  if (!first) return null;
  const tokens = [{ str: first, tag: 'VV' }];
  const tail = hangul(parts.slice(1).join(''));
  if (tail) tokens.push({ str: tail, tag: 'VX' });
  return { tokens };
}

/**
 * 띄어쓰기 폴더 형태소 대역: 모든 자리에 「어미(E) 끝 → 용언(VX) 시작」을 둔다.
 * 규칙(연결형·onset·사전) 판정만 보려는 것. 실제 Kiwi 판정은 아래 「실제 Kiwi」 묶음이 본다.
 */
function permissiveSpacingAnalyze(text) {
  const n = String(text ?? '').length;
  const tokens = [];
  for (let i = 1; i < n; i += 1) {
    tokens.push({ str: 'e', tag: 'EC', position: i - 1, length: 1 });
    tokens.push({ str: 'v', tag: 'VX', position: i, length: 1 });
  }
  return { tokens };
}

/** 긴 합성어 붙임표 조회 대역: 결과 없음(네트워크 호출 금지). */
async function fetchImpl() {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ channel: { item: [] } }),
  };
}

function enabledAuxRules() {
  return ensureDefaultAuxiliaryVerbs([]).map((r) =>
    r.patternKind === 'auxiliary-verb' ? { ...r, enabled: true } : r,
  );
}

function sentencePeriod(text) {
  const t = String(text ?? '').trim();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

function rowsFrom(results) {
  const rows = [];
  for (const g of results ?? []) {
    if (g?.patternKind !== 'auxiliary-verb') continue;
    const itemId = String(g.bonBojoItemId ?? '');
    for (const inst of g.instances ?? []) {
      const matched = String(inst?.matchedText ?? '');
      if (!matched) continue;
      rows.push({
        itemId,
        ui: bonBojoUiGroupForItemId(itemId),
        split: Boolean(g.auxSplitLongCompound),
        matched,
        suggested: String(inst?.suggestedText ?? ''),
        solid: Boolean(inst?.auxDictSolid),
        pageNum: Number(inst?.pageNum ?? 0),
      });
    }
  }
  return rows;
}

function spanHits(span, matched) {
  const s = String(span ?? '');
  const m = String(matched ?? '');
  return Boolean(s && m) && (s.includes(m) || m.includes(s));
}

/**
 * 같은 쪽 발견 중 기대 구간과 겹치는 것만 본다. 긴 합성어 분리 줄은 뒤로.
 * 구간 밖 발견(예: '해가 졌다'의 '해가' — 실제로는 형태소 필터가 명사로 거름)은 이 표의 대상이 아니다.
 */
function pickPrimary(findings, span) {
  const pool = findings.filter((f) => spanHits(span, f.matched));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    if (a.split !== b.split) return a.split ? 1 : -1;
    return b.matched.length - a.matched.length;
  })[0];
}

const cases = casesJson.cases;

/**
 * @param {{ index: number, matchedText: string, suggestedText: string }[]} hits
 * @param {string} pageText
 * @param {string} span
 */
function spacingHitsInSpan(hits, pageText, span) {
  const at = pageText.indexOf(span);
  if (at < 0) return [];
  const end = at + span.length;
  return hits.filter((h) => h.index < end && at < h.index + h.matchedText.length);
}

/** @param {{ index: number, matchedText: string, suggestedText: string }} hit */
function expectSpacedSuggestion(hit) {
  expect(hit.suggestedText).toContain(' ');
  expect(hit.suggestedText.replace(/\s+/g, '')).toBe(hit.matchedText);
}

describe('본조 비아/어 연결 기대값 (제47항)', () => {
  /** @type {Map<number, ReturnType<typeof rowsFrom>>} */
  const byPage = new Map();
  /** @type {Map<number, { index: number, matchedText: string, suggestedText: string }[]>} */
  const spacingByPage = new Map();
  /** @type {{ pageNum: number, text: string }[]} */
  let pages = [];

  beforeAll(async () => {
    setStdictVerbFormsForTests(verbForms);
    replaceBonBojoRulesData(JSON.parse(JSON.stringify(bonBojoJson)));
    clearNonAeoAuxSpacingCache();
    pages = cases.map((c, i) => ({ pageNum: i + 1, text: sentencePeriod(c.text) }));
    const rules = enabledAuxRules();
    const { results: grouped, errors } = runRuleCheck(pages, rules);
    expect(errors ?? []).toEqual([]);
    const final = finalizeConsistencyCheckResults(
      await enrichAuxiliaryDictSolid(
        await enrichAuxiliaryNonAeoSpace(
          await enrichAuxiliaryGluedFromSpaced(
            finalizeConsistencyCheckResults(grouped, rules),
            pages,
            { rules, analyze },
          ),
          pages,
          { rules, fetchImpl },
        ),
        { analyze, verbForms, fetchImpl },
      ),
      rules,
    );
    for (const row of rowsFrom(final)) {
      const list = byPage.get(row.pageNum) ?? [];
      list.push(row);
      byPage.set(row.pageNum, list);
    }
    for (const page of pages) {
      spacingByPage.set(
        page.pageNum,
        findNonAeoAuxSpacingHits(page.text, { analyze: permissiveSpacingAnalyze }),
      );
    }
  }, 180_000);

  afterAll(() => {
    replaceBonBojoRulesData(bonBojoJson);
    clearNonAeoAuxSpacingCache();
  });

  it('케이스 113개', () => {
    expect(cases).toHaveLength(113);
  });

  cases.forEach((c, i) => {
    const moved = c.expected === MOVED_TO_SPACING;
    const bonExpected = moved ? 'none' : c.expected;
    const title = `${c.id}: ${c.text} → 본조 ${bonExpected}${c.expectedSolid === true ? '·solid' : ''}${moved ? ' + 띄어쓰기 폴더' : ''}`;
    if (PENDING[c.id]) {
      it.skip(`[보류] ${title} — ${PENDING[c.id]}`, () => {});
      return;
    }
    it(title, () => {
      const findings = byPage.get(i + 1) ?? [];
      const primary = pickPrimary(findings, c.span);
      const got = primary ? primary.ui : 'none';
      expect(
        got,
        `${c.text}: ${JSON.stringify(findings.map((f) => [f.itemId, f.matched, f.suggested, f.solid]))}`,
      ).toBe(bonExpected);
      if (got !== 'none' && c.expectedSolid != null && !PENDING_SOLID[c.id]) {
        expect(Boolean(primary.solid), `${c.text} solid`).toBe(c.expectedSolid);
      }
      // 본조 탭에 비아/어 띄움 필수 줄이 남지 않는다(두 탭 중복 방지).
      expect(findings.filter((f) => f.ui === MOVED_TO_SPACING)).toEqual([]);

      const page = pages[i];
      const inSpan = spacingHitsInSpan(spacingByPage.get(i + 1) ?? [], page.text, c.span);
      if (moved) {
        expect(inSpan, `${c.text} 띄어쓰기 폴더 hit`).toHaveLength(1);
        expectSpacedSuggestion(inSpan[0]);
      } else {
        expect(inSpan, `${c.text} 띄어쓰기 폴더 hit 없음`).toEqual([]);
      }
    });
  });
});

/**
 * 실제 Kiwi 형태소로 띄어쓰기 폴더 판정 — 모델 있을 때만(tmp/kiwi-models).
 * 대역 없이 문장 전체를 훑어, 기대 구간 밖 오탐도 없어야 한다.
 */
const kiwiReady = resolveKiwiNodePaths().ready;

describe.skipIf(!kiwiReady)('비아/어 띄어쓰기 폴더 — 실제 Kiwi', () => {
  /** @type {unknown} */
  let kiwi = null;

  beforeAll(async () => {
    setStdictVerbFormsForTests(verbForms);
    replaceBonBojoRulesData(JSON.parse(JSON.stringify(bonBojoJson)));
    clearNonAeoAuxSpacingCache();
    kiwi = await loadKiwiNode({ register: false });
  }, 60_000);

  afterAll(() => {
    replaceBonBojoRulesData(bonBojoJson);
    clearNonAeoAuxSpacingCache();
  });

  cases.forEach((c) => {
    const moved = c.expected === MOVED_TO_SPACING;
    it(`${c.id}: ${c.text} → ${moved ? '띄움 hit' : 'hit 없음'}`, () => {
      const text = sentencePeriod(c.text);
      const hits = findNonAeoAuxSpacingHits(text, {
        analyze: (t) => analyzeLine(t, { kiwi }),
      });
      const inSpan = spacingHitsInSpan(hits, text, c.span);
      if (moved) {
        expect(inSpan, JSON.stringify(hits)).toHaveLength(1);
        expectSpacedSuggestion(inSpan[0]);
        expect(hits, JSON.stringify(hits)).toHaveLength(1);
      } else {
        expect(hits, JSON.stringify(hits)).toEqual([]);
      }
    });
  });
});
