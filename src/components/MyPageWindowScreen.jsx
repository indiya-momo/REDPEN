import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import FeedbackModal from './FeedbackModal.jsx';
import { returnToWorkspace } from '../lib/returnToWorkspace.js';
import {
  getCurrentUserSession,
  signOutUser,
  subscribeAuthSession,
} from '../lib/firebaseAuth.js';
import { getUserProfile } from '../lib/userProfileStorage.js';
import './my-page.css';

const SIDEBAR_NAV = [
  { id: 'profile', label: '회원정보관리' },
  { id: 'usage', label: '이용 내역' },
  { id: 'inquiry', label: '문의 내역' },
];

const SECTION_COPY = {
  profile: {
    title: '회원정보관리',
    desc: '닉네임·연락처 등 계정 정보를 관리하는 화면입니다. 준비 중입니다.',
  },
  usage: {
    title: '이용 내역',
    desc: '검수 이용 기록을 날짜·내용·금액으로 확인할 수 있습니다. 준비 중입니다.',
  },
};

function daysSinceJoin(timestampMs) {
  if (!timestampMs || !Number.isFinite(timestampMs)) return null;
  const dayMs = 86_400_000;
  const start = new Date(timestampMs);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / dayMs) + 1);
}

function OverviewDashboard({ onViewAll }) {
  return (
    <div className="mypage__main-inner">
      <section className="mypage__balance" aria-label="서비스 안내">
        <p className="mypage__balance-beta">현재 오픈베타 서비스 중입니다</p>
      </section>

      <section className="mypage__card" aria-labelledby="mypage-usage-title">
        <div className="mypage__card-head">
          <h2 id="mypage-usage-title" className="mypage__card-title">
            최근 이용 내역
          </h2>
          <button
            type="button"
            className="mypage__card-link"
            onClick={() => onViewAll('usage')}
          >
            전체 보기 →
          </button>
        </div>
        <table className="mypage__table">
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">내용</th>
              <th scope="col">금액</th>
            </tr>
          </thead>
        </table>
        <div className="mypage__empty">
          <p className="mypage__empty-title">아직 이용 내역이 없습니다.</p>
          <p className="mypage__empty-desc">
            검토를 진행하면 자동으로 기록됩니다.
          </p>
        </div>
      </section>

      <section className="mypage__card" aria-labelledby="mypage-inquiry-title">
        <div className="mypage__card-head">
          <h2 id="mypage-inquiry-title" className="mypage__card-title">
            최근 문의 내역
          </h2>
          <button
            type="button"
            className="mypage__card-link"
            onClick={() => onViewAll('inquiry')}
          >
            전체 보기 →
          </button>
        </div>
        <table className="mypage__table">
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">제목</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
        </table>
        <div className="mypage__empty">
          <p className="mypage__empty-title">문의 내역이 없습니다.</p>
          <p className="mypage__empty-desc">
            궁금한 점은 문의하기로 남겨 주세요.
          </p>
        </div>
      </section>
    </div>
  );
}

function InquiryHistorySection({ onNewInquiry }) {
  return (
    <div className="mypage__main-inner mypage__main-inner--section">
      <h1 className="mypage__page-title">문의 내역</h1>
      <section
        className="mypage__card mypage__inquiry-card"
        aria-labelledby="mypage-inquiry-my-title"
      >
        <div className="mypage__card-head">
          <h2 id="mypage-inquiry-my-title" className="mypage__card-subtitle">
            내 문의
          </h2>
          <button
            type="button"
            className="mypage__inquiry-new"
            onClick={onNewInquiry}
          >
            <Plus size={16} aria-hidden />
            문의하기
          </button>
        </div>
        <table className="mypage__table mypage__table--inquiry">
          <thead>
            <tr>
              <th scope="col">날짜</th>
              <th scope="col">제목</th>
              <th scope="col">상태</th>
            </tr>
          </thead>
        </table>
        <div className="mypage__empty mypage__empty--inquiry">
          <p className="mypage__empty-desc">
            문의 내역이 없습니다. 궁금한 점은 문의하기로 남겨 주세요.
          </p>
        </div>
      </section>
    </div>
  );
}

