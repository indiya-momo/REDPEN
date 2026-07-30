/**
 * 검수권 사용 안내 한 줄 — 「맞춤법 검수권🎫」「표기 통일 검수권🎫」
 * @param {{ line?: string | null }} props
 */
export default function AppDialogQuotaConsumedLine({ line = null }) {
  if (!line) return null;
  const match = /^(맞춤법|표기 통일) 검수권(.*)$/u.exec(line);
  if (!match) {
    return <p className="app-dialog__quota-consumed-line">{line}</p>;
  }
  return (
    <p className="app-dialog__quota-consumed-line">
      <span className="app-dialog__quota-ticket-kind">
        {match[1]} 검수권
      </span>
      {match[2]}
    </p>
  );
}
