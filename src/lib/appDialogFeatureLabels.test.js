import { describe, expect, it } from 'vitest';
import {
  APP_DIALOG_FEATURE_LABELS,
  buildAppDialogHighlightPattern,
} from './appDialogFeatureLabels.js';

describe('appDialogFeatureLabels', () => {
  it('긴 라벨이 먼저 오도록 정렬한다', () => {
    for (let i = 1; i < APP_DIALOG_FEATURE_LABELS.length; i += 1) {
      expect(APP_DIALOG_FEATURE_LABELS[i - 1].length).toBeGreaterThanOrEqual(
        APP_DIALOG_FEATURE_LABELS[i].length,
      );
    }
  });

  it('표기 통일하기를 본문에서 잡는다', () => {
    const re = buildAppDialogHighlightPattern();
    const msg = '표기 통일하기에서 통일형📌을 지정한 뒤 검수해 주세요.';
    const match = re.exec(msg);
    expect(match?.[2]).toBe('표기 통일하기');
  });

  it('≪프로젝트명≫과 항목명을 함께 잡는다', () => {
    const re = buildAppDialogHighlightPattern();
    const msg = '≪봄날≫ 맞춤법 검수를 진행할까요?';
    const first = re.exec(msg);
    expect(first?.[1]).toBe('봄날');
    const second = re.exec(msg);
    expect(second?.[2]).toBe('맞춤법 검수');
  });
});
