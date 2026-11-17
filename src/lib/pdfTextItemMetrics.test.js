import { describe, expect, it } from 'vitest';
import {
  charOffsetsInItem,
  fallbackCharEm,
} from './pdfTextItemMetrics.js';

describe('charOffsetsInItem', () => {
  it('한글·공백 비율로 item.width를 나눠 균등 분할과 달라진다', () => {
    const str = '약사여래불 사이를 뛰어다니며 엄마의 뛰지말라는';
    const width = 200;
    const off = charOffsetsInItem(str, width, 10, fallbackCharEm);
    expect(off[0]).toBe(0);
    expect(off[off.length - 1]).toBeCloseTo(width, 5);

    const at = str.indexOf('뛰지말');
    expect(at).toBeGreaterThan(0);
    const equal = (at / str.length) * width;
    const proportional = off[at];
    // 앞쪽 공백이 좁게 잡혀 균등보다 한글 구간이 앞당겨짐
    expect(proportional).toBeLessThan(equal);
  });

  it('한 item 전체 구간은 [0, item.width]이고 길이는 str.length+1', () => {
    const str = '약사여래불 사이를';
    const width = 263.443;
    const off = charOffsetsInItem(str, width, 10, fallbackCharEm);
    expect(off).toHaveLength(str.length + 1);
    expect(off[0]).toBe(0);
    expect(off[str.length]).toBeCloseTo(width, 5);
  });

  it('인접 구간 오프셋이 겹치거나 틈 없이 이어진다', () => {
    const str = '뛰지말라는';
    const width = 50;
    const off = charOffsetsInItem(str, width, 10, fallbackCharEm);
    for (let i = 0; i < str.length; i += 1) {
      expect(off[i + 1]).toBeGreaterThanOrEqual(off[i]);
    }
    expect(off[2]).toBeCloseTo(off[0] + (off[2] - off[0]), 10);
    expect(off[5] - off[2]).toBeCloseTo(width - off[2], 10);
  });

  it('한글만 있으면 균등 분할과 같다 (전각 폰트 한계)', () => {
    const str = '뛰지말라는';
    const width = 82.33;
    const off = charOffsetsInItem(str, width, 10, fallbackCharEm);
    for (let i = 0; i <= str.length; i += 1) {
      expect(off[i]).toBeCloseTo((i / str.length) * width, 5);
    }
  });

  it('뛰지|말 경계(s=2)가 말|라(s=3)보다 앞이다', () => {
    const str = '뛰지말라는';
    const width = 50;
    const off = charOffsetsInItem(str, width, 10, fallbackCharEm);
    expect(off[2]).toBeLessThan(off[3]);
    expect(off[2]).toBeCloseTo((2 / 5) * width, 5);
  });
});
