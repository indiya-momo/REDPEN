import { useEffect, useMemo, useState } from 'react';
import AppDialog from './AppDialog.jsx';

const REASON_LABEL = {
  'page-layout': '쪽 넘김 불확실',
  josa: '조사',
  midword: '형태소 이음',
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
  if (candidate.defaultDecision === 'keep') return '자동: 유지';
  if (candidate.defaultDecision === 'dehyphen') return '자동: 하이픈을 지우고 붙임';
  if (candidate.defaultDecision === 'nospace') return '자동: 붙임';
  return '자동: 띄움';
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
  const hasPageLayout = (candidates ?? []).some((c) => c.reason === 'page-layout');

  const messageNode = (
    <div className="pdf-txt-linebreak-review">
      <p className="pdf-txt-linebreak-review__lead">
        <span className="pdf-txt-linebreak-review__file">{sourceName || 'PDF'}</span>
        {keepVisualBreaks
          ? ' — 화면에 보이던 줄바꿈을 그대로 넣습니다.'
          : ` — 문단 안의 줄바꿈 ${joined}곳은 이어 붙였고, 문단이 끝나는 ${kept}곳은 줄을 나눴습니다.`}
      </p>
      <div
        className="pdf-txt-linebreak-review__modes"
        role="radiogroup"
        aria-label="받기 방식"
      >
        <label className="pdf-txt-linebreak-review__toggle">
          <input
            type="checkbox"
            checked={!keepVisualBreaks}
            onChange={() => setKeepVisualBreaks(false)}
          />
          <span>추천형으로 받기</span>
        </label>
        <label className="pdf-txt-linebreak-review__toggle">
          <input
            type="checkbox"
            checked={keepVisualBreaks}
            onChange={() => setKeepVisualBreaks(true)}
          />
          <span>화면 그대로 받기</span>
        </label>
      </div>
      {keepVisualBreaks ? (
        <p className="pdf-txt-linebreak-review__note">
          PDF 화면에 보이던 줄바꿈을 유지합니다. 쪽 표식은 넣지 않습니다. 쪽 표식이 있는 추출본은 아래에서 따로 받을 수 있습니다.
        </p>
      ) : (
        <p className="pdf-txt-linebreak-review__note">
          {count > 0
            ? `자동 판정이 어려운 줄바꿈 ${count}곳을 표시합니다. 붙임, 띄움, 유지 중 골라 주세요.`
            : '확인할 예외가 없습니다. 최종 TXT를 받을 수 있습니다.'}
        </p>
      )}
      {hasPageLayout && !keepVisualBreaks ? (
        <p className="pdf-txt-linebreak-review__note">
          「쪽 넘김 불확실」은 쪽이 바뀌는 자리에서 앞뒤 줄이 한 문단으로 이어지는지 확신하기 어려워 자동으로 줄을 유지한 곳입니다. 이어지는 문장이면 붙임이나 띄움을 골라 주세요.
        </p>
      ) : null}
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
                        붙임
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
                        띄움
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
                    유지
                  </button>
                </div>
                <div className="pdf-txt-linebreak-review__body">
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
