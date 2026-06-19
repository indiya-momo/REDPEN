import { describe, expect, it } from 'vitest';
import {
  ORBIT_CX,
  ORBIT_CY,
  ORBIT_R,
  TRAIL_DONE,
  TRAIL_PATH_LENGTH,
  applyTrailStroke,
  buildPenTransform,
  orbitPoint,
} from './momoOrbit.js';

describe('momoOrbit', () => {
  it('한 바퀴 후 시작점과 동일', () => {
    const start = orbitPoint(0);
    const end = orbitPoint(1);
    expect(end.x).toBeCloseTo(start.x, 5);
    expect(end.y).toBeCloseTo(start.y, 5);
  });

  it('4시 방향 시작 (r=39, 중심 50,48)', () => {
    const p = orbitPoint(0);
    expect(p.x).toBeCloseTo(ORBIT_CX + ORBIT_R * Math.cos(Math.PI / 4), 5);
    expect(p.y).toBeCloseTo(ORBIT_CY + ORBIT_R * Math.sin(Math.PI / 4), 5);
  });

  it('progress 0.125에서 6시 방향', () => {
    const p = orbitPoint(0.125);
    expect(p.x).toBeCloseTo(ORBIT_CX, 5);
    expect(p.y).toBeCloseTo(ORBIT_CY + ORBIT_R, 5);
  });

  it('buildPenTransform에 회전·팁 오프셋 포함', () => {
    const t = buildPenTransform(10, 20);
    expect(t).toContain('translate(10 20)');
    expect(t).toContain('rotate(-270)');
    expect(t).toContain('translate(-2.2 -26.4)');
  });

  it('applyTrailStroke — 그리는 중 dash, 완료 시 solid', () => {
    const trail = { style: {} };

    applyTrailStroke(trail, 0.5);
    expect(trail.style.strokeDasharray).toBe(`${TRAIL_PATH_LENGTH}`);
    expect(trail.style.strokeDashoffset).toBe(`${TRAIL_PATH_LENGTH * 0.5}`);

    applyTrailStroke(trail, TRAIL_DONE);
    expect(trail.style.strokeDasharray).toBe('none');
    expect(trail.style.strokeDashoffset).toBe('0');
  });
});
