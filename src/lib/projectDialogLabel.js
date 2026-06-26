/**
 * AppDialog 등에서 프로젝트 이름 표기 — ≪이름≫ (본문은 AppDialog가 고딕 처리)
 * @param {string} [name]
 */
export function formatProjectDialogLabel(name) {
  const label = String(name ?? '').trim() || '이름 없는 프로젝트';
  return `≪${label}≫`;
}
