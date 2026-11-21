import { useEffect, useMemo, useState } from 'react';
import AppDialog from './AppDialog.jsx';

const REASON_LABEL = {
  midword: '단어 중간',
  hyphen: '영문 하이픈',
  border: '끝선에 못 미친 줄',
  heading: '제목으로 보임',
  short: '짧은 줄',
};

/**
 * @param {import('../lib/pdfTxtLinebreakReview.js').LinebreakCandidate} candidate
 * @returns {string}
 */
function autoLabel(candidate) {
  if (candidate.defaultDecision === 'keep') return '자동: 줄 유지';
  if (candidate.defaultDecision === 'dehyphen') return '자동: 하이픈을 지우고 붙임';
  if (candidate.defaultDecision === 'nospace') return '자동: 붙여 씀';
  return '자동: 한 칸 띄고 붙임';
}

/**
 * @param {{
 *   open: boolean,
 *   sourceName: string,
 *   candidates: import('../lib/pdfTxtLinebreakReview.js').LinebreakCandidate[],
 *   paragraphStats?: { joined?: number, kept?: number, omitted?: number },
 *   onCancel: () => void,
 *   onConfirm: (payload: {
 *     decisions: Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>,
 *     autoParagraph: boolean,
 *   }) => void,
 *   onDownloadDraft?: () => void,
 * }} props
 */
export default function PdfTxtLinebreakReviewModal({
  open,
  sourceName,
  candidates,
  paragraphStats,
  onCancel,
  onConfirm,
  onDownloadDraft,
}) {
  const initial = useMemo(() => {
    /** @type {Record<string, 'keep' | 'nospace' | 'space' | 'dehyphen'>} */
    const map = {};
    for (const c of candidates ?? []) {
      map[c.id] = c.defaultDecision === 'join' ? 'space' : c.defaultDecision;
    }
    return map;
  }, [candidates]);

  const [decisions, setDecisions] = useState(initial);
  const [keepVisualBreaks, setKeepVisualBreaks] = useState(false);
  useEffect(() => {
    if (open) {
      setDecisions(initial);
      setKeepVisualBreaks(false);
    }
  }, [open, initial]);

  const count = candidates?.length ?? 0;
  const joined = paragraphStats?.joined ?? 0;
  const kept = paragraphStats?.kept ?? 0;
  const omitted = paragraphStats?.omitted ?? 0;

  const messageNode = (
    <div className="pdf-txt-linebreak-review">
      <p className="pdf-txt-linebreak-review__lead">
        <span className="pdf-txt-linebreak-review__file">{sourceName || 'PDF'}</span>
        {keepVisualBreaks
          ? ' — 조판에 보이던 줄바꿈을 그대로 넣습니다.'
          : ` — 문단 안의 줄바꿈 ${joined}곳은 이어 붙였고, 문단이 끝나는 ${kept}곳은 줄을 나눴습니다.`}
      </p>
      <label className="pdf-txt-linebreak-review__toggle">
        <input
          type="checkbox"
          checked={keepVisualBreaks}
          onChange={(e) => setKeepVisualBreaks(e.target.checked)}
        />
        <span>조판 줄바꿈 그대로 받기</span>
      </label>
      {keepVisualBreaks ? (
        <p className="pdf-txt-linebreak-review__note">
          PDF에 보이던 줄바꿈을 유지합니다. 쪽 표식은 넣지 않습니다. 쪽 표식이 있는 추출본은 아래에서 따로 받을 수 있습니다.
        </p>
      ) : (
        <p className="pdf-txt-linebreak-review__note">
          {count > 0
            ? `아래 ${count}곳은 자동 판정이 애매합니다. 붙여 씀, 띄어 씀, 줄 유지 중에서 고치세요.`
            : '확인할 예외가 없습니다. 최종 TXT를 받을 수 있습니다.'}
          {omitted > 0
            ? ` 애매한 곳이 많아 ${count}곳만 표시합니다. 나머지는 자동 판정을 따릅니다.`
            : ''}
        </p>
      )}
      {count > 0 ? (
        <ul
          className={
            keepVisualBreaks
              ? 'pdf-txt-linebreak-review__list is-paused'
              : 'pdf-txt-linebreak-review__list'
          }
        >
          {candidates.map((c) => {
            const decision = decisions[c.id] ?? c.defaultDecision;
            const leftTail = c.left.slice(-18);
            const rightHead = c.right.slice(0, 18);
            const hyphen = c.defaultDecision === 'dehyphen';
            const reason = REASON_LABEL[c.reason] ?? '';
            return (
              <li key={c.id} className="pdf-txt-linebreak-review__item">
                <div className="pdf-txt-linebreak-review__meta">
                  {c.pageNum}쪽
                  {reason ? ` · ${reason}` : ''}
                  {` · ${autoLabel(c)}`}
                </div>
                <div className="pdf-txt-linebreak-review__pair" title={`${c.left} ↵ ${c.right}`}>
                  <span>…{leftTail}</span>
                  <span className="pdf-txt-linebreak-review__break">↵</span>
                  <span>{rightHead}…</span>
                </div>
                <div className="pdf-txt-linebreak-review__actions" role="group" aria-label="줄바꿈 선택">
                  {hyphen ? (
                    <button
                      type="button"
                      className={
                        decision === 'dehyphen'
                          ? 'pdf-txt-linebreak-review__chip is-active'
                          : 'pdf-txt-linebreak-review__chip'
                      }
                      onClick={() =>
                        setDecisions((prev) => ({ ...prev, [c.id]: 'dehyphen' }))
                      }
                    >
                      이어 붙이기
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={
                          decision === 'nospace'
                            ? 'pdf-txt-linebreak-review__chip is-active'
                            : 'pdf-txt-linebreak-review__chip'
                        }
                        onClick={() =>
                          setDecisions((prev) => ({ ...prev, [c.id]: 'nospace' }))
                        }
                      >
                        붙여 씀
                      </button>
                      <button
                        type="button"
                        className={
                          decision === 'space'
                            ? 'pdf-txt-linebreak-review__chip is-active'
                            : 'pdf-txt-linebreak-review__chip'
                        }
                        onClick={() =>
                          setDecisions((prev) => ({ ...prev, [c.id]: 'space' }))
                        }
                      >
                        띄어 씀
                      </button>
                    </>
                  )}
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
      title="문단 정리"
      messageNode={messageNode}
      mode="confirm"
      confirmLabel="최종 TXT 받기"
      cancelLabel="닫기"
      onConfirm={() =>
        onConfirm({
          decisions,
          autoParagraph: !keepVisualBreaks,
        })
      }
      onCancel={onCancel}
      onClose={onCancel}
      titleAlign="start"
    />
  );
}
