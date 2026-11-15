import { describe, expect, it } from 'vitest';
import spellingRulesJson from '../data/spelling-rules.json';
import spellingMeta from '../../public/data/spelling-rules-meta.json';
import { BUILT_IN_RULES, spellingRulesFingerprint } from './builtInRules.js';
import { b1ExpandSkipReason } from './b1StemFindsExpand.js';
import { getHighlightOverlayReplace } from './highlightOverlayReplace.js';
import { runRuleCheck } from './ruleEngine.js';
import {
  findReplacesFingerprintPart,
  formatVariantPairsLabel,
  parseSpellingFindsWithReplaces,
  resolveSpellingVariant,
  sortVariantsLongestFirst,
} from './spellingFindReplaces.js';
import {
  buildSpellingCheckRuleFromBuiltIn,
  parseSpellingFindsColumn,
} from './spellingRuleEntry.js';
import { validateSpellingRules } from './validateDataJson.js';

describe('parseSpellingFindsWithReplaces', () => {
  it('찾을말>고칠말 항목을 읽고, 대표 find는 replace 열을 쓴다', () => {
    expect(
      parseSpellingFindsWithReplaces('싯구, 갯수>개수, 댓가 > 대가', '싯구', '시구'),
    ).toEqual({
      finds: ['싯구', '갯수', '댓가'],
      findReplaces: { 갯수: '개수', 댓가: '대가' },
      warnings: [],
    });
  });

  it.each(['>', '→', '＞'])('구분 기호 「%s」를 받는다', (sep) => {
    const out = parseSpellingFindsWithReplaces(`싯구, 갯수${sep}개수`, '싯구', '시구');
    expect(out.finds).toEqual(['싯구', '갯수']);
    expect(out.findReplaces).toEqual({ 갯수: '개수' });
  });

  it('대표 find가 빠져 있으면 맨 앞에 넣고, 대표 find의 다른 고칠 말은 경고 후 무시', () => {
    const out = parseSpellingFindsWithReplaces('싯구>싯귀, 갯수>개수', '싯구', '시구');
    expect(out.finds).toEqual(['싯구', '갯수']);
    expect(out.findReplaces).toEqual({ 갯수: '개수' });
    expect(out.warnings).toHaveLength(1);
    const out2 = parseSpellingFindsWithReplaces('갯수>개수', '싯구', '시구');
    expect(out2.finds).toEqual(['싯구', '갯수']);
  });

  it('고칠 말이 replace와 같거나 비면 맵에 넣지 않는다', () => {
    const out = parseSpellingFindsWithReplaces('봄 비, 여름 비>여름비, 가을 비>', '봄 비', '봄비');
    expect(out.finds).toEqual(['봄 비', '여름 비', '가을 비']);
    expect(out.findReplaces).toEqual({ '여름 비': '여름비' });
    expect(out.warnings).toHaveLength(1);
  });

  it('구분 기호가 없으면 기존 파서와 결과가 같다(하위 호환)', () => {
    for (const row of spellingRulesJson) {
      const raw = row.finds?.join(', ') ?? '';
      const out = parseSpellingFindsWithReplaces(raw, row.find, row.replace);
      expect(out.findReplaces).toBeNull();
      expect(out.finds).toEqual(parseSpellingFindsColumn(raw, row.find));
    }
  });
});

