/**
 * 모모의 방 왼쪽 칼럼 공지 게시판.
 * 누구나 Firestore 목록을 읽고, 관리자만 글쓰기·수정·삭제 UI를 본다.
 * 본문은 목록이 아니라 가운데 읽기 팝업에서 본다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { isBetaQuotaAdminExempt } from '../lib/betaDailyQuota.js';
import { showAppAlert, showAppConfirm } from '../lib/appDialog.js';
import {
  formatNoticeDate,
  getLatestNotice,
  listNotices,
  parseNoticeBodyLinks,
} from '../lib/notices.js';
import {
  createNoticeCloud,
  deleteNoticeCloud,
  fetchNotices,
  formatNoticeAdminError,
  updateNoticeCloud,
} from '../lib/noticesCloud.js';

const TITLE_MAX = 80;
const BODY_MAX = 4000;

function NoticeBodyText({ body, signedIn, className }) {
  const parts = parseNoticeBodyLinks(body);
  return (
    <div className={className}>
      {parts.map((part, index) => {
        if (part.type === 'break') {
          return <br key={index} />;
        }
        if (part.type === 'link') {
          if (!signedIn) {
            return (
              <span key={index} className="momo-room__notice-link-locked">
                [{part.text}]{' '}
                <span className="momo-room__notice-link-hint">
                  (회원 전용)
                </span>
              </span>
            );
          }
          return (
            <a
              key={index}
              className="momo-room__notice-link"
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {part.text}
            </a>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}

/**
 * @param {{
 *   authUid?: string,
 *   authEmail?: string,
 *   focusLatestNotice?: boolean,
 * }} props
 */
