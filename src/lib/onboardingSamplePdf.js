/**
 * 온보딩 가이드용 데모 원고 (public/demo)
 */

export const ONBOARDING_SAMPLE_PDF_PATH = '/demo/onboarding-sample.pdf';

/** UI·세션에 보이는 파일명 */
export const ONBOARDING_SAMPLE_PDF_DISPLAY_NAME = '데모 원고.pdf';

/**
 * @param {string | null | undefined} fileName
 */
export function isOnboardingSamplePdfName(fileName) {
  const name = String(fileName ?? '').trim();
  if (!name) return false;
  return (
    name === ONBOARDING_SAMPLE_PDF_DISPLAY_NAME ||
    name === 'onboarding-sample.pdf'
  );
}

/**
 * @returns {Promise<File>}
 */
export async function fetchOnboardingSamplePdfFile() {
  const res = await fetch(ONBOARDING_SAMPLE_PDF_PATH);
  if (!res.ok) {
    throw new Error(`데모 원고를 불러오지 못했습니다 (${res.status})`);
  }
  const buf = await res.arrayBuffer();
  return new File([buf], ONBOARDING_SAMPLE_PDF_DISPLAY_NAME, {
    type: 'application/pdf',
  });
}
