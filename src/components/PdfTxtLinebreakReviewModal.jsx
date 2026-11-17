import { useEffect, useMemo, useState } from 'react';
import AppDialog from './AppDialog.jsx';

/**
 * @param {{
 *   open: boolean,
 *   sourceName: string,
 *   candidates: import('../lib/pdfTxtLinebreakReview.js').LinebreakCandidate[],
 *   onCancel: () => void,
 *   onConfirm: (decisions: Record<string, 'join' | 'keep'>) => void,
 *   onDownloadDraft?: () => void,
 * }} props
 */
export default function PdfTxtLinebreakReviewModal({
  open,
  sourceName,
  candidates,
  onCancel,
  onConfirm,
  onDownloadDraft,
}) {
  const initial = useMemo(() => {
    /** @type {Record<string, 'join' | 'keep'>} */
    const map = {};
    for (const c of candidates ?? []) {
      map[c.id] = c.defaultDecision;
    }
    return map;
  }, [candidates]);

  const [decisions, setDecisions] = useState(initial);
  useEffect(() => {
    if (open) setDecisions(initial);
  }, [open, initial]);

  const count = candidates?.length ?? 0;

  const messageNode = (
    <div className="pdf-txt-linebreak-review">
      <p className="pdf-txt-linebreak-review__lead">
        <span className="pdf-txt-linebreak-review__file">{sourceName || 'PDF'}</span>
        {count > 0
          ? ` — 단어가 잘린 듯한 줄 ${count}곳입니다. 기본은 줄 유지이며, 필요할 때만 붙이기를 고르세요.`
          : ' — 확인할 줄바꿈이 없습니다. 최종 TXT를 받을 수 있습니다.'}
      </p>
      {count > 0 ? (
        <ul className="pdf-txt-linebreak-review__list">
          {candidates.map((c) => {
            const decision = decisions[c.id] ?? c.defaultDecision;
            const leftTail = c.left.slice(-18);
            const rightHead = c.right.slice(0, 18);
            return (
              <li key={c.id} className="pdf-txt-linebreak-review__item">
                <div className="pdf-txt-linebreak-review__meta">
                  {c.pageNum}쪽
                </div>
                <div className="pdf-txt-linebreak-review__pair" title={`${c.left} ↵ ${c.right}`}>
                  <span>…{leftTail}</span>
                  <span className="pdf-txt-linebreak-review__break">↵</span>
                  <span>{rightHead}…</span>
                </div>
                <div className="pdf-txt-linebreak-review__actions" role="group" aria-label="줄바꿈 선택">
                  <button
                    type="button"
                    className={
                      decision === 'join'
                        ? 'pdf-txt-linebreak-review__chip is-active'
                        : 'pdf-txt-linebreak-review__chip'
                    }
                    onClick={() =>
                      setDecisions((prev) => ({ ...prev, [c.id]: 'join' }))
                    }
                  >
                    붙이기
                  </button>
                  <button
                    type="button"
                    className={
                      decision === 'keep'
                        ? 'pdf-txt-linebreak-review__chip is-active'
                        : 'pdf-txt-linebreak-review__chip'
                    }
                    onClick={() =>
                      setDecisions((prev) => ({ ...prev, [c.id]: 'keep' }))
                    }
                  >
                    줄 유지
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {onDownloadDraft ? (
        <p className="pdf-txt-linebreak-review__draft">
          <button
            type="button"
            className="pdf-txt-linebreak-review__draft-btn"
            onClick={onDownloadDraft}
          >
            검수전 추출본도 받기
          </button>
        </p>
      ) : null}
    </div>
  );

  return (
    <AppDialog
      open={open}
      title="줄바꿈 확인"
      messageNode={messageNode}
      mode="confirm"
      confirmLabel="최종 TXT 받기"
      cancelLabel="닫기"
      onConfirm={() => onConfirm(decisions)}
      onCancel={onCancel}
      onClose={onCancel}
      titleAlign="start"
    />
  );
}
