import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_SAMPLE_PDF_DISPLAY_NAME,
  isOnboardingSamplePdfName,
} from './onboardingSamplePdf.js';

describe('onboardingSamplePdf', () => {
  it('데모 표시 이름을 인식한다', () => {
    expect(isOnboardingSamplePdfName(ONBOARDING_SAMPLE_PDF_DISPLAY_NAME)).toBe(
      true,
    );
    expect(isOnboardingSamplePdfName('onboarding-sample.pdf')).toBe(true);
    expect(isOnboardingSamplePdfName('내원고.pdf')).toBe(false);
    expect(isOnboardingSamplePdfName(null)).toBe(false);
  });
});