export default function MomoRoomNoticeBoard({
  authUid = '',
  authEmail = '',
  focusLatestNotice = false,
}) {
  const isAdmin = isBetaQuotaAdminExempt(authUid, authEmail);
  const signedIn = Boolean(authUid.trim());
  const [noticesRaw, setNoticesRaw] = useState(
    /** @type {ReturnType<typeof listNotices>} */ ([]),
  );
  const [status, setStatus] = useState(/** @type {'loading' | 'ready' | 'error'} */ ('loading'));
  const [openNoticeId, setOpenNoticeId] = useState(/** @type {string | null} */ (null));
  const [composer, setComposer] = useState(/** @type {null | 'create' | string} */ (null));
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftPinned, setDraftPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const notices = useMemo(() => listNotices(noticesRaw), [noticesRaw]);
  const openIndex = notices.findIndex((notice) => notice.id === openNoticeId);
  const openNotice = openIndex >= 0 ? notices[openIndex] : null;
  const olderNotice =
    openIndex >= 0 && openIndex < notices.length - 1 ? notices[openIndex + 1] : null;
  const newerNotice = openIndex > 0 ? notices[openIndex - 1] : null;

  async function reloadNotices() {
    const list = await fetchNotices();
    setNoticesRaw(list);
    setStatus('ready');
    return list;
  }

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void fetchNotices()
      .then((list) => {
        if (cancelled) return;
        setNoticesRaw(list);
        setStatus('ready');
        if (focusLatestNotice) {
          const latest = getLatestNotice(list);
          if (latest) setOpenNoticeId(latest.id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setNoticesRaw([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [focusLatestNotice]);

  function closeModal() {
    setOpenNoticeId(null);
    setComposer((current) => (current && current !== 'create' ? null : current));
    setDraftTitle('');
    setDraftBody('');
    setDraftPinned(false);
  }

  useEffect(() => {
    if (!openNotice) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeModal();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
    };
  }, [openNotice?.id]);

  function openCreate() {
    setOpenNoticeId(null);
    setComposer('create');
    setDraftTitle('');
    setDraftBody('');
    setDraftPinned(false);
  }

  function openEdit(notice) {
    setComposer(notice.id);
    setDraftTitle(notice.title);
    setDraftBody(notice.body);
    setDraftPinned(notice.pinned);
    setOpenNoticeId(notice.id);
  }

  function closeComposer() {
    setComposer(null);
    setDraftTitle('');
    setDraftBody('');
    setDraftPinned(false);
  }

  function openNoticeRow(notice) {
    if (composer === 'create') closeComposer();
    setOpenNoticeId(notice.id);
  }

  async function handleSave() {
    const title = draftTitle.trim();
    if (!title) {
      await showAppAlert('제목을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      if (composer === 'create') {
        await createNoticeCloud({
          title,
          body: draftBody,
          pinned: draftPinned,
        });
        const list = await reloadNotices();
        closeComposer();
        const latest = getLatestNotice(list);
        if (latest) setOpenNoticeId(latest.id);
      } else if (typeof composer === 'string') {
        const id = composer;
        await updateNoticeCloud({
          id,
          title,
          body: draftBody,
          pinned: draftPinned,
        });
        await reloadNotices();
        closeComposer();
        setOpenNoticeId(id);
      }
    } catch (err) {
      await showAppAlert(formatNoticeAdminError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(notice) {
    const ok = await showAppConfirm({
      title: '공지 삭제',
      message: `「${notice.title}」 공지를 삭제할까요?`,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await deleteNoticeCloud(notice.id);
      await reloadNotices();
      setOpenNoticeId(null);
      if (composer === notice.id) closeComposer();
    } catch (err) {
      await showAppAlert(formatNoticeAdminError(err));
    } finally {
      setSaving(false);
    }
  }

  const composerOpen = composer === 'create';
  const editingOpen = Boolean(openNotice && composer === openNotice.id);

  const composerFields = (
    <form
      className="momo-room__notice-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <input
        type="text"
        className="momo-room__notice-form-title"
        placeholder="제목"
        value={draftTitle}
        maxLength={TITLE_MAX}
        onChange={(event) => setDraftTitle(event.target.value)}
        disabled={saving}
        aria-label="공지 제목"
      />
      <textarea
        className="momo-room__notice-form-body"
        placeholder="본문"
        value={draftBody}
        maxLength={BODY_MAX}
        onChange={(event) => setDraftBody(event.target.value)}
        disabled={saving}
        aria-label="공지 본문"
      />
      <p className="momo-room__notice-form-hint">링크: [다운받기](주소)</p>
      <label className="momo-room__notice-form-pin">
        <input
          type="checkbox"
          checked={draftPinned}
          onChange={(event) => setDraftPinned(event.target.checked)}
          disabled={saving}
        />
        고정
      </label>
      <div className="momo-room__notice-form-actions">
        <button
          type="button"
          className="momo-room__notice-form-cancel"
          onClick={editingOpen ? closeComposer : closeComposer}
          disabled={saving}
        >
          취소
        </button>
        <button
          type="submit"
          className="momo-room__notice-form-save"
          disabled={saving}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );

  const readingModal =
    openNotice && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="momo-room__notice-modal-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
          >
            <div
              className="momo-room__notice-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="momo-room-notice-modal-title"
              tabIndex={-1}
              ref={dialogRef}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="momo-room__notice-modal-head">
                <h2
                  id="momo-room-notice-modal-title"
                  className="momo-room__notice-modal-heading"
                >
                  알립니다
                </h2>
                <button
                  type="button"
                  className="momo-room__notice-modal-close"
                  onClick={closeModal}
                  aria-label="닫기"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </header>

              <div className="momo-room__notice-modal-meta">
                <div className="momo-room__notice-modal-meta-row">
                  <span className="momo-room__notice-modal-meta-label">제목</span>
                  <span className="momo-room__notice-modal-meta-value">
                    {openNotice.pinned ? (
                      <span className="momo-room__notice-pin">고정</span>
                    ) : null}
                    {openNotice.title}
                  </span>
                </div>
                <div className="momo-room__notice-modal-meta-row">
                  <span className="momo-room__notice-modal-meta-label">올린날짜</span>
                  <span className="momo-room__notice-modal-meta-value">
                    {openNotice.createdAt ? (
                      <time dateTime={new Date(openNotice.createdAt).toISOString()}>
                        {formatNoticeDate(openNotice.createdAt)}
                      </time>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              <div className="momo-room__notice-modal-main">
                {editingOpen ? (
                  composerFields
                ) : (
                  <>
                    {openNotice.body ? (
                      <NoticeBodyText
                        body={openNotice.body}
                        signedIn={signedIn}
                        className="momo-room__notice-modal-body"
                      />
                    ) : (
                      <p className="momo-room__notice-modal-body momo-room__notice-modal-body--empty">
                        본문이 없습니다.
                      </p>
                    )}
                    {isAdmin ? (
                      <div className="momo-room__notice-item-actions momo-room__notice-modal-actions">
                        <button
                          type="button"
                          className="momo-room__notice-item-edit"
                          onClick={() => openEdit(openNotice)}
                          disabled={saving}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="momo-room__notice-item-delete"
                          onClick={() => void handleDelete(openNotice)}
                          disabled={saving}
                        >
                          삭제
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="momo-room__notice-modal-nav">
                <button
                  type="button"
                  className="momo-room__notice-modal-nav-row"
                  disabled={!olderNotice}
                  onClick={() => {
                    if (!olderNotice) return;
                    if (composer && composer !== 'create') closeComposer();
                    setOpenNoticeId(olderNotice.id);
                  }}
                >
                  <span className="momo-room__notice-modal-nav-label">이전 글</span>
                  <span className="momo-room__notice-modal-nav-title">
                    {olderNotice ? olderNotice.title : '이전 글이 없습니다.'}
                  </span>
                </button>
                <button
                  type="button"
                  className="momo-room__notice-modal-nav-row"
                  disabled={!newerNotice}
                  onClick={() => {
                    if (!newerNotice) return;
                    if (composer && composer !== 'create') closeComposer();
                    setOpenNoticeId(newerNotice.id);
                  }}
                >
                  <span className="momo-room__notice-modal-nav-label">다음 글</span>
                  <span className="momo-room__notice-modal-nav-title">
                    {newerNotice ? newerNotice.title : '다음 글이 없습니다.'}
                  </span>
                </button>
                <button
                  type="button"
                  className="momo-room__notice-modal-list"
                  onClick={closeModal}
                >
                  목록
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <section
        className={
          composerOpen
            ? 'momo-room__notice momo-room__notice--composer'
            : 'momo-room__notice'
        }
        aria-label="공지"
      >
        <div className="momo-room__notice-head">
          <p className="momo-room__notice-label">공지</p>
          {isAdmin ? (
            <button
              type="button"
              className="momo-room__notice-write"
              onClick={openCreate}
              disabled={saving}
            >
              + 글쓰기
            </button>
          ) : null}
        </div>

        {composerOpen ? composerFields : null}

        {status === 'loading' ? (
          <p className="momo-room__notice-empty">불러오는 중…</p>
        ) : status === 'error' ? (
          <p className="momo-room__notice-empty">공지를 불러오지 못했어요.</p>
        ) : notices.length === 0 ? (
          <p className="momo-room__notice-empty">아직 올라온 공지가 없어요.</p>
        ) : (
          <ul className="momo-room__notice-list">
            {notices.map((notice) => (
              <li key={notice.id} className="momo-room__notice-item">
                <button
                  type="button"
                  className="momo-room__notice-item-toggle"
                  onClick={() => openNoticeRow(notice)}
                >
                  {notice.pinned ? (
                    <span className="momo-room__notice-pin">고정</span>
                  ) : null}
                  <span className="momo-room__notice-item-title">{notice.title}</span>
                  {notice.createdAt ? (
                    <time
                      className="momo-room__notice-item-date"
                      dateTime={new Date(notice.createdAt).toISOString()}
                    >
                      {formatNoticeDate(notice.createdAt)}
                    </time>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {readingModal}
    </>
  );
}
