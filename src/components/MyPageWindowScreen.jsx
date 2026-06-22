/**
 * ?window=mypage 보조 창: 프로필·배지·베타 안내.
 * App이 authSession·authReady만 전달.
 * 메인 작업창과 분리된 읽기·설정 UI (검수 플로우 끝단).
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { returnToWorkspace } from '../lib/returnToWorkspace.js';
import {
  resolveSessionEmail,
  resolveSessionEmailAsync,
  signOutUser,
} from '../lib/firebaseAuth.js';
import { getUserProfile } from '../lib/userProfileStorage.js';
import {
  daysSinceJoin,
  syncProfileBadges,
} from '../lib/badgeGrants.js';
import {
  getBadgeCollectionStats,
  getUserBadgeCollection,
  syncBadgeShowcase,
} from '../lib/userBadges.js';
import { resolveQuotaAuthEmail } from '../lib/betaDailyQuota.js';
import { clearRewardNotice } from '../lib/rewardNotice.js';
import { getEarnedBadgeIds } from '../lib/userBadges.js';
import { useBetaDailyQuota } from '../hooks/useBetaDailyQuota.js';
import { useMyPageProjects } from '../hooks/useMyPageProjects.js';
import { buildProjectCardSummary } from '../lib/projectCardSummary.js';
import { criteriaNameForInput } from '../lib/criteriaName.js';
import BadgeCollectionGrid from './BadgeCollectionGrid.jsx';
import './my-page.css';

const SIDEBAR_NAV = [
  { id: 'profile', label: '회원 정보' },
  { id: 'overview', label: '나의 프로젝트' },
  { id: 'badges', label: '배지 모음집' },
];

/** @type {ReadonlyArray<{ name: string, description: string, tabLimit: number }>} */
const MEMBER_BENEFIT_TIERS = [
  {
    name: '오픈베타 테스터',
    description:
      '오픈베타 기간 프로젝트 슬롯 [1개] 매일 맞춤법 검수 [1회] + 일관성 검수 [1회] 제공',
    tabLimit: 1,
  },
  {
    name: '비밀 연구원',
    description:
      '오픈베타 기간 프로젝트 슬롯 [1개] 매일 맞춤법 검수 [2회] + 일관성 검수 [2회] 제공',
    tabLimit: 2,
  },
  {
    name: '수석 검증관',
    description:
      '오픈베타 기간 프로젝트 슬롯 [1개] 매일 맞춤법 검수 [3회] + 일관성 검수 [3회] 제공',
    tabLimit: 3,
  },
];

const USAGE_PAGE_LIMIT = 20;

const FAQ_ITEMS = [
  {
    id: 'what',
    question: '인디야는 어떤 서비스인가요?',
    answer:
      '인디자인 등에서 만든 조판 PDF에서 맞춤법·표기 일관성을 규칙으로 찾아 PDF 위에 표시하는 브라우저 도구입니다. AI가 문장을 고쳐 주지 않으며, 자동 탐지와 하이라이트만 제공합니다.',
  },
  {
    id: 'privacy',
    question: 'PDF가 서버로 올라가나요?',
    answer:
      '검수에 쓰는 PDF 본문은 브라우저 안에서만 처리됩니다. 원고를 서버에 업로드해 AI 교정을 받는 방식이 아닙니다.',
  },
  {
    id: 'pdf-type',
    question: '어떤 PDF를 지원하나요?',
    answer:
      '텍스트가 선택·추출되는 PDF를 권장합니다. 스캔(이미지) PDF는 지원하지 않으며, 100MB를 넘으면 검수할 수 없습니다(50MB 이하 권장).',
  },
  {
    id: 'tabs',
    question: '맞춤법과 일관성 검수는 무엇이 다른가요?',
    answer:
      '맞춤법 검수 탭은 내장·주의 규칙으로 오탈자·띄어쓰기 후보를 찾습니다. 일관성 검수 탭은 표기 통일 규칙·본보조·목차·본문 일치 등을 검수합니다.',
  },
  {
    id: 'beta',
    question: '오픈베타 기간 이용료가 있나요?',
    answer:
      '오픈베타 기간에는 회원에게 매일 맞춤법·일관성 각 1회 검수를 제공합니다(한국 시간 기준). 피드백을 남기면 각 2회, 우수 피드백으로 선정되면 각 3회까지 이용할 수 있습니다.',
  },
  {
    id: 'device',
    question: '모바일에서도 검수할 수 있나요?',
    answer:
      '본격 검수는 PC·Chrome/Edge 환경을 권장합니다. 모바일은 대문·둘러보기 수준으로, 세밀한 교열 작업에는 PC가 적합합니다.',
  },
];

