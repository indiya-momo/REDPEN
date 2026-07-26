/**
 * 다이얼로그 기준 라벨 — 음영 없이, (n/n)·(N항목)은 meta 크기
 */

/**
 * @param {{
 *   label: string,
 *   meta?: string | null,
 * }} props
 */
export function AppDialogCriteriaLabel({ label, meta = null }) {
  return (
    <span className="app-dialog__criteria-label">
      {label}
      {meta ? (
        <span className="app-dialog__criteria-meta">{meta}</span>
      ) : null}
    </span>
  );
}