function SectionPlaceholder({ sectionId }) {
  const copy = SECTION_COPY[sectionId];
  if (!copy) return null;
  return (
    <div className="mypage__main-inner">
      <div className="mypage__section-placeholder">
        <h2>{copy.title}</h2>
        <p>{copy.desc}</p>
      </div>
    </div>
  );
}

export default function MyPageWindowScreen() {
  const [authSession, setAuthSession] = useState(() => getCurrentUserSession());
  const [activeNav, setActiveNav] = useState('overview');
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);

  useEffect(() => subscribeAuthSession(setAuthSession), []);

  const profile = authSession?.uid ? getUserProfile(authSession.uid) : null;
  const displayName = useMemo(() => {
    const nickname = profile?.nickname?.trim();
    if (nickname) return nickname;
    const name = authSession?.displayName?.trim();
    if (name) return name;
    return '게스트';
  }, [authSession?.displayName, profile?.nickname]);

  const email = authSession?.email ?? '';

  const daysWithMomo = useMemo(() => {
    const joinedMs = authSession?.createdAtMs ?? profile?.completedAt ?? null;
    return daysSinceJoin(joinedMs);
  }, [authSession?.createdAtMs, profile?.completedAt]);

  async function handleLogout() {
    await signOutUser();
    const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
    window.location.replace(url.toString());
  }

  if (!authSession?.uid) {
    return (
      <div className="mypage mypage--guest">
        <main className="mypage__main">
          <div className="mypage__guest-card">
            <p>로그인 후 마이페이지를 이용할 수 있습니다.</p>
            <button
              type="button"
              className="mypage__back mypage__back--icon"
              onClick={returnToWorkspace}
              aria-label="검수 화면으로 돌아가기"
              title="검수 화면으로 돌아가기"
            >
              <ArrowLeft size={18} aria-hidden />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mypage">
      <aside className="mypage__sidebar" aria-label="마이페이지 메뉴">
        <header className="mypage__sidebar-head">
          <p className="mypage__eyebrow">MY ACCOUNT</p>
          <div className="mypage__title-row">
            <button
              type="button"
              className="mypage__title-btn"
              onClick={() => setActiveNav('overview')}
            >
              마이페이지
            </button>
            <button
              type="button"
              className="mypage__back mypage__back--icon"
              onClick={returnToWorkspace}
              aria-label="검수 화면으로 돌아가기"
              title="검수 화면으로 돌아가기"
            >
              <ArrowLeft size={18} aria-hidden />
            </button>
          </div>
        </header>
        <div className="mypage__user">
          <p className="mypage__user-name">
            <span>{displayName} 님</span>
            {daysWithMomo != null ? (
              <span className="mypage__user-tenure">
                모모와 함께한 {daysWithMomo}일
              </span>
            ) : null}
          </p>
          {email ? <p className="mypage__user-email">{email}</p> : null}
        </div>
        <nav aria-label="계정 메뉴">
          <ul className="mypage__nav">
            {SIDEBAR_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`mypage__nav-btn${activeNav === item.id ? ' mypage__nav-btn--active' : ''}`}
                  onClick={() => setActiveNav(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="mypage__logout" onClick={() => void handleLogout()}>
          로그아웃
        </button>
      </aside>

      <main className="mypage__main">
        {activeNav === 'overview' ? (
          <OverviewDashboard onViewAll={setActiveNav} />
        ) : activeNav === 'inquiry' ? (
          <InquiryHistorySection
            onNewInquiry={() => setInquiryModalOpen(true)}
          />
        ) : (
          <SectionPlaceholder sectionId={activeNav} />
        )}
      </main>
      <FeedbackModal
        open={inquiryModalOpen}
        onClose={() => setInquiryModalOpen(false)}
      />
    </div>
  );
}
