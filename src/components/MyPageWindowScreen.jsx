/**
 * ?window=mypage 보조 창: 프로필·배지·베타 안내.
 * App이 authSession·authReady만 전달.
 * 메인 작업창과 분리된 읽기·설정 UI (검수 플로우 끝단).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  isRuleSetsCloudEnabled,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import {
  loadActiveSetId,
  loadRuleSets,
  saveActiveSetId,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import { buildProjectCardViewModelFromRuleSet } from '../presentation/ruleSetProjectCard.js';
import {
  buildMockLibrarySlots,
  MOCK_LIBRARY_SLOT_MAX,
} from '../lib/mypageProjectDisplay.js';
import ProjectLibraryCard from '../mock/mypagePrototype/ProjectLibraryCard.jsx';
import ProjectLibraryEmptySlot from '../mock/mypagePrototype/ProjectLibraryEmptySlot.jsx';
import SharePreviewModal from '../mock/mypagePrototype/SharePreviewModal.jsx';
import {
  buildProjectTagFilterOptions,
  filterProjectsForLibrary,
} from '../presentation/projectCardViewModel.js';
import BadgeCollectionGrid from './BadgeCollectionGrid.jsx';
import { isMyPageProjectHubEnabled } from '../lib/featureFlags.js';
import './my-page.css';
import '../mock/mypagePrototype/mypage-prototype.css';

const SIDEBAR_NAV = [
  { id: 'profile', label: '회원 정보' },
  { id: 'projects', label: '나의 프로젝트' },
  { id: 'badges', label: '배지 모음집' },
];

/** @param {string} nav */
function resolveMypageNav(nav) {
  if (nav === 'home') return 'overview';
  if (
    nav === 'overview' ||
    nav === 'projects' ||
    nav === 'profile' ||
    nav === 'badges'
  ) {
    return nav;
  }
  return 'overview';
}

/** @type {ReadonlyArray<{ name: string, description: string, tabLimit: number }>} */
const MEMBER_BENEFIT_TIERS = [
  {
    name: '오픈베타 테스터',
    description:
      '오픈베타 기간 프로젝트 슬롯 [3개] 매일 맞춤법 [1회] + 표기 통일 [1회] 제공',
    tabLimit: 1,
  },
  {
    name: '비밀 연구원',
    description:
      '오픈베타 기간 프로젝트 슬롯 [3개] 매일 맞춤법 [2회] + 표기 통일 [2회] 제공',
    tabLimit: 2,
  },
  {
    name: '수석 검증관',
    description:
      '오픈베타 기간 프로젝트 슬롯 [3개] 매일 맞춤법 [3회] + 표기 통일 [3회] 제공',
    tabLimit: 3,
  },
];

const USAGE_PAGE_LIMIT = 20;

