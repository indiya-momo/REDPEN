import { describe, expect, it } from 'vitest';
import spellingRules from '../data/spelling-rules.json';
import { b1ExpandSkipReason } from './b1StemFindsExpand.js';

/**
 * B1 finds 전개 회귀 — 커밋된 JSON 표면 (Kiwi 불필요).
 * noise-list의 unifyNoiseRegressionCorpus와 같은 역할.
 */
function b1Row(find) {
  return spellingRules.find(
    (r) => r.find === find && r.dividerGroup === 'B1',
  );
}

describe('B1 expanded finds regression (spelling-rules.json)', () => {
  it('우겨넣 — 관형 은/을 포함, replace는 어간형', () => {
    const row = b1Row('우겨넣');
    expect(row).toBeTruthy();
    expect(row.replace).toBe('욱여넣');
    expect(row.finds).toEqual(
      expect.arrayContaining(['우겨넣', '우겨넣은', '우겨넣을']),
    );
  });

  it('덮히 — 기존 finds 유지 + 덮힌', () => {
    const row = b1Row('덮히');
    expect(row?.finds).toEqual(
      expect.arrayContaining(['덮히', '덮혔', '덮혀', '덮힌']),
    );
    expect(row.replace).toBe('덮이');
  });

  // 짜여진: 자동 전개는 스킵(B1_EXPAND_FIND_SKIP)하지만 시트에 손으로 넣은 finds가 있어 여기서 확인하지 않음
  it('전개 스킵 행은 finds 자동 전개 없음', () => {
    expect(b1Row('스런')?.finds).toBeUndefined();
    expect(b1Row('꺼야')?.finds).toBeUndefined();
    expect(b1Row('안절부절하')?.finds).toBeUndefined();
    expect(b1Row('잊혀')?.finds).toBeUndefined();
    // 걸맞는: 시트에서 알맞는과 합친 찾을말>고칠말 행 — 전개는 건너뛰고 시트 finds만 남는다
    const geolmatneun = b1Row('걸맞는');
    expect(b1ExpandSkipReason(geolmatneun)).toBe('find-replaces');
    expect(geolmatneun.finds).toEqual(['걸맞는', '알맞는']);
    expect(geolmatneun.findReplaces).toEqual({ 알맞는: '알맞은' });
    expect(b1Row('오랫만')?.finds).toBeUndefined();
  });
});