describe('찾은 말별 고칠 말 — 검사', () => {
  const sai = buildSpellingCheckRuleFromBuiltIn({
    find: '싯구',
    replace: '시구',
    finds: ['싯구', '갯수', '댓가'],
    findReplaces: { 갯수: '개수', 댓가: '대가' },
    displayLabel: '싯구 → 시구(외)',
    overlayReplace: '→시구',
    ruleId: 'sai',
    enabled: true,
    builtIn: true,
    category: 'spelling',
  });

  it('매칭마다 제 고칠 말을 제안하고, 결과 문구는 찾은 쌍만 보인다', () => {
    const { results, errors } = runRuleCheck(
      [{ pageNum: 1, text: '갯수와 싯구, 그리고 댓가. 또 갯수' }],
      [sai],
    );
    expect(errors).toEqual([]);
    expect(results).toHaveLength(1);
    const [g] = results;
    expect(g.instances.map((i) => [i.matchedText, i.suggestedText])).toEqual([
      ['갯수', '개수'],
      ['싯구', '시구'],
      ['댓가', '대가'],
      ['갯수', '개수'],
    ]);
    expect(g.label).toBe('갯수 → 개수, 싯구 → 시구, 댓가 → 대가');
    expect(g.overlayReplace).toBeUndefined();
  });

  it('하나만 찾으면 그 쌍만 보인다', () => {
    const { results } = runRuleCheck([{ pageNum: 1, text: '전체 갯수' }], [sai]);
    expect(results[0].label).toBe('갯수 → 개수');
  });

  it('PDF 오버레이는 찾은 말의 고칠 말(J 무시)', () => {
    const { results } = runRuleCheck([{ pageNum: 1, text: '댓가' }], [sai]);
    const inst = results[0].instances[0];
    expect(getHighlightOverlayReplace(inst, { group: results[0] })).toBe('→대가');
  });

  it('겹치는 변형은 긴 말이 먼저 맞는다', () => {
    const rule = buildSpellingCheckRuleFromBuiltIn({
      find: '윗',
      replace: '위',
      finds: ['윗', '윗층'],
      findReplaces: { 윗층: '위층' },
      enabled: true,
      builtIn: true,
      category: 'spelling',
    });
    expect(sortVariantsLongestFirst(['윗', '윗층'])).toEqual(['윗층', '윗']);
    const { results } = runRuleCheck([{ pageNum: 1, text: '윗층에' }], [rule]);
    expect(results[0].instances.map((i) => [i.matchedText, i.suggestedText])).toEqual([
      ['윗층', '위층'],
    ]);
    expect(resolveSpellingVariant(rule, '윗')).toEqual({ find: '윗', replace: '위' });
  });

  it('findReplaces 없는 finds 행은 기존 그대로(display_label·replace)', () => {
    const rule = buildSpellingCheckRuleFromBuiltIn({
      find: '봄 비',
      replace: '봄비',
      finds: ['봄 비', '여름 비'],
      displayLabel: '봄 비 → 봄비(외)',
      enabled: true,
      builtIn: true,
      category: 'spelling',
    });
    const { results } = runRuleCheck([{ pageNum: 1, text: '여름 비가' }], [rule]);
    expect(results[0].label).toBe('봄 비 → 봄비(외)');
    expect(results[0].instances[0].suggestedText).toBe('봄비');
    expect(results[0].instances[0].variantFind).toBeUndefined();
    expect(resolveSpellingVariant(rule, '여름 비')).toBeNull();
  });

  it('formatVariantPairsLabel는 중복을 뺀다', () => {
    expect(
      formatVariantPairsLabel([
        { variantFind: 'a', variantReplace: 'b' },
        { variantFind: 'a', variantReplace: 'b' },
        {},
      ]),
    ).toBe('a → b');
  });
});

describe('분류 이름 display_label(→ 없음) — 결과 문구', () => {
  /** @param {object} row */
  const build = (row) =>
    buildSpellingCheckRuleFromBuiltIn({ enabled: true, builtIn: true, category: 'spelling', ...row });
  /** @param {object} rule @param {string} text */
  const run = (rule, text) => runRuleCheck([{ pageNum: 1, text }], [rule]).results;

  it('붙여쓰기 행 「^중」: 결과는 찾은 변형 → 공백 뺀 말', () => {
    const rule = build({
      find: '그 중',
      replace: '그중',
      finds: ['그 중', '부재 중', '한밤 중'],
      displayLabel: '^중',
    });
    expect(rule.label).toBe('^중');
    const [g] = run(rule, '그는 부재 중이었고 그 중 하나는');
    expect(g.label).toBe('부재 중 → 부재중, 그 중 → 그중');
    expect(g.instances.map((i) => i.suggestedText)).toEqual(['부재중', '그중']);
    // PDF 오버레이는 찾은말>고칠말 전용 — 분류 이름 행은 건드리지 않음
    expect(g.instances[0].variantReplace).toBeUndefined();
  });

  it('찾을말>고칠말 행 「사잇소리」: 결과는 기존처럼 찾은 쌍', () => {
    const rule = build({
      find: '갯수',
      replace: '개수',
      finds: ['갯수', '댓가'],
      findReplaces: { 댓가: '대가' },
      displayLabel: '사잇소리',
    });
    expect(rule.label).toBe('사잇소리');
    const [g] = run(rule, '댓가와 갯수');
    expect(g.label).toBe('댓가 → 대가, 갯수 → 개수');
  });

  it('finds 없는 행 「속음八」: 결과는 find → replace', () => {
    const rule = build({ find: '초팔일', replace: '초파일', displayLabel: '속음八' });
    const [g] = run(rule, '사월 초팔일');
    expect(g.label).toBe('초팔일 → 초파일');
    expect(g.instances[0].suggestedText).toBe('초파일');
  });

  it('→가 있는 display_label 행은 결과도 기존 그대로', () => {
    const rule = build({
      find: '봄 비',
      replace: '봄비',
      finds: ['봄 비', '여름 비'],
      displayLabel: '봄 비 → 봄비(외)',
    });
    const [g] = run(rule, '여름 비가');
    expect(g.label).toBe('봄 비 → 봄비(외)');
    expect(g.instances[0].suggestedText).toBe('봄비');
    expect(g.instances[0].pairFind).toBeUndefined();
  });

  it('내장 데이터: 분류 이름 행은 결과 문구가 「찾은 말 → 고칠 말」이다', () => {
    const rows = BUILT_IN_RULES.filter(
      (r) => r.displayLabel && !r.displayLabel.includes('→') && !r.findReplaces,
    );
    for (const row of rows) {
      const rule = build(row);
      const sample = (row.finds?.length >= 2 ? row.finds : [row.find])[0];
      const res = run(rule, `앞 ${sample} 뒤`);
      if (!res.length) continue; // 경계·필터로 예문이 안 잡히는 행은 건너뜀
      expect(res[0].label).toContain(' → ');
      expect(res[0].label).not.toBe(row.displayLabel);
    }
  });
});

