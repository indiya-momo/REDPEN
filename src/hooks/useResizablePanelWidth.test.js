import { describe, expect, it } from 'vitest';
import {
  clampPanelLeftWidth,
  PANEL_LEFT_DEFAULT_WIDTH,
  PANEL_LEFT_MIN_WIDTH,
  PANEL_LEFT_MAX_WIDTH,
} from './useResizablePanelWidth.js';

describe('clampPanelLeftWidth', () => {
  it('창이 넓을 때 저장 폭을 유지한다', () => {
    expect(clampPanelLeftWidth(480, 1600)).toBe(480);
  });

  it('창이 좁아지면 우측 패널 최소 폭을 남기고 줄인다', () => {
    expect(clampPanelLeftWidth(480, 800)).toBeLessThan(480);
    expect(clampPanelLeftWidth(480, 800)).toBeGreaterThanOrEqual(
      PANEL_LEFT_MIN_WIDTH,
    );
  });

  it('창이 다시 넓어지면 선호 폭으로 복원한다', () => {
    const preferred = PANEL_LEFT_DEFAULT_WIDTH;
    const narrow = clampPanelLeftWidth(preferred, 780);
    const wide = clampPanelLeftWidth(preferred, 1600);
    expect(narrow).toBeLessThan(preferred);
    expect(wide).toBe(preferred);
  });

  it('최소·최대 폭을 넘지 않는다', () => {
    expect(clampPanelLeftWidth(200, 2000)).toBe(PANEL_LEFT_MIN_WIDTH);
    expect(clampPanelLeftWidth(900, 2000)).toBe(PANEL_LEFT_MAX_WIDTH);
  });
});
