import { describe, expect, it } from 'vitest';
import {
  firstGraphemeEnd,
  indentMarkGeometry,
} from './indentMarkGeometry.js';

describe('indentMarkGeometry — 오른자리 옮김표', () => {
  it('하나의 연속 path (오른쪽 연결 세로선 없음)', () => {
    const g = indentMarkGeometry({
      left: 100,
      top: 40,
      width: 20,
      height: 24,
    });
    expect(g.pathD).toBe(
      `M ${g.xR} ${g.yTop} V ${g.yArm1} H ${g.xL} V ${g.yArm2} H ${g.xR} V ${g.yBottom}`,
    );
    /* 오른쪽 xR에서 yArm1→yArm2 직통 세로가 없어야 함 */
    expect(g.pathD).not.toMatch(
      new RegExp(`M ${g.xR} ${g.yArm1} V ${g.yArm2}`),
    );
    expect(g.yArm1 - g.yTop).toBeCloseTo(g.yBottom - g.yArm2);
  });

  it('눈금은 팔 끝에서 바깥으로만', () => {
    const g = indentMarkGeometry({
      left: 50,
      top: 10,
      width: 14,
      height: 16,
    });
    expect(g.yTop).toBeLessThan(g.yArm1);
    expect(g.yBottom).toBeGreaterThan(g.yArm2);
    expect(g.xR).toBeGreaterThan(g.xL);
  });
});

describe('firstGraphemeEnd', () => {
  it('금 한 글자', () => {
    expect(firstGraphemeEnd('금관의', 0)).toBe(1);
  });
});
