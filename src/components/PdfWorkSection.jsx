import { Upload, RotateCcw } from 'lucide-react';
import { supportsFilePicker } from '../lib/sessionStore.js';

/**
 * @param {{
 *   fileRef: React.RefObject<HTMLInputElement | null>,
 *   onOpenPicker: () => void,
 *   onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   onReconnect: () => void,
 *   onClearSession: () => void,
 *   isProcessing: boolean,
 *   pdf: object | null,
 *   pdfFileName: string | null,
 *   fileHandleActive: boolean,
 *   loadError: string | null,
 *   sessionHint: string | null,
 *   compact?: boolean,
 * }} props
 */
export default function PdfWorkSection({
  fileRef,
  onOpenPicker,
  onFileChange,
  onReconnect,
  onClearSession,
  isProcessing,
  pdf,
  pdfFileName,
  fileHandleActive,
  loadError,
  sessionHint,
  compact = false,
}) {
  return (
    <section className={`panel-section ${compact ? 'panel-section--compact' : ''}`}>
      {!compact && sessionHint && (
        <p className="hint session-hint" style={{ marginBottom: 8 }}>
          {sessionHint}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
      {supportsFilePicker() ? (
        <button
          type="button"
          className="btn-upload"
          onClick={onOpenPicker}
          disabled={isProcessing}
        >
          <Upload size={16} />
          PDF 열기
        </button>
      ) : (
        <button
          type="button"
          className="btn-upload"
          onClick={() => fileRef.current?.click()}
          disabled={isProcessing}
        >
          <Upload size={16} />
          PDF 업로드
        </button>
      )}
      {fileHandleActive && !pdf && (
        <button
          type="button"
          className="btn-reconnect"
          onClick={onReconnect}
          disabled={isProcessing}
        >
          PDF 다시 연결
        </button>
      )}
      {pdfFileName && (
        <p className="file-name">
          ✓ {pdfFileName}
          {pdf && ` · ${pdf.numPages}p`}
        </p>
      )}
      {loadError && <p className="error-text">{loadError}</p>}
      {pdf && (
        <button
          type="button"
          className="btn-clear-session"
          onClick={onClearSession}
          disabled={isProcessing}
        >
          <RotateCcw size={14} />
          작업 지우기
        </button>
      )}
    </section>
  );
}
