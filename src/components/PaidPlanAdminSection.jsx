/**
 * 마이페이지 — 관리자 전용 유료 회원 등록/해제 + 유료 목록.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  formatPaidPlanAdminError,
  formatPaidUpdatedAt,
  isPaidPlanAdminCloudEnabled,
  listPaidUsersCloud,
  setUserPlanByEmailCloud,
} from '../lib/paidPlanAdminCloud.js';
import { syncUserPlanFromCloud } from '../lib/userProfileStorage.js';

/**
 * @param {{
 *   authUid: string,
 *   onSelfPlanChanged?: () => void,
 * }} props
 */
export default function PaidPlanAdminSection({
  authUid,
  onSelfPlanChanged,
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [paidUsers, setPaidUsers] = useState(
    /** @type {{ uid: string, email: string, paidUpdatedAt: number }[]} */ ([]),
  );

  const refreshList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      if (!isPaidPlanAdminCloudEnabled()) {
        throw Object.assign(new Error('Firebase가 설정되지 않았습니다.'), {
          code: 'failed-precondition',
        });
      }
      const result = await listPaidUsersCloud();
      setPaidUsers(Array.isArray(result?.users) ? result.users : []);
    } catch (err) {
      setPaidUsers([]);
      setListError(formatPaidPlanAdminError(err));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function run(plan) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!isPaidPlanAdminCloudEnabled()) {
        throw Object.assign(new Error('Firebase가 설정되지 않았습니다.'), {
          code: 'failed-precondition',
        });
      }
      const result = await setUserPlanByEmailCloud(email, plan);
      const label = plan === 'paid' ? '유료로 등록' : '무료로 해제';
      const shownEmail = result?.email || email.trim();
      setMessage(
        `${shownEmail} 계정을 ${label}했습니다. (plan: ${result?.plan ?? plan})`,
      );
      if (result?.uid && result.uid === authUid) {
        syncUserPlanFromCloud(authUid, result.plan);
        onSelfPlanChanged?.();
      }
      await refreshList();
    } catch (err) {
      setError(formatPaidPlanAdminError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mypage__card" aria-labelledby="mypage-paid-admin-title">
      <div className="mypage__card-head">
        <h2 id="mypage-paid-admin-title" className="mypage__card-title">
          유료 회원 등록
        </h2>
      </div>
      <p className="mypage__profile-note">
        가입·온보딩이 끝난 계정의 Google 이메일로 유료 혜택을 켜거나 끕니다.
        결제 UI는 없습니다.
      </p>
      <label className="mypage__paid-admin-field">
        <span className="mypage__paid-admin-label">이메일</span>
        <input
          type="email"
          className="mypage__paid-admin-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tester@example.com"
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <div className="mypage__paid-admin-actions">
        <button
          type="button"
          className="mypage__paid-admin-btn mypage__paid-admin-btn--primary"
          disabled={busy || !email.trim()}
          onClick={() => void run('paid')}
        >
          등록 (유료)
        </button>
        <button
          type="button"
          className="mypage__paid-admin-btn"
          disabled={busy || !email.trim()}
          onClick={() => void run('free')}
        >
          해제 (무료)
        </button>
      </div>
      {message ? (
        <p className="mypage__paid-admin-msg" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mypage__paid-admin-msg mypage__paid-admin-msg--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mypage__paid-admin-list">
        <div className="mypage__paid-admin-list-head">
          <h3 className="mypage__paid-admin-list-title">유료 회원 목록</h3>
          <button
            type="button"
            className="mypage__paid-admin-btn"
            disabled={listLoading || busy}
            onClick={() => void refreshList()}
          >
            새로고침
          </button>
        </div>
        {listLoading ? (
          <p className="mypage__paid-admin-msg" role="status">
            목록을 불러오는 중…
          </p>
        ) : null}
        {listError ? (
          <p className="mypage__paid-admin-msg mypage__paid-admin-msg--error" role="alert">
            {listError}
          </p>
        ) : null}
        {!listLoading && !listError && paidUsers.length === 0 ? (
          <p className="mypage__paid-admin-msg" role="status">
            등록된 유료 회원이 없습니다.
          </p>
        ) : null}
        {!listLoading && paidUsers.length > 0 ? (
          <table className="mypage__paid-admin-table">
            <thead>
              <tr>
                <th scope="col">이메일</th>
                <th scope="col">등록 시각</th>
              </tr>
            </thead>
            <tbody>
              {paidUsers.map((user) => (
                <tr key={user.uid}>
                  <td>
                    <button
                      type="button"
                      className="mypage__paid-admin-email-btn"
                      onClick={() => setEmail(user.email)}
                      title="입력란에 넣기"
                    >
                      {user.email || '(이메일 없음)'}
                    </button>
                  </td>
                  <td>{formatPaidUpdatedAt(user.paidUpdatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </section>
  );
}