/**
 * @param {number | null | undefined} loginAtMs
 * @param {number} [limit]
 */
function getRecentUsageEntries(loginAtMs, limit = USAGE_PAGE_LIMIT) {
  /** @type {Array<{ atMs: number, label: string }>} */
  const entries = [];
  if (loginAtMs && Number.isFinite(loginAtMs)) {
    entries.push({ atMs: loginAtMs, label: '로그인' });
  }
  return entries
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, limit);
}

/** @param {import('../lib/ruleSetsStorage.js').RuleSet} set */
function projectDisplayName(set) {
  const name = criteriaNameForInput(set.name);
  return name || '이름 없는 프로젝트';
}

function RecentUsageTable({ entries }) {
  if (!entries.length) {
    return (
      <p className="mypage__empty-desc mypage__usage-empty">
        최근 이용 내역이 없습니다.
      </p>
    );
  }

  return (
    <table className="mypage__table">
      <thead>
        <tr>
          <th scope="col">날짜</th>
          <th scope="col">내용</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={`${entry.atMs}-${entry.label}`}>
            <td>{formatMypageUsageDate(entry.atMs)}</td>
            <td>{entry.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatMypageUsageDate(timestampMs) {
  if (!timestampMs || !Number.isFinite(timestampMs)) return '—';
  return new Date(timestampMs).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * @param {ReturnType<typeof useBetaDailyQuota>} quota
 * @param {string} [uid]
 */
function resolveMemberBenefitTier(quota, uid = '') {
  if (quota.hasBoostApprovedToday) return MEMBER_BENEFIT_TIERS[2];
  if (quota.hasFeedbackBonusToday) return MEMBER_BENEFIT_TIERS[1];

  const earned = getEarnedBadgeIds(uid.trim());
  if (earned.has('slot-3')) return MEMBER_BENEFIT_TIERS[2];
  if (earned.has('slot-2')) return MEMBER_BENEFIT_TIERS[1];

  const match =
    MEMBER_BENEFIT_TIERS.find((tier) => tier.tabLimit === quota.tabLimit) ??
    MEMBER_BENEFIT_TIERS[0];
  return match;
}

/**
 * @param {{ quota: ReturnType<typeof useBetaDailyQuota>, authUid?: string }} props
 */
function MemberBenefitTierBanner({ quota, authUid = '' }) {
  if (quota.loading) {
    return (
      <p className="mypage__member-tier mypage__member-tier--loading">
        오늘 남은 검수 횟수를 불러오는 중…
      </p>
    );
  }

  const tier = resolveMemberBenefitTier(quota, authUid);

  return (
    <p className="mypage__member-tier" aria-label={`${tier.name}. ${tier.description}`}>
      <strong className="mypage__member-tier-name">{tier.name}</strong>
      <span className="mypage__member-tier-sep" aria-hidden>
        {' '}
        :{' '}
      </span>
      <span className="mypage__member-tier-desc">{tier.description}</span>
    </p>
  );
}

/**
 * @param {{ quota: ReturnType<typeof useBetaDailyQuota> }} props
 */
function MyBenefitsSection({ quota }) {
  return (
    <section
      className="mypage__card mypage__benefits-card"
      aria-labelledby="mypage-benefits-title"
    >
      <h2 id="mypage-benefits-title" className="mypage__card-title">
        회원 정보
      </h2>
      {quota.loading ? null : !quota.enforced ? (
        <p className="mypage__benefits-note">
          개발 환경 — 검수 한도가 적용되지 않습니다.
        </p>
      ) : (
        <dl className="mypage__benefits-grid">
          <div className="mypage__benefits-row">
            <dt>맞춤법 검수</dt>
            <dd>
              <strong>{quota.spellingRemaining}회</strong> 남음
              <span className="mypage__benefits-used">
                (사용 {quota.spellingCount}/{quota.tabLimit})
              </span>
            </dd>
          </div>
          <div className="mypage__benefits-row">
            <dt>일관성 검수</dt>
            <dd>
              <strong>{quota.consistencyRemaining}회</strong> 남음
              <span className="mypage__benefits-used">
                (사용 {quota.consistencyCount}/{quota.tabLimit})
              </span>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function BadgeCollectionTitleRow({ titleId, titleClassName, earnedCount, totalLabel }) {
  return (
    <div className="mypage__badge-title-row">
      <h2 id={titleId} className={titleClassName}>
        배지 모음집
      </h2>
      <p className="mypage__badge-count" aria-live="polite">
        획득 {earnedCount}/{totalLabel}
      </p>
    </div>
  );
}

function BadgeCollectionSection({ badges, earnedCount, totalLabel }) {
  return (
    <div className="mypage__main-inner mypage__main-inner--section">
      <section
        className="mypage__card mypage__badge-card"
        aria-labelledby="mypage-badge-title"
      >
        <div className="mypage__badge-head">
          <BadgeCollectionTitleRow
            titleId="mypage-badge-title"
            titleClassName="mypage__page-title mypage__page-title--in-card"
            earnedCount={earnedCount}
            totalLabel={totalLabel}
          />
          <p className="mypage__badge-lead">
            이벤트·활동으로 모은 배지를 확인할 수 있습니다.
          </p>
        </div>
        <BadgeCollectionGrid badges={badges} />
      </section>
    </div>
  );
}

function OverviewBadgePanel({ badges, earnedCount, totalLabel }) {
  return (
    <div className="mypage__badge-column">
      <section
        className="mypage__card mypage__badge-card mypage__card--badge-preview"
        aria-labelledby="mypage-badge-overview-title"
      >
        <div className="mypage__badge-head">
          <BadgeCollectionTitleRow
            titleId="mypage-badge-overview-title"
            titleClassName="mypage__card-title"
            earnedCount={earnedCount}
            totalLabel={totalLabel}
          />
          <p className="mypage__badge-lead">
            이벤트·활동으로 모은 배지를 확인할 수 있습니다.
          </p>
        </div>
        <BadgeCollectionGrid badges={badges} />
      </section>
    </div>
  );
}

/**
 * @param {{
 *   uid: string,
 *   email: string,
 * }} props
 */
function ProjectHubSection({ uid, email }) {
  const {
    projects,
    activeSetId,
    loading,
    savedCount,
    maxSlots,
    exempt,
    emptySlotCount,
  } = useMyPageProjects(uid, email);

  const slotLabel = exempt
    ? `${savedCount}개`
    : `${savedCount}/${maxSlots}`;

  return (
    <section
      className="mypage__card mypage__project-hub"
      aria-labelledby="mypage-project-hub-title"
    >
      <div className="mypage__project-hub-head">
        <div>
          <div className="mypage__project-hub-title-row">
            <h1 id="mypage-project-hub-title" className="mypage__page-title">
              나의 프로젝트
            </h1>
            <span className="mypage__project-preparing">
              - 프로젝트를 관리하고 회원과 공유합니다(준비중)
            </span>
          </div>
        </div>
        <p className="mypage__project-slot-gauge" aria-live="polite">
          슬롯 <strong>{slotLabel}</strong>
        </p>
      </div>

      {loading ? (
        <p className="mypage__project-loading" role="status">
          프로젝트를 불러오는 중…
        </p>
      ) : (
        <div className="mypage__project-slots">
          {projects.map((set) => {
            const isActive = set.id === activeSetId;
            const summary = buildProjectCardSummary(set);
            return (
              <article
                key={set.id}
                className={`mypage__project-card${isActive ? ' mypage__project-card--active' : ''}`}
              >
                <div className="mypage__project-card-head">
                  <h2 className="mypage__project-name">
                    {projectDisplayName(set)}
                  </h2>
                  {summary.savedDate ? (
                    <span className="mypage__project-date-badge">
                      {summary.savedDate}
                    </span>
                  ) : null}
                </div>
                <dl className="mypage__project-spec">
                  <div className="mypage__project-spec-row">
                    <dt className="mypage__project-spec-label">맞춤법 검수</dt>
                    <dd className="mypage__project-spec-value">
                      편집자 검토 필요({summary.spelling.editorReview}건), 맞춤법({summary.spelling.spelling}건)
                    </dd>
                  </div>
                  <div className="mypage__project-spec-row">
                    <dt className="mypage__project-spec-label">일관성 검수</dt>
                    <dd className="mypage__project-spec-value">
                      일관성 찾기({summary.consistency.find}), 공통 문자열 찾기 ({summary.consistency.commonString}), 검수 제외 단어 '{summary.consistency.excludeWords}'
                    </dd>
                  </div>
                  <div className="mypage__project-spec-row">
                    <dt className="mypage__project-spec-label">
                      본용언 + 보조용언 표기
                    </dt>
                    <dd className="mypage__project-spec-value">
                      {summary.auxiliary}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}

          {Array.from({ length: emptySlotCount }, (_, index) => (
            <div
              key={`empty-slot-${index}`}
              className="mypage__project-slot mypage__project-slot--empty"
            >
              <p className="mypage__project-slot-label">빈 슬롯</p>
              <p className="mypage__project-slot-desc">
                검수 화면에서 기준을 저장하면 여기에 표시됩니다.
              </p>
            </div>
          ))}

          {!loading && projects.length === 0 && emptySlotCount === 0 ? (
            <div className="mypage__project-empty">
              <p className="mypage__empty-title">저장된 프로젝트가 없습니다.</p>
              <p className="mypage__empty-desc">
                검수 화면에서 맞춤법·일관성 기준을 저장해 주세요.
              </p>
              <button
                type="button"
                className="mypage__project-load"
                onClick={returnToWorkspace}
              >
                검수 화면으로 이동
              </button>
            </div>
          ) : null}
        </div>
      )}

    </section>
  );
}

function InquiryPlaceholderCard() {
  return (
    <section
      className="mypage__card mypage__card--disabled"
      aria-labelledby="mypage-inquiry-title"
      aria-disabled="true"
    >
      <div className="mypage__card-head">
        <h2 id="mypage-inquiry-title" className="mypage__card-title">
          문의
        </h2>
        <span className="mypage__card-soon">준비 중</span>
      </div>
      <div className="mypage__empty mypage__empty--disabled">
        <p className="mypage__empty-title">문의 내역 기능을 준비 중입니다.</p>
        <p className="mypage__empty-desc">
          궁금한 점은 자주 묻는 질문을 먼저 확인해 주세요.
        </p>
      </div>
    </section>
  );
}

function MyPageFaq() {
  return (
    <aside className="mypage__faq" aria-labelledby="mypage-faq-title">
      <section className="mypage__card mypage__faq-card">
        <h2 id="mypage-faq-title" className="mypage__card-title">
          자주 묻는 질문
        </h2>
        <div className="mypage__faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.id} className="mypage__faq-item">
              <summary className="mypage__faq-question">{item.question}</summary>
              <p className="mypage__faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ProfileSection({ displayName, email, daysWithMomo, loginAtMs }) {
  const recentUsage = useMemo(
    () => getRecentUsageEntries(loginAtMs),
    [loginAtMs],
  );

  return (
    <div className="mypage__main-inner mypage__main-inner--section">
      <h1 className="mypage__page-title">회원 정보</h1>
      <section
        className="mypage__card mypage__profile-card"
        aria-labelledby="mypage-profile-title"
      >
        <h2 id="mypage-profile-title" className="mypage__card-title">
          계정 정보
        </h2>
        <dl className="mypage__profile-fields">
          <div className="mypage__profile-row">
            <dt>닉네임</dt>
            <dd>{displayName}</dd>
          </div>
          <div className="mypage__profile-row">
            <dt>이메일</dt>
            <dd>
              {email ? (
                email
              ) : (
                <span className="mypage__profile-value--muted">
                  Google 로그인 이메일을 불러오지 못했습니다. 로그아웃 후 다시
                  로그인해 주세요.
                </span>
              )}
            </dd>
          </div>
          {daysWithMomo != null ? (
            <div className="mypage__profile-row">
              <dt>이용 기간</dt>
              <dd>모모와 함께한 {daysWithMomo}일</dd>
            </div>
          ) : null}
        </dl>
        <p className="mypage__profile-note">
          이메일은 Google 로그인 계정이며, 인디야에서 변경할 수 없습니다.
        </p>
      </section>

      <section className="mypage__card" aria-labelledby="mypage-usage-title">
        <div className="mypage__card-head">
          <h2 id="mypage-usage-title" className="mypage__card-title">
            이용 내역
          </h2>
        </div>
        <RecentUsageTable entries={recentUsage} />
      </section>

      <InquiryPlaceholderCard />
    </div>
  );
}

/**
 * @param {{
 *   authSession: ReturnType<import('../lib/firebaseAuth.js').getCurrentUserSession>,
 *   authReady: boolean,
 * }} props
 */
export default function MyPageWindowScreen({ authSession, authReady }) {
  const [activeNav, setActiveNav] = useState('overview');
  const [badgeRev, setBadgeRev] = useState(0);

  const profile = authSession?.uid ? getUserProfile(authSession.uid) : null;
  const displayName = useMemo(() => {
    const nickname = profile?.nickname?.trim();
    if (nickname) return nickname;
    const name = authSession?.displayName?.trim();
    if (name) return name;
    return '게스트';
  }, [authSession?.displayName, profile?.nickname]);

  const [email, setEmail] = useState(() => resolveSessionEmail(authSession));

  useEffect(() => {
    const sync = resolveSessionEmail(authSession);
    setEmail(sync);
    if (sync || !authSession?.uid) return undefined;
    let cancelled = false;
    void resolveSessionEmailAsync(authSession).then((resolved) => {
      if (!cancelled && resolved) setEmail(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [authSession]);

  const daysWithMomo = useMemo(() => {
    const joinedMs = authSession?.createdAtMs ?? profile?.completedAt ?? null;
    return daysSinceJoin(joinedMs);
  }, [authSession?.createdAtMs, profile?.completedAt]);

  const badges = useMemo(
    () => getUserBadgeCollection(authSession?.uid ?? ''),
    [authSession?.uid, badgeRev],
  );

  const badgeStats = useMemo(
    () => getBadgeCollectionStats(authSession?.uid ?? ''),
    [authSession?.uid, badgeRev],
  );

  const loginAtMs = useMemo(
    () =>
      authSession?.lastSignInMs ??
      authSession?.createdAtMs ??
      profile?.completedAt ??
      null,
    [authSession?.lastSignInMs, authSession?.createdAtMs, profile?.completedAt],
  );

  const quotaEmail = useMemo(
    () => resolveQuotaAuthEmail(authSession),
    [authSession],
  );
  const quota = useBetaDailyQuota(authSession?.uid ?? '', quotaEmail);

  useEffect(() => {
    const uid = authSession?.uid?.trim();
    if (uid) clearRewardNotice(uid);
  }, [authSession?.uid]);

  useEffect(() => {
    const uid = authSession?.uid?.trim();
    if (!uid || quota.loading) return;
    let changed = syncProfileBadges(uid, {
      tenureDays: daysWithMomo,
      hasBoostApprovedToday: quota.hasBoostApprovedToday,
    });
    if (syncBadgeShowcase(uid, quotaEmail)) changed = true;
    if (changed) setBadgeRev((rev) => rev + 1);
  }, [
    authSession?.uid,
    daysWithMomo,
    quota.loading,
    quota.hasBoostApprovedToday,
    quotaEmail,
  ]);

  async function handleLogout() {
    await signOutUser();
    const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
    window.location.replace(url.toString());
  }

  if (!authReady) {
    return (
      <div className="mypage mypage--boot">
        <main className="mypage__main">
          <div className="app-loading" role="status" aria-live="polite">
            <p>로그인 정보를 확인하는 중…</p>
          </div>
        </main>
      </div>
    );
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
          {email ? (
            <p className="mypage__user-email">{email}</p>
          ) : (
            <p className="mypage__user-email mypage__user-email--missing">
              로그인 이메일을 불러오지 못했습니다. 로그아웃 후 다시 로그인해
              주세요.
            </p>
          )}
        </div>
        <nav aria-label="계정 메뉴">
          <ul className="mypage__nav">
            {SIDEBAR_NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`mypage__nav-btn${activeNav === item.id ? ' mypage__nav-btn--active' : ''}${item.disabled ? ' mypage__nav-btn--disabled' : ''}`}
                  onClick={() => {
                    if (item.disabled) return;
                    setActiveNav(item.id);
                  }}
                  disabled={item.disabled}
                  aria-disabled={item.disabled || undefined}
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
          <div className="mypage__overview">
            <div className="mypage__member-head">
              <MemberBenefitTierBanner quota={quota} authUid={authSession.uid} />
              <MyBenefitsSection quota={quota} />
            </div>
            <ProjectHubSection uid={authSession.uid} email={quotaEmail} />
            <div className="mypage__overview-secondary">
              <OverviewBadgePanel
                badges={badges}
                earnedCount={badgeStats.earnedCount}
                totalLabel={badgeStats.totalLabel}
              />
              <MyPageFaq />
            </div>
          </div>
        ) : activeNav === 'profile' ? (
          <ProfileSection
            displayName={displayName}
            email={email}
            daysWithMomo={daysWithMomo}
            loginAtMs={loginAtMs}
          />
        ) : activeNav === 'badges' ? (
          <BadgeCollectionSection
            badges={badges}
            earnedCount={badgeStats.earnedCount}
            totalLabel={badgeStats.totalLabel}
          />
        ) : null}
      </main>
    </div>
  );
}