describe('데이터·지문·B1 전개', () => {
  it('findReplaces 없는 행은 지문이 그대로다', () => {
    const plainRows = spellingRulesJson.filter((r) => !r.findReplaces);
    expect(plainRows.length).toBeGreaterThan(0);
    // findReplaces 도입 전 지문 공식 그대로 계산한 값과 같아야 한다
    const legacyPart = (row) => {
      const finds = row.finds?.length >= 2 ? row.finds.join('\u0001') : '';
      return `${row.find}\0${row.replace}\0${row.tip ?? ''}\0${row.enabled === true ? 1 : 0}\0${
        row.countsInQuota === false ? 0 : 1
      }\0${row.visible === false ? 0 : 1}\0${row.dividerGroup ?? ''}\0${row.dividerLabel ?? ''}\0${
        row.overlayReplace ?? ''
      }\0${row.ruleId ?? ''}\0${finds}\0${row.displayLabel ?? ''}`;
    };
    let hash = 0;
    const payload = plainRows.map(legacyPart).join('\n');
    for (let i = 0; i < payload.length; i += 1) {
      hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
    }
    expect(spellingRulesFingerprint(plainRows)).toBe(`${plainRows.length}:${hash}`);
  });

  it('메타 파일 지문이 데이터(B1 전개 후)와 같다', () => {
    expect(spellingMeta.fingerprint).toBe(spellingRulesFingerprint());
    expect(spellingMeta.count).toBe(spellingRulesJson.length);
    expect(findReplacesFingerprintPart({ find: 'x' })).toBe('');
  });

  it('findReplaces가 있으면 지문이 달라진다', () => {
    const row = { find: '싯구', replace: '시구', enabled: true, finds: ['싯구', '갯수'] };
    expect(spellingRulesFingerprint([row])).not.toBe(
      spellingRulesFingerprint([{ ...row, findReplaces: { 갯수: '개수' } }]),
    );
  });

  it('빌트인 규칙에 실린다(키 정리, J 제거)', () => {
    const jsonWith = spellingRulesJson.filter((r) => r.findReplaces);
    const builtWith = BUILT_IN_RULES.filter((r) => r.findReplaces);
    expect(builtWith.length).toBe(jsonWith.length);
    for (const r of builtWith) {
      // J(overlay_replace)는 쓰지 않고, 키는 모두 finds 안의 변형
      expect(r.overlayReplace).toBeUndefined();
      expect(r.finds?.length).toBeGreaterThanOrEqual(2);
      for (const [k, v] of Object.entries(r.findReplaces)) {
        expect(r.finds).toContain(k);
        expect(k).not.toBe(r.find);
        expect(String(v).trim()).not.toBe('');
      }
    }
    for (const r of BUILT_IN_RULES.filter((x) => !x.findReplaces)) {
      const row = spellingRulesJson.find((j) => j.find === r.find && j.replace === r.replace);
      expect(row?.findReplaces).toBeUndefined();
    }
  });

  it('B1 전개는 findReplaces 행을 건너뛴다', () => {
    expect(
      b1ExpandSkipReason({
        find: '설레이',
        replace: '설레',
        dividerGroup: 'B1',
        finds: ['설레이', '되뇌이'],
        findReplaces: { 되뇌이: '되뇌' },
      }),
    ).toBe('find-replaces');
  });

  it('validate: 키가 finds에 있어야 하고 고칠 말은 비면 안 된다', () => {
    const base = { find: '싯구', replace: '시구', enabled: true, finds: ['싯구', '갯수'] };
    expect(validateSpellingRules([{ ...base, findReplaces: { 갯수: '개수' } }])).toEqual([]);
    const bad = validateSpellingRules([
      { ...base, findReplaces: { 댓가: '대가', 갯수: '', 싯구: '시귀' } },
    ]);
    expect(bad.map((i) => i.message).join('\n')).toMatch(/not in finds/);
    expect(bad.map((i) => i.message).join('\n')).toMatch(/non-empty/);
    expect(bad.map((i) => i.message).join('\n')).toMatch(/must use replace/);
    expect(
      validateSpellingRules([{ find: 'a', replace: 'b', enabled: true, findReplaces: { a: 'c' } }]).length,
    ).toBeGreaterThan(0);
  });
});