const FAQ_ITEMS = [
  {
    id: 'what',
    question: '인디야는 어떤 서비스인가요?',
    answer:
      '인디자인 등에서 만든 조판 PDF에서 맞춤법·표기 통일을 규칙으로 찾아 PDF 위에 표시하는 브라우저 도구입니다. AI가 문장을 고쳐 주지 않으며, 자동 탐지와 하이라이트만 제공합니다.',
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
    question: '맞춤법과 표기 통일은 무엇이 다른가요?',
    answer:
      '맞춤법 탭은 내장·주의 규칙으로 오탈자·띄어쓰기 후보를 찾습니다. 표기 통일 탭은 표기 통일·본보조·목차·본문 일치 등을 검수합니다.',
  },
  {
    id: 'beta',
    question: '오픈베타 기간 이용료가 있나요?',
    answer:
      '오픈베타 기간에는 회원에게 매일 맞춤법·표기 통일 각 1회 검수를 제공합니다(한국 시간 기준). 피드백을 남기면 각 2회, 우수 피드백으로 선정되면 각 3회까지 이용할 수 있습니다.',
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
 * @param {number} remaining
 * @param {number} tabLimit
 */
function formatQuotaUsageLabel(remaining, tabLimit) {
  const left =
    remaining <= 0 ? '오늘 한도 소진' : `${remaining}회 남음`;
  return `${left} / 일 ${tabLimit}회`;
}

/**
 * @param {{ quota: ReturnType<typeof useBetaDailyQuota>, authUid?: string, loginAtMs?: number | null }} props
 */
function MemberOverviewCard({ quota, authUid = '', loginAtMs = null }) {
  const tier = useMemo(
    () => (quota.loading ? null : resolveMemberBenefitTier(quota, authUid)),
    [quota, authUid],
  );

  const recentLine = useMemo(() => {
    const [latest] = getRecentUsageEntries(loginAtMs, 1);
    if (!latest) return '최근 이용 내역이 없습니다.';
    return `${formatMypageUsageDate(latest.atMs)} ${latest.label}`;
  }, [loginAtMs]);

  return (
    <section
      className="mypage__card mypage__member-overview"
      aria-labelledby="mypage-benefits-title"
    >
      <div className="mypage__card-head mypage__member-overview-head">
        <h2 id="mypage-benefits-title" className="mypage__card-title">
          회원 정보
        </h2>
        {quota.loading ? (
          <span className="mypage__tier-badge mypage__tier-badge--loading">
            불러오는 중…
          </span>
        ) : tier ? (
          <span
            className="mypage__tier-badge"
            title={tier.description}
            aria-label={`회원 등급: ${tier.name}. ${tier.description}`}
          >
            <span className="mypage__tier-badge__icon" aria-hidden>
              ★
            </span>
            {tier.name}
          </span>
        ) : null}
      </div>

      {quota.loading ? (
        <p className="mypage__benefits-note">회원 등급과 검수 한도를 불러오는 중…</p>
      ) : !quota.enforced ? (
        <p className="mypage__benefits-note">
          개발 환경 — 검수 한도가 적용되지 않습니다.
        </p>
      ) : (
        <dl className="mypage__quota-stats" aria-label="오늘 검수 한도">
          <div
            className={`mypage__quota-stat${quota.spellingRemaining <= 0 ? ' mypage__quota-stat--depleted' : ''}`}
          >
            <dt>맞춤법</dt>
            <dd className="mypage__quota-usage">
              {formatQuotaUsageLabel(
                quota.spellingRemaining,
                quota.tabLimit,
              )}
            </dd>
          </div>
          <div
            className={`mypage__quota-stat${quota.consistencyRemaining <= 0 ? ' mypage__quota-stat--depleted' : ''}`}
          >
            <dt>표기 통일</dt>
            <dd className="mypage__quota-usage">
              {formatQuotaUsageLabel(
                quota.consistencyRemaining,
                quota.tabLimit,
              )}
            </dd>
          </div>
        </dl>
      )}

      {!quota.loading ? (
        <p className="mypage__benefits-recent mypage__benefits-recent--sub">
          {recentLine}
        </p>
      ) : null}
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

function OverviewBadgePanel({ badges, earnedCount, totalLabel, onOpen }) {
  return (
    <div className="mypage__badge-column">
      <section
        className="mypage__card mypage__badge-card mypage__card--badge-preview mypage__card--nav-link"
        aria-labelledby="mypage-badge-overview-title"
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={
          onOpen
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
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
 *   entryCardId?: string | null,
 *   onEntryApplied?: () => void,
 * }} props
 */
function ProjectHubSection({
  uid,
  email,
  entryCardId = null,
  onEntryApplied,
}) {
  const {
    projects,
    activeSetId,
    loading,
    selectProject,
    renameProject,
    duplicateProject,
    updateProjectMeta,
  } = useMyPageProjects(uid, email);

  const [tagFilter, setTagFilter] = useState(/** @type {string | null} */ (null));
  const [sharePreviewCardId, setSharePreviewCardId] = useState(
    /** @type {string | null} */ (null),
  );

  const cards = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            Date.parse(b.savedAt ?? '') - Date.parse(a.savedAt ?? ''),
        )
        .map((set) =>
          buildProjectCardViewModelFromRuleSet(set, {
            isActive: set.id === activeSetId,
          }),
        ),
    [projects, activeSetId],
  );

  const tagFilterOptions = useMemo(
    () => buildProjectTagFilterOptions(cards),
    [cards],
  );

  const filteredCards = useMemo(
    () => filterProjectsForLibrary(cards, tagFilter),
    [cards, tagFilter],
  );

  const sharePreviewCard = useMemo(
    () => cards.find((card) => card.id === sharePreviewCardId) ?? null,
    [cards, sharePreviewCardId],
  );

  const librarySlots = useMemo(
    () => buildMockLibrarySlots(cards),
    [cards],
  );

  useEffect(() => {
    if (!tagFilter) return;
    const stillValid = tagFilterOptions.some((option) => option.id === tagFilter);
    if (!stillValid) setTagFilter(null);
  }, [tagFilter, tagFilterOptions]);

  useEffect(() => {
    if (!entryCardId) return;
    onEntryApplied?.();
  }, [entryCardId, onEntryApplied]);

  const handleRename = useCallback(
    async (cardId, title) => {
      const result = await renameProject(cardId, title);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [renameProject],
  );

  const handleDuplicate = useCallback(
    async (cardId) => {
      const result = await duplicateProject(cardId);
      if (!result.ok && result.message) {
        window.alert(result.message);
      }
    },
    [duplicateProject],
  );

  const handleUpdateMeta = useCallback(
    async (cardId, patch) => {
      await updateProjectMeta(cardId, patch);
    },
    [updateProjectMeta],
  );

  const handleStartWork = useCallback(
    async (cardId) => {
      const result = await selectProject(cardId);
      if (!result.ok) {
        window.alert('프로젝트 선택을 저장하지 못했습니다. 다시 시도해 주세요.');
        return;
      }
      returnToWorkspace();
    },
    [selectProject],
  );

  return (
    <>
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
            </div>
          </div>
          <p className="mypage__project-slot-gauge">
            슬롯 <strong>{cards.length}/{MOCK_LIBRARY_SLOT_MAX}</strong>
          </p>
        </div>

        {loading ? (
          <p className="mypage__project-loading" role="status">
            프로젝트를 불러오는 중…
          </p>
        ) : (
          <>
            <div
              className="mypage-proto__filters"
              role="group"
              aria-label="태그 필터"
            >
              {tagFilterOptions.map(({ id, label }) => (
                <button
                  key={label}
                  type="button"
                  className={`mypage-proto__filter${tagFilter === id ? ' mypage-proto__filter--on' : ''}`}
                  onClick={() => setTagFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className={`mypage-proto__grid${tagFilter ? '' : ' mypage-proto__grid--triple'}`}
            >
              {tagFilter ? (
                <>
                  {filteredCards.map((card) => (
                    <ProjectLibraryCard
                      key={card.id}
                      card={card}
                      onRename={(title) => void handleRename(card.id, title)}
                      onUpdateMeta={(patch) =>
                        void handleUpdateMeta(card.id, patch)
                      }
                      onStartWork={() => void handleStartWork(card.id)}
                      onDuplicate={() => void handleDuplicate(card.id)}
                      onSharePreview={() => setSharePreviewCardId(card.id)}
                    />
                  ))}
                  {filteredCards.length === 0 ? (
                    <p className="mypage__project-filter-empty" role="status">
                      선택한 태그에 해당하는 프로젝트가 없습니다.
                    </p>
                  ) : null}
                </>
              ) : (
                librarySlots.map((card, index) =>
                  card ? (
                    <ProjectLibraryCard
                      key={card.id}
                      card={card}
                      onRename={(title) => void handleRename(card.id, title)}
                      onUpdateMeta={(patch) =>
                        void handleUpdateMeta(card.id, patch)
                      }
                      onStartWork={() => void handleStartWork(card.id)}
                      onDuplicate={() => void handleDuplicate(card.id)}
                      onSharePreview={() => setSharePreviewCardId(card.id)}
                    />
                  ) : (
                    <ProjectLibraryEmptySlot key={`library-empty-slot-${index}`} />
                  ),
                )
              )}
            </div>
          </>
        )}
      </section>

      {sharePreviewCard ? (
        <SharePreviewModal
          card={sharePreviewCard}
          onClose={() => setSharePreviewCardId(null)}
        />
      ) : null}
    </>
  );
}

function MyPageOverviewSection({
  quota,
  authUid,
  loginAtMs,
  badges,
  earnedCount,
  totalLabel,
  projectUid,
  projectEmail,
  onOpenBadges,
}) {
  return (
    <div className="mypage__overview">
      <MemberOverviewCard
        quota={quota}
        authUid={authUid}
        loginAtMs={loginAtMs}
      />
      {isMyPageProjectHubEnabled() ? (
        <ProjectHubSection
          uid={projectUid}
          email={projectEmail}
        />
      ) : (
        <ProjectHubPlaceholderSection />
      )}
      <div className="mypage__overview-secondary">
        <OverviewBadgePanel
          badges={badges}
          earnedCount={earnedCount}
          totalLabel={totalLabel}
          onOpen={onOpenBadges}
        />
        <MyPageFaq />
      </div>
    </div>
  );
}

function ProjectHubPageSection({ uid, email, entryCardId, onEntryApplied }) {
  return (
    <div className="mypage__main-inner mypage__main-inner--section mypage__overview--projects">
      {isMyPageProjectHubEnabled() ? (
        <ProjectHubSection
          uid={uid}
          email={email}
          entryCardId={entryCardId}
          onEntryApplied={onEntryApplied}
        />
      ) : (
        <ProjectHubPlaceholderSection />
      )}
    </div>
  );
}

function ProjectHubPlaceholderSection() {
  return (
    <section
      className="mypage__card mypage__project-hub mypage__card--disabled"
      aria-labelledby="mypage-project-hub-title"
      aria-disabled="true"
    >
      <div className="mypage__project-hub-head">
        <div className="mypage__project-hub-title-row">
          <h1 id="mypage-project-hub-title" className="mypage__page-title">
            나의 프로젝트
          </h1>
        </div>
      </div>
      <div className="mypage__empty mypage__empty--disabled">
        <p className="mypage__empty-title">
          프로젝트 관리 화면을 준비하고 있습니다.
        </p>
        <p className="mypage__empty-desc">
          지금은 검수 화면에서 프로젝트를 저장·전환할 수 있습니다.
        </p>
      </div>
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
  const [projectsEntryCardId, setProjectsEntryCardId] = useState(
    /** @type {string | null} */ (null),
  );
  const resolvedNav = resolveMypageNav(activeNav);

  useEffect(() => {
    if (activeNav !== resolvedNav) {
      setActiveNav(resolvedNav);
    }
  }, [activeNav, resolvedNav]);
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

  const memberTier = useMemo(
    () =>
      quota.loading
        ? null
        : resolveMemberBenefitTier(quota, authSession?.uid ?? ''),
    [quota, authSession?.uid],
  );

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
    const uid = authSession?.uid?.trim() ?? '';
    if (uid) {
      const sets = loadRuleSets(uid);
      const activeId = loadActiveSetId(uid);
      saveRuleSets(sets, uid);
      if (activeId) saveActiveSetId(activeId, uid);
      if (isRuleSetsCloudEnabled()) {
        try {
          await saveRuleSetsCloud(uid, sets, activeId);
        } catch (e) {
          console.warn('기준 클라우드 저장 실패 (로그아웃)', e);
        }
      }
    }
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
            <span className="mypage__user-name-row">
              <span>{displayName} 님</span>
              {memberTier && !quota.loading ? (
                <span
                  className="mypage__tier-badge"
                  title={memberTier.description}
                >
                  <span className="mypage__tier-badge__icon" aria-hidden>
                    ★
                  </span>
                  {memberTier.name}
                </span>
              ) : null}
            </span>
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
                  className={`mypage__nav-btn${resolvedNav === resolveMypageNav(item.id) ? ' mypage__nav-btn--active' : ''}${item.disabled ? ' mypage__nav-btn--disabled' : ''}`}
                  onClick={() => {
                    if (item.disabled) return;
                    if (item.id === 'projects') {
                      setProjectsEntryCardId(null);
                    }
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
        {resolvedNav === 'overview' ? (
          <MyPageOverviewSection
            quota={quota}
            authUid={authSession.uid}
            loginAtMs={loginAtMs}
            badges={badges}
            earnedCount={badgeStats.earnedCount}
            totalLabel={badgeStats.totalLabel}
            projectUid={authSession.uid}
            projectEmail={quotaEmail}
            onOpenBadges={() => setActiveNav('badges')}
          />
        ) : resolvedNav === 'projects' ? (
          <ProjectHubPageSection
            uid={authSession.uid}
            email={quotaEmail}
            entryCardId={projectsEntryCardId}
            onEntryApplied={() => setProjectsEntryCardId(null)}
          />
        ) : resolvedNav === 'profile' ? (
          <ProfileSection
            displayName={displayName}
            email={email}
            daysWithMomo={daysWithMomo}
            loginAtMs={loginAtMs}
          />
        ) : resolvedNav === 'badges' ? (
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
