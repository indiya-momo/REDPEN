/**
 * 마이페이지 — 관리자 전용 유료 회원 등록/해제.
 */
import { useState } from 'react';
import {
  formatPaidPlanAdminError,
  isPaidPlanAdminCloudEnabled,
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
      setMessage(
        `${result.email} 계정을 ${label}했습니다. (plan: ${result.plan})`,
      );
      if (result.uid === authUid) {
        syncUserPlanFromCloud(authUid, result.plan);
        onSelfPlanChanged?.();
      }
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
    </section>
  );
}
