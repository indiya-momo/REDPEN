import { describe, expect, it } from 'vitest';
import { isAeoRaReoHead } from './auxiliaryConnective.js';

describe('auxiliaryConnective — 라/러 어절의 -아/-어 판정', () => {
  it('르 불규칙 -아/-어는 -아/-어로 본다 (잘라·얼러 포함)', () => {
    for (const head of ['잘라', '얼러', '골라', '흘러', '불러', '따라', '이르러']) {
      expect(isAeoRaReoHead(head), head).toBe(true);
    }
  });

  it('으 탈락 -라/-러는 비아/어로 본다', () => {
    for (const head of ['하라', '가라', '하러', '놀러', '먹으라', '먹으러']) {
      expect(isAeoRaReoHead(head), head).toBe(false);
    }
  });
});
