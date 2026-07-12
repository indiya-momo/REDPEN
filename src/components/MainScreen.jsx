/**
 * PDF 업로드·탭(맞춤법/일관성)·검수 실행·결과·하이라이트 작업 화면 전체.
 * subscribeAuthSession으로 uid·이메일·한도·인사말 처리 (App과 별도 구독).
 * useRuleCheck/usePdfDocument/useBetaDailyQuota 조합; 마이페이지·피드백은 App 콜백.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FilePlus,
  House,
  Loader2,
  LogOut,
  MessageSquare,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import LoanwordConverter from './LoanwordConverter.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import PanelSectionRunButton from './PanelSectionRunButton.jsx';
import PdfPreviewBar from './PdfPreviewBar.jsx';
import PdfZoomBar from './PdfZoomBar.jsx';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import TooltipGuide from './TooltipGuide.jsx';
import PrintedPageSetup from './PrintedPageSetup.jsx';
import PdfCenterStage from './PdfCenterStage.jsx';
import CriteriaSaveModal from './CriteriaSaveModal.jsx';
import { showAppConfirm } from '../lib/appDialog.js';
import { formatProjectDialogLabel } from '../lib/projectDialogLabel.js';
import TocBodyResultsPanel from '../toc-body/components/TocBodyResultsPanel.jsx';
import { useTocBodyCheck } from '../toc-body/hooks/useTocBodyCheck.js';
import { useTocBodyHighlights } from '../toc-body/hooks/useTocBodyHighlights.js';
import { buildTocBodyTabEntries } from '../toc-body/utils/toc-body-result-entries.js';
import { exportSpellingResults, exportConsistencyResults } from '../lib/exportResults.js';
import {
  isLoanwordConverterEnabled,
  isSpellingExportEnabled,
  isTocBodyCheckEnabled,
} from '../lib/featureFlags.js';
import { usePdfDocument } from '../hooks/usePdfDocument.js';
import { usePdfZoom } from '../hooks/usePdfZoom.js';
import { useRuleCheck } from '../hooks/useRuleCheck.js';
import { useWorkSession } from '../hooks/useWorkSession.js';
import { useGuestBrowseDemoPdf } from '../hooks/useGuestBrowseDemoPdf.js';
import { isOnboardingSamplePdfName } from '../lib/onboardingSamplePdf.js';
import {
  findGuestBrowseDemoSpellingGroup,
  guestBrowseAllowsDemoPdfAutoLoad,
  guestBrowseAutoRunsCriteriaCheck,
  guestBrowseBlocksResultExport,
  guestBrowseHidesGreetingText,
  guestBrowseHidesProjectList,
  guestBrowseHidesProjectSaveUi,
  guestBrowseHidesThumbStrip,
  guestBrowseProjectDisplayName,
  isGuestBrowseExportGuideReady,
  isGuestBrowseNextGuideReady,
  markGuestBrowseCriteriaClick,
  prepareGuestBrowseConsistencyRules,
  subscribeGuestBrowseExportGuide,
  subscribeGuestBrowseNextGuide,
} from '../lib/guestBrowsePolicy.js';
import GuideClickHand from './GuideClickHand.jsx';
import { useHighlights } from '../hooks/useHighlights.js';
import {
  PANEL_LEFT_MAX_WIDTH,
  PANEL_LEFT_MIN_WIDTH,
  useResizablePanelWidth,
} from '../hooks/useResizablePanelWidth.js';
import { usePrintedPageDisplay } from '../hooks/usePrintedPageDisplay.js';
import { trackFeedbackOpened, trackGuestBrowseCompleted } from '../lib/analytics.js';
import { openFeedbackFormForUser } from '../lib/feedbackConfig.js';
import { FEEDBACK_SUBMIT_THANK_BUBBLE_LINES } from '../lib/betaDailyQuota.js';
import {
  getCurrentUserSession,
  subscribeAuthSession,
} from '../lib/firebaseAuth.js';
import { criteriaNameForInput } from '../lib/criteriaName.js';
import { buildProjectContextWorkPatch } from '../lib/projectMeta.js';
import { getUserProfile } from '../lib/userProfileStorage.js';
import { useUserProfileSync } from '../hooks/useUserProfileSync.js';
import { WORK_GUIDE_KEYS } from '../lib/workGuideKeys.js';
import { useWorkGuideChain } from '../hooks/useWorkGuideChain.js';
import { useBetaDailyQuota } from '../hooks/useBetaDailyQuota.js';
import { useRewardNotice } from '../hooks/useRewardNotice.js';
import { daysSinceJoin, syncProfileBadges } from '../lib/badgeGrants.js';
import { isCheckAuthBlocked } from '../lib/checkAuthGate.js';
import { resolveQuotaAuthEmail, assertBetaDailyExportOrAlert } from '../lib/betaDailyQuota.js';
import {
  countBuiltInActiveRules,
  countSpacingReviewActiveRules,
} from '../lib/activeRuleCount.js';
import { countConsistencyCheckActiveRules, countConsistencyFindingsByType, countConsistencyGroupsWithFindings } from '../lib/consistencyCheckConfirm.js';
import { countSpellingGroupsWithFindings, countSpellingFindingsByCategory } from '../lib/spellingCheckConfirm.js';
import { LITERAL_FIND_FEATURE_LABEL } from '../lib/consistencyRuleLimit.js';
import { formatRuleSetSavedDate } from '../lib/ruleSetsStorage.js';
import {
  buildTabEntries,
  clampPageNumber,
  countTabTotalFindings,
  getCenterRunLabel,
  getSpellingTabLayoutClassName,
  isTabCheckDone,
  persistThumbStripOpenPreference,
  readThumbStripOpenPreference,
  shouldShowPdfViewer,
} from '../utils/main-screen-helpers.js';

function buildProofreadExportFilename(pdfFileName, label) {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;
  const rawProject = pdfFileName
    ? pdfFileName.replace(/\.[^.]+$/, '')
    : '프로젝트명';
  const projectPart = rawProject.replace(/[\\/:*?"<>|]/g, '_');
  return `${datePart}_${projectPart}_인디야_${label}.xlsx`;
}

/** 1번 — 기준 검수 버튼 바로 아래 (좌측 패널 안에 보이도록) */
const WORK_GUIDE_1_ALIGN = {
  selector: '[data-work-guide-criteria-run]',
  leftFromTargetLeft: 0,
  topFromTargetBottom: 10,
};

/** 4번 — 우측 상단 인사말(○○님 안녕하세요) 아래 120px */
const WORK_GUIDE_GREETING_ALIGN = {
  selector: '.work-guide-anchor--greeting',
  leftFromTargetLeft: 0,
  topFromTargetTop: 120,
};

/** 다운로드 가이드 — 검수 결과 다운로드 버튼 아래 */
const WORK_GUIDE_EXPORT_ALIGN = {
  selector: '[data-work-guide="consistency-export"]',
  leftFromTargetLeft: 0,
  topFromTargetBottom: 10,
};

/** 7번 — 로그아웃 버튼 아래, 버튼 오른쪽 끝 기준으로 말풍선을 왼쪽으로 펼침 */
const WORK_GUIDE_7_ALIGN = {
  selector: '.work-guide-anchor--logout',
  leftFromTargetLeft: 100,
  topFromTargetBottom: 8,
  fixedTransform: 'translate(-100%, 0)',
};

/** 5번 — 가로 4번, 세로 본용언+보조용언 박스 상단 */
const WORK_GUIDE_5_ALIGN_CHAIN = [
  {
    alignSplit: {
      horizontal: {
        selector: '[data-work-guide-bubble="4"]',
        leftFromTargetLeft: 0,
      },
      vertical: {
        selector: '[data-work-guide-step="auxiliary-box"]',
        topFromTargetTop: 0,
      },
    },
  },
  {
    alignSplit: {
      horizontal: {
        selector: '.pdf-work-pane__greeting',
        leftFromTargetLeft: 0,
      },
      vertical: {
        selector: '[data-work-guide-step="auxiliary-box"]',
        topFromTargetTop: 0,
      },
    },
  },
];

/** 통일형 📌 — 둘러보기 통일형(붉은 표시) 핀 오른쪽 */
const WORK_GUIDE_UNIFY_PIN_ALIGN = {
  selector: '[data-work-guide="unify-pin-silla"]',
  leftFromTargetLeft: 36,
  topFromTargetTop: -4,
};

/** 둘러보기 핀 가이드 대상 — 통일형 */
const GUEST_BROWSE_UNIFY_PIN_TAIL = '붉은 표시';

/** 2번 — 가로: 인사말 왼쪽, 세로: 3번(보정) 아래 또는 실행 행 */
const WORK_GUIDE_2_ALIGN_CHAIN = [
  {
    alignSplit: {
      horizontal: {
        selector: '.pdf-work-pane__greeting',
        leftFromTargetLeft: 0,
      },
      vertical: {
        selector: '[data-work-guide-step="3"]',
        topFromTargetBottom: 10,
      },
    },
  },
  {
    alignSplit: {
      horizontal: {
        selector: '.pdf-work-pane__greeting',
        leftFromTargetLeft: 0,
      },
      vertical: {
        selector: '.spelling-tab-layout__run-row',
        topFromTargetBottom: 10,
      },
    },
  },
];

/**
 * 검수 메인 화면 (좌측 규칙·결과 / 우측 PDF).
 *
 * ## App ↔ MainScreen 계약 — dead props (9개)
 * 아래 props는 destructure만 하고 본문에서 사용하지 않는다.
 * 규칙 세트 UI가 “준비 중”이므로 의도적 미배선이며, 안정화 기간 제거 금지.
 * 상세: project-docs/app-mainscreen-contract.md
 *
 * | Dead prop | App 공급 |
 * |-----------|----------|
 * | ruleSets, activeSetId | useRuleSets 상태 |
 * | onSelectRuleSet, onCreateRuleSet, onDuplicateRuleSet, onDeleteRuleSet | useRuleSets CRUD |
 * | ruleSetSavedAt, onRuleSetNameChange, onSaveRules | 저장·이름 (UI 미연결) |
 *
 * **실제 persist:** builtInEnabled / cautionEnabled / customRules / globalExcludePhrases
 * 변경은 App의 updateActiveSet → autosave 경로 (onSaveRules 불필요).
 *
 * @param {{
 *   ruleSets: { id: string, name: string, savedAt?: string }[],
 *   activeSetId: string,
 *   onSelectRuleSet: (id: string) => void,
 *   onCreateRuleSet: () => void,
 *   onDuplicateRuleSet: () => void,
 *   onDeleteRuleSet: () => void,
 *   ruleSetSavedAt?: string,
 *   builtInEnabled: Record<string, boolean>,
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases: string[],
 *   tocBodyText?: string,
 *   onTocBodyTextChange?: (text: string) => void,
 *   tocBodyStartPage?: number | null,
 *   tocBodyExcludePages?: string,
 *   onTocBodyExcludePagesChange?: (value: string) => void,
 *   onRuleSetNameChange: (name: string) => void,
 *   onBuiltInToggle: (find: string) => void,
 *   onBuiltInSetAll: (enabled: boolean) => void,
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 *   onCautionSetAll: (enabled: boolean) => void,
 *   onCustomRulesChange: (
 *     rules: import('../lib/ruleTypes.js').Rule[],
 *     extra?: { consistencyDecisions?: import('../lib/consistencyDecisions.js').ConsistencyDecision[] },
 *   ) => void,
 *   consistencyDecisions?: import('../lib/consistencyDecisions.js').ConsistencyDecision[],
 *   decisionByUid?: string,
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   onSaveRules: () => void,
 *   onSaveCriteriaPreset: (
 *     name: string,
 *     options?: { projectContextSnapshot?: import('../lib/projectMeta.js').ProjectContext },
 *   ) => false | Promise<false | string>,
 *   onDeleteCriteriaPreset: (setId: string) => boolean | Promise<boolean>,
 *   onTouchActiveProjectContext?: (
 *     patch: Partial<import('../lib/projectMeta.js').ProjectContext>,
 *   ) => void,
 *   onOpenWelcome: () => void,
 *   onLogout: () => void | Promise<void>,
 *   onOpenMyPageWindow: () => void,
 *   onOpenGuideWindow: () => void,
 *   initialWorkTab?: 'spelling' | 'consistency',
 *   feedbackThankYouOpen?: boolean,
 *   onFeedbackThankYouDismiss?: () => void,
 *   rewardNoticeTick?: number,
 * }} props
 */
export default function MainScreen({
  ruleSets,
  activeSetId,
  onSelectRuleSet,
  onCreateRuleSet,
  onDuplicateRuleSet,
  onDeleteRuleSet,
  ruleSetSavedAt,
  builtInEnabled,
  customRules,
  consistencyDecisions = [],
  decisionByUid = '',
  globalExcludePhrases,
  tocBodyText = '',
  onTocBodyTextChange = () => {},
  tocBodyStartPage = null,
  tocBodyExcludePages = '',
  onTocBodyExcludePagesChange = () => {},
  onRuleSetNameChange,
  onBuiltInToggle,
  onBuiltInSetAll,
  cautionEnabled,
  onCautionToggle,
  onCautionSetAll,
  onCustomRulesChange,
  onGlobalExcludePhrasesChange,
  onSaveRules,
  onSaveCriteriaPreset,
  onDeleteCriteriaPreset,
  onTouchActiveProjectContext,
  onOpenWelcome,
  onLogout,
  onOpenMyPageWindow,
  onOpenGuideWindow,
  initialWorkTab = 'spelling',
  feedbackThankYouOpen = false,
  onFeedbackThankYouDismiss = () => {},
  rewardNoticeTick = 0,
}) {
  void onOpenGuideWindow;
  const [workTab, setWorkTab] = useState(initialWorkTab);
  /** @type {['toc' | 'rules', import('react').Dispatch<import('react').SetStateAction<'toc' | 'rules'>>]} */
  const [consistencyFocus, setConsistencyFocus] = useState('rules');
  /** 목차·표기 결과가 둘 다 있을 때 어느 패널을 보여줄지 (겹쳐 쌓지 않음) */
  const [lastConsistencyPane, setLastConsistencyPane] = useState(
    /** @type {'toc' | 'rules'} */ ('rules'),
  );
  const [thumbStripOpen, setThumbStripOpen] = useState(() =>
    guestBrowseHidesThumbStrip() ? false : readThumbStripOpenPreference(),
  );
  const [authSession, setAuthSession] = useState(() => getCurrentUserSession());
  const [criteriaNameInput, setCriteriaNameInput] = useState('');
  const [criteriaPickerOpen, setCriteriaPickerOpen] = useState(false);
  const [criteriaSavePending, setCriteriaSavePending] = useState(false);
  const [criteriaSaveModalOpen, setCriteriaSaveModalOpen] = useState(false);
  const [criteriaSaveModalName, setCriteriaSaveModalName] = useState('');
  const criteriaPickerRef = useRef(null);
  const afterCheckRef = useRef(async () => false);
  const { panelStyle, handleRef, startDrag } = useResizablePanelWidth(
    authSession?.uid ?? '',
  );

  const activeRuleSet = useMemo(
    () => ruleSets.find((set) => set.id === activeSetId) ?? null,
    [ruleSets, activeSetId],
  );

  const savedRuleSets = useMemo(() => {
    return [...ruleSets]
      .filter((set) => Boolean(set.savedAt))
      .sort((a, b) => {
        const timeA = Date.parse(a.savedAt);
        const timeB = Date.parse(b.savedAt);
        if (timeB !== timeA) return timeB - timeA;
        return (a.name || '').localeCompare(b.name || '', 'ko');
      });
  }, [ruleSets]);

  const projectPickerRuleSets = guestBrowseHidesProjectList()
    ? []
    : savedRuleSets;

  useEffect(() => {
    const guestName = guestBrowseProjectDisplayName();
    if (guestName) {
      setCriteriaNameInput(guestName);
      setCriteriaPickerOpen(false);
      return;
    }
    setCriteriaNameInput(activeRuleSet?.name ?? '');
  }, [activeRuleSet?.id, activeRuleSet?.name]);

  useEffect(() => subscribeAuthSession(setAuthSession), []);

  useEffect(() => {
    if (!criteriaPickerOpen) return undefined;
    function handlePointerDown(event) {
      if (criteriaPickerRef.current?.contains(event.target)) return;
      setCriteriaPickerOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [criteriaPickerOpen]);

  async function handleDeleteCriteria(setId) {
    const deleted = await onDeleteCriteriaPreset(setId);
    if (!deleted) return;
    if (savedRuleSets.length <= 1) {
      setCriteriaPickerOpen(false);
    }
  }

  async function selectSavedCriteria(set) {
    if (set.id === activeSetId) {
      setCriteriaNameInput(criteriaNameForInput(set.name));
      setCriteriaPickerOpen(false);
      return;
    }
    const label = formatProjectDialogLabel(set.name);
    if (
      !(await showAppConfirm({
        title: '프로젝트 전환',
        message:
          `${label} 프로젝트로 전환할까요?\n\n원고와 검사 결과는 초기화됩니다.`,
      }))
    ) {
      return;
    }
    setCriteriaPickerOpen(false);
    void Promise.resolve(onSelectRuleSet(set.id));
  }

  const authUid = authSession?.uid ?? '';
  const authEmail = resolveQuotaAuthEmail(authSession);
  const { profileRev } = useUserProfileSync(authUid);
  const greetingName = useMemo(() => {
    void profileRev;
    const profile = authUid ? getUserProfile(authUid) : null;
    const nickname = profile?.nickname?.trim();
    if (nickname) return nickname;
    const name = authSession?.displayName?.trim();
    if (name) return name;
    return null;
  }, [authUid, authSession?.displayName, profileRev]);

  const activeSavedRuleSetName = useMemo(() => {
    const name = activeRuleSet?.name?.trim();
    if (!name) return null;
    if (!activeRuleSet?.savedAt) return null;
    return name;
  }, [activeRuleSet]);

  const activeSavedRuleSetNameDisplay = useMemo(() => {
    if (!activeSavedRuleSetName) return null;
    if (activeSavedRuleSetName.length <= 15) return activeSavedRuleSetName;
    return `${activeSavedRuleSetName.slice(0, 15)}...`;
  }, [activeSavedRuleSetName]);

  const pdf = usePdfDocument();
  const pdfZoom = usePdfZoom(pdf.pdf);

  const pageDisplay = usePrintedPageDisplay({
    pdfFileName: pdf.pdfFileName,
    numPages: pdf.pdf?.numPages ?? 0,
    currentPage: pdf.currentPage,
  });
  const mapTocPrintPageToSystem = useCallback(
    (printPage) => {
      if (pageDisplay.active) {
        return pageDisplay.toSystemPage(printPage);
      }
      return printPage;
    },
    [pageDisplay.active, pageDisplay.toSystemPage],
  );
  const mapTocSystemPageToPrint = useCallback(
    (systemPage) => {
      if (pageDisplay.active) {
        return pageDisplay.formatPage(systemPage);
      }
      return systemPage;
    },
    [pageDisplay.active, pageDisplay.formatPage],
  );
  const betaQuota = useBetaDailyQuota(authUid, authEmail);
  const rewardNotice = useRewardNotice(authUid, rewardNoticeTick);

  const daysWithMomo = useMemo(() => {
    void profileRev;
    const profile = authUid ? getUserProfile(authUid) : null;
    const joinedMs = authSession?.createdAtMs ?? profile?.completedAt ?? null;
    return daysSinceJoin(joinedMs);
  }, [authUid, authSession?.createdAtMs, profileRev]);

  useEffect(() => {
    if (feedbackThankYouOpen) {
      void betaQuota.refresh();
    }
  }, [feedbackThankYouOpen, betaQuota.refresh]);

  useEffect(() => {
    if (!authUid || betaQuota.loading) return;
    const changed = syncProfileBadges(authUid, {
      tenureDays: daysWithMomo,
      hasBoostApprovedToday: betaQuota.hasBoostApprovedToday,
    });
    if (changed) rewardNotice.refresh();
  }, [
    authUid,
    betaQuota.loading,
    betaQuota.hasBoostApprovedToday,
    daysWithMomo,
    rewardNotice,
  ]);
  const checkAuthBlocked = isCheckAuthBlocked(authUid);
  const checkQuotaBlocked =
    betaQuota.enforced &&
    !betaQuota.loading &&
    (workTab === 'spelling'
      ? !betaQuota.canRunSpellingCheck
      : !betaQuota.canRunConsistencyCheck);
  const checkSessionBlocked = checkAuthBlocked || checkQuotaBlocked;

  const criteriaRunBlocked = useMemo(() => {
    if (pdf.pageTexts.length === 0 || checkAuthBlocked || checkQuotaBlocked) {
      return true;
    }
    if (
      pdf.isProcessing &&
      (pdf.progress?.phase === 'extract' || pdf.progress?.phase === 'restore')
    ) {
      return true;
    }
    return false;
  }, [
    pdf.pageTexts.length,
    checkAuthBlocked,
    checkQuotaBlocked,
    pdf.isProcessing,
    pdf.progress?.phase,
  ]);

  const criteriaRunChecking =
    pdf.isProcessing && pdf.progress?.phase === 'check';

  const criteriaRunDisabledReason = useMemo(() => {
    if (pdf.progress?.phase === 'restore') {
      return '이전 작업 복원 중입니다. 잠시만 기다려 주세요.';
    }
    if (pdf.progress?.phase === 'extract') {
      return 'PDF 텍스트 추출 중입니다.';
    }
    if (criteriaRunChecking) {
      return '검사가 진행 중입니다.';
    }
    if (!pdf.pdf) return 'PDF를 업로드해 주세요.';
    if (pdf.pageTexts.length === 0) {
      return '텍스트 추출이 완료되지 않았습니다. PDF를 다시 올려 주세요.';
    }
    if (checkAuthBlocked) {
      return '로그인 후 검수할 수 있습니다.';
    }
    if (checkQuotaBlocked) {
      return workTab === 'spelling'
        ? '오늘 맞춤법 검수 한도를 모두 사용했습니다.'
        : '오늘 표기 통일 검수 한도를 모두 사용했습니다.';
    }
    return '';
  }, [
    pdf.progress?.phase,
    criteriaRunChecking,
    pdf.pdf,
    pdf.pageTexts.length,
    checkAuthBlocked,
    checkQuotaBlocked,
    workTab,
  ]);

  const ruleCheck = useRuleCheck({
    builtInEnabled,
    cautionEnabled,
    customRules,
    globalExcludePhrases,
    pageTexts: pdf.pageTexts,
    currentPage: pdf.currentPage,
    setCurrentPage: pdf.setCurrentPage,
    setIsProcessing: pdf.setIsProcessing,
    setProgress: pdf.setProgress,
    afterCheckRef,
    authUid,
    authEmail,
    onBetaQuotaConsumed: () => void betaQuota.refresh(),
  });
  const tocBodyCheckEnabled = isTocBodyCheckEnabled();
  const spellingExportEnabled = isSpellingExportEnabled();
  const loanwordConverterEnabled = isLoanwordConverterEnabled();
  const tocCheck = useTocBodyCheck({
    tocBodyText,
    tocBodyStartPage,
    tocBodyExcludePages,
    mapPrintPageToSystem: mapTocPrintPageToSystem,
    mapSystemPageToPrint: mapTocSystemPageToPrint,
    printedPagesActive: pageDisplay.active,
    pageTexts: pdf.pageTexts,
    currentPage: pdf.currentPage,
    setCurrentPage: pdf.setCurrentPage,
    setIsProcessing: pdf.setIsProcessing,
    setProgress: pdf.setProgress,
    afterCheckRef,
    authUid,
    authEmail,
    onBetaQuotaConsumed: () => void betaQuota.refresh(),
  });
  const session = useWorkSession(pdf, ruleCheck, tocCheck);
  afterCheckRef.current = session.persistSession;

  const clearConsistencyTabWork = useCallback(() => {
    tocCheck.clearTocCheckState();
    ruleCheck.clearConsistencyCheckState();
    setConsistencyFocus('rules');
    setLastConsistencyPane('rules');
  }, [tocCheck, ruleCheck]);

  const clearSpellingTabWork = useCallback(() => {
    ruleCheck.clearSpellingCheckState();
  }, [ruleCheck]);

  const prevActiveSetIdRef = useRef(null);
  useEffect(() => {
    if (!activeSetId) return;
    if (prevActiveSetIdRef.current === null) {
      prevActiveSetIdRef.current = activeSetId;
      return;
    }
    if (prevActiveSetIdRef.current === activeSetId) return;
    prevActiveSetIdRef.current = activeSetId;
    clearConsistencyTabWork();
    clearSpellingTabWork();
  }, [activeSetId, clearConsistencyTabWork, clearSpellingTabWork]);

  const ruleHighlights = useHighlights({
    currentPage: pdf.currentPage,
    currentPageData: pdf.currentPageData,
    spellingResults: ruleCheck.spellingResults,
    consistencyResults: ruleCheck.consistencyResults,
    resultVisibility: ruleCheck.resultVisibility,
    highlightTab: workTab === 'spelling' ? 'spelling' : 'consistency',
    activeSource: ruleCheck.activeSource,
    selectedInstance: ruleCheck.selectedInstance,
    customRules,
    pageTexts: pdf.pageTexts,
  });

  const tocHighlights = useTocBodyHighlights({
    currentPage: pdf.currentPage,
    currentPageData: pdf.currentPageData,
    results: tocCheck.results,
    resultVisibility: tocCheck.resultVisibility,
    selectedInstance: tocCheck.selected,
  });

  const highlights =
    tocBodyCheckEnabled &&
    workTab === 'consistency' &&
    consistencyFocus === 'toc' &&
    tocCheck.checkDone
      ? tocHighlights
      : ruleHighlights;

  useEffect(() => {
    setWorkTab(initialWorkTab);
  }, [initialWorkTab]);

  const spellingTabEntries = useMemo(
    () =>
      buildTabEntries(
        'spelling',
        ruleCheck.spellingResults,
        ruleCheck.consistencyResults,
        pdf.pageTexts,
      ),
    [ruleCheck.spellingResults, ruleCheck.consistencyResults, pdf.pageTexts],
  );

  const consistencyTabEntries = useMemo(
    () =>
      buildTabEntries(
        'consistency',
        ruleCheck.spellingResults,
        ruleCheck.consistencyResults,
      ),
    [ruleCheck.spellingResults, ruleCheck.consistencyResults],
  );

  const spellingTabTotalFindings = useMemo(
    () => countTabTotalFindings(spellingTabEntries),
    [spellingTabEntries],
  );

  const spellingGroupsWithFindings = useMemo(
    () => countSpellingGroupsWithFindings(ruleCheck.spellingResults),
    [ruleCheck.spellingResults],
  );

  const spellingCriteriaSelection = useMemo(
    () => ({
      cautionSelected:
        countSpacingReviewActiveRules({ cautionEnabled }) > 0,
      builtinSelected: countBuiltInActiveRules({ builtInEnabled }) > 0,
    }),
    [cautionEnabled, builtInEnabled],
  );

  const consistencyCriteriaSelection = useMemo(() => {
    const active = countConsistencyCheckActiveRules(
      customRules,
      globalExcludePhrases,
    );
    return {
      literalSelected: active.literalActive > 0,
      unifySelected: active.unifyActive > 0,
      commonStringSelected: active.commonStringActive > 0,
      auxiliarySelected: active.auxiliaryActive > 0,
    };
  }, [customRules, globalExcludePhrases]);

  const spellingFindingsByCategory = useMemo(
    () => countSpellingFindingsByCategory(ruleCheck.spellingResults),
    [ruleCheck.spellingResults],
  );

  const consistencyFindingsByType = useMemo(
    () =>
      countConsistencyFindingsByType(
        ruleCheck.consistencyResults,
        customRules,
      ),
    [ruleCheck.consistencyResults, customRules],
  );

  const consistencyTabFindingsTotal = useMemo(
    () =>
      consistencyFindingsByType.find +
      consistencyFindingsByType.unify +
      consistencyFindingsByType.commonString,
    [consistencyFindingsByType],
  );

  const consistencyGroupsWithFindings = useMemo(
    () =>
      countConsistencyGroupsWithFindings(
        ruleCheck.consistencyResults,
        customRules,
      ),
    [ruleCheck.consistencyResults, customRules],
  );

  const consistencyTabTotalFindings = useMemo(
    () => countTabTotalFindings(consistencyTabEntries),
    [consistencyTabEntries],
  );

  const tocBodyTabEntries = useMemo(
    () => buildTocBodyTabEntries(tocCheck.results),
    [tocCheck.results],
  );

  const handleSaveCriteria = useCallback(async () => {
    if (criteriaSavePending) return;
    setCriteriaSavePending(true);
    try {
      const patch = buildProjectContextWorkPatch({
        pdfFileName: pdf.pdfFileName,
        pdfPageCount: pdf.pdf?.numPages,
        pdfSizeBytes: pdf.pdfByteLength,
        spellingCheckDone: ruleCheck.spellingCheckDone,
        consistencyCheckDone: ruleCheck.consistencyCheckDone,
        spellingFindingCount: spellingTabTotalFindings,
        editorReviewFindingCount: spellingFindingsByCategory.editorReview,
        builtinSpellingFindingCount: spellingFindingsByCategory.spelling,
        consistencyFindingCount: consistencyTabFindingsTotal,
        consistencyFindCount: consistencyFindingsByType.find,
        consistencyUnifyCount: consistencyFindingsByType.unify,
        consistencyCommonStringCount: consistencyFindingsByType.commonString,
        bonBojoFindingCount: consistencyFindingsByType.bonBojo,
      });
      const result = await onSaveCriteriaPreset(criteriaNameInput, {
        projectContextSnapshot: patch,
      });
      if (typeof result === 'string' && result) {
        setCriteriaNameInput(criteriaNameForInput(result));
        setCriteriaSaveModalName(result);
        setCriteriaSaveModalOpen(true);
        setCriteriaPickerOpen(false);
      }
    } finally {
      setCriteriaSavePending(false);
    }
  }, [
    criteriaSavePending,
    criteriaNameInput,
    onSaveCriteriaPreset,
    pdf.pdf,
    pdf.pdfFileName,
    pdf.pdfByteLength,
    ruleCheck.spellingCheckDone,
    ruleCheck.consistencyCheckDone,
    spellingTabTotalFindings,
    spellingFindingsByCategory.editorReview,
    spellingFindingsByCategory.spelling,
    consistencyTabFindingsTotal,
    consistencyFindingsByType.find,
    consistencyFindingsByType.unify,
    consistencyFindingsByType.commonString,
    consistencyFindingsByType.bonBojo,
  ]);

  const consistencyWorkDone =
    (tocBodyCheckEnabled && tocCheck.checkDone) ||
    ruleCheck.consistencyCheckDone;

  useEffect(() => {
    if (!onTouchActiveProjectContext || !activeRuleSet?.savedAt) return undefined;
    if (!ruleCheck.spellingCheckDone && !consistencyWorkDone) return undefined;

    const timer = window.setTimeout(() => {
      const patch = buildProjectContextWorkPatch({
        pdfFileName: pdf.pdfFileName,
        pdfPageCount: pdf.pdf?.numPages,
        pdfSizeBytes: pdf.pdfByteLength,
        spellingCheckDone: ruleCheck.spellingCheckDone,
        consistencyCheckDone: consistencyWorkDone,
        spellingFindingCount: spellingTabTotalFindings,
        editorReviewFindingCount: spellingFindingsByCategory.editorReview,
        builtinSpellingFindingCount: spellingFindingsByCategory.spelling,
        consistencyFindingCount: consistencyTabFindingsTotal,
        consistencyFindCount: consistencyFindingsByType.find,
        consistencyUnifyCount: consistencyFindingsByType.unify,
        consistencyCommonStringCount: consistencyFindingsByType.commonString,
        bonBojoFindingCount: consistencyFindingsByType.bonBojo,
      });
      if (patch) onTouchActiveProjectContext(patch);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeRuleSet?.savedAt,
    consistencyWorkDone,
    onTouchActiveProjectContext,
    pdf.pdf,
    pdf.pdfFileName,
    pdf.pdfByteLength,
    ruleCheck.consistencyCheckDone,
    ruleCheck.spellingCheckDone,
    spellingTabTotalFindings,
    spellingFindingsByCategory.editorReview,
    spellingFindingsByCategory.spelling,
    consistencyTabFindingsTotal,
    consistencyFindingsByType.find,
    consistencyFindingsByType.unify,
    consistencyFindingsByType.commonString,
    consistencyFindingsByType.bonBojo,
  ]);

  const showTocResultsPanel =
    tocBodyCheckEnabled &&
    tocCheck.checkDone &&
    (!ruleCheck.consistencyCheckDone || consistencyFocus === 'toc');

  const showConsistencyResultsPanel =
    ruleCheck.consistencyCheckDone &&
    (!tocCheck.checkDone ||
      (tocCheck.checkDone && consistencyFocus === 'rules'));

  const visibleOnCurrentPage =
    tocBodyCheckEnabled &&
    workTab === 'consistency' &&
    consistencyFocus === 'toc' &&
    tocCheck.checkDone
      ? tocCheck.countVisibleOnPage(pdf.currentPage)
      : ruleCheck.countVisibleOnPage(pdf.currentPage, workTab);

  const tabCheckDone = useMemo(
    () =>
      isTabCheckDone(
        workTab,
        ruleCheck.spellingCheckDone,
        consistencyWorkDone,
      ),
    [workTab, ruleCheck.spellingCheckDone, consistencyWorkDone],
  );

  const pdfPageStatus = useMemo(() => {
    if (!pdf.pdf || !tabCheckDone) return null;
    const isToc =
      tocBodyCheckEnabled &&
      workTab === 'consistency' &&
      consistencyFocus === 'toc' &&
      tocCheck.checkDone;
    const tone =
      workTab === 'consistency'
        ? isToc
          ? 'consistency'
          : ruleCheck.activeGroup?.category === 'caution'
            ? 'caution'
            : 'builtin'
        : ruleCheck.activeGroup?.category === 'caution'
          ? 'caution'
          : 'builtin';
    return {
      currentPage: pdf.currentPage,
      visibleOnCurrentPage,
      formatPageLabel: pageDisplay.formatLabel,
      tone,
      mode: isToc ? 'toc' : 'criteria',
      printedPagesActive: pageDisplay.active,
    };
  }, [
    pdf.pdf,
    pdf.currentPage,
    tabCheckDone,
    visibleOnCurrentPage,
    pageDisplay.formatLabel,
    pageDisplay.active,
    tocBodyCheckEnabled,
    workTab,
    consistencyFocus,
    tocCheck.checkDone,
    ruleCheck.activeGroup?.category,
  ]);

  /** 둘러보기 1번 — 말풍선 읽은 뒤 손 표시 */
  const [guestGuideHandActive, setGuestGuideHandActive] = useState(false);
  const [guestNextGuideReady, setGuestNextGuideReady] = useState(() =>
    isGuestBrowseNextGuideReady(),
  );
  const [guestExportGuideReady, setGuestExportGuideReady] = useState(() =>
    isGuestBrowseExportGuideReady(),
  );
  const [guestPdfTipOpened, setGuestPdfTipOpened] = useState(false);
  const [consistencyGuideLiteralAddClicked, setConsistencyGuideLiteralAddClicked] =
    useState(false);
  const [consistencyGuideUnifyAddClicked, setConsistencyGuideUnifyAddClicked] =
    useState(false);
  const guestConsistencyPreparedRef = useRef(false);

  const workGuide = useWorkGuideChain(authUid, {
    hasPdf: Boolean(pdf.pdf),
    pageTextsReady: pdf.pageTexts.length > 0,
    workTab,
    spellingCheckDone: ruleCheck.spellingCheckDone,
    consistencyCheckDone: ruleCheck.consistencyCheckDone,
    consistencyExportGuideReady: guestExportGuideReady,
  });

  useEffect(() => {
    setGuestNextGuideReady(isGuestBrowseNextGuideReady());
    return subscribeGuestBrowseNextGuide(() => {
      setGuestNextGuideReady(isGuestBrowseNextGuideReady());
    });
  }, []);

  useEffect(() => {
    setGuestExportGuideReady(isGuestBrowseExportGuideReady());
    return subscribeGuestBrowseExportGuide(() => {
      setGuestExportGuideReady(isGuestBrowseExportGuideReady());
    });
  }, []);

  useEffect(() => {
    if (!guestNextGuideReady) return;
    setGuestPdfTipOpened(false);
  }, [guestNextGuideReady]);

  const guestResultGuideActive =
    guestBrowseAutoRunsCriteriaCheck() &&
    workGuide.showFirstResultGuide &&
    guestNextGuideReady &&
    !guestPdfTipOpened;

  useEffect(() => {
    if (!guestResultGuideActive) return;
    const group = findGuestBrowseDemoSpellingGroup(ruleCheck.spellingResults);
    if (!group) return;
    if (ruleCheck.isSameGroupAsSelected(group, 'spelling')) return;
    ruleCheck.selectGroup(group, 'spelling');
  }, [
    guestResultGuideActive,
    ruleCheck.spellingResults,
    ruleCheck.isSameGroupAsSelected,
    ruleCheck.selectGroup,
  ]);

  const handleGuestHighlightTipOpen = useCallback(() => {
    if (!guestBrowseAutoRunsCriteriaCheck()) return;
    setGuestPdfTipOpened(true);
  }, []);

  const handleGuestHighlightTipConfirm = useCallback(() => {
    if (!guestBrowseAutoRunsCriteriaCheck()) return;
    if (!workGuide.showFirstResultGuide) return;
    workGuide.dismiss(WORK_GUIDE_KEYS.FIRST_RESULT);
  }, [workGuide.showFirstResultGuide, workGuide.dismiss]);

  const handleGuestHighlightTipDismiss = useCallback(() => {
    if (!guestBrowseAutoRunsCriteriaCheck()) return;
    setGuestPdfTipOpened(false);
  }, []);

  const dismissPreUploadGuide = useCallback(() => {
    workGuide.dismiss(WORK_GUIDE_KEYS.PRE_UPLOAD);
  }, [workGuide.dismiss]);

  const openThumbStripAfterDemo = useCallback(() => {
    if (guestBrowseHidesThumbStrip()) return;
    setThumbStripOpen(true);
  }, []);

  useGuestBrowseDemoPdf({
    isRestoring: session.isRestoring,
    hasPdf: Boolean(pdf.pdf),
    loadPdfFile: session.loadPdfFile,
    dismissPreUpload: dismissPreUploadGuide,
    onLoaded: openThumbStripAfterDemo,
  });

  const showSpellingRunRow = Boolean(pdf.pdf);
  const showConsistencyRunRow = Boolean(pdf.pdf);
  const showSpellingResultsSlot = tabCheckDone;

  const handleCriteriaSpellingCheck = useCallback(() => {
    if (guestBrowseAutoRunsCriteriaCheck()) {
      markGuestBrowseCriteriaClick();
    }
    if (workGuide.showLeftCriteriaGuide) {
      workGuide.dismiss(WORK_GUIDE_KEYS.LEFT_CRITERIA);
    }
    void ruleCheck.runSpellingCheck();
  }, [
    workGuide.dismiss,
    workGuide.showLeftCriteriaGuide,
    ruleCheck.runSpellingCheck,
  ]);

  /** 둘러보기 — 말풍선 후 손 표시, 사용자가 직접 기준 검수 클릭 */
  useEffect(() => {
    if (!workGuide.showLeftCriteriaGuide) {
      setGuestGuideHandActive(false);
      return undefined;
    }
    if (!guestBrowseAutoRunsCriteriaCheck()) return undefined;
    if (criteriaRunBlocked) return undefined;

    const handTimer = window.setTimeout(() => {
      setGuestGuideHandActive(true);
    }, 1400);

    return () => {
      window.clearTimeout(handTimer);
      setGuestGuideHandActive(false);
    };
  }, [workGuide.showLeftCriteriaGuide, criteriaRunBlocked]);

  /** 다시 검수 — 결과 비우고 맞춤법 탭 검수 항목·기준 설정으로 복귀 */
  const handleSpellingRecheckFromScratch = useCallback(() => {
    clearSpellingTabWork();
  }, [clearSpellingTabWork]);

  /** 다시 검수 — 일관성·목차 결과 비우고 기준 설정으로 복귀 */
  const handleConsistencyRecheckFromScratch = useCallback(() => {
    clearConsistencyTabWork();
  }, [clearConsistencyTabWork]);

  const handleRunConsistencyRulesCheck = useCallback(async () => {
    if (workGuide.showAuxiliaryVerbGuide) {
      workGuide.dismiss(WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO);
    }
    setConsistencyFocus('rules');
    setLastConsistencyPane('rules');
    await ruleCheck.runConsistencyCheck();
  }, [
    workGuide.showAuxiliaryVerbGuide,
    workGuide.dismiss,
    ruleCheck.runConsistencyCheck,
  ]);

  function switchTab(tab) {
    setWorkTab(tab);
    ruleCheck.syncSelectionForTab(tab);
  }

  /** 4번 말풍선 전에 표기 통일 탭으로 전환 (+둘러보기면 칩 초기화·본·보 전체 선택) */
  useEffect(() => {
    if (!workGuide.requestConsistencyTab) return;
    if (guestBrowseAutoRunsCriteriaCheck() && !guestConsistencyPreparedRef.current) {
      guestConsistencyPreparedRef.current = true;
      onCustomRulesChange(prepareGuestBrowseConsistencyRules(customRules));
      onGlobalExcludePhrasesChange([]);
    }
    if (workTab === 'consistency') return;
    setWorkTab('consistency');
    ruleCheck.syncSelectionForTab('consistency');
  }, [
    workGuide.requestConsistencyTab,
    workTab,
    ruleCheck.syncSelectionForTab,
    customRules,
    onCustomRulesChange,
    onGlobalExcludePhrasesChange,
  ]);

  useEffect(() => {
    if (!workGuide.showConsistencyGuide) {
      setConsistencyGuideLiteralAddClicked(false);
      setConsistencyGuideUnifyAddClicked(false);
    }
  }, [workGuide.showConsistencyGuide]);

  const handleConsistencyLiteralAddGuideClick = useCallback(() => {
    if (!workGuide.showConsistencyGuide) return;
    setConsistencyGuideLiteralAddClicked(true);
  }, [workGuide.showConsistencyGuide]);

  const handleConsistencyUnifyAddGuideClick = useCallback(() => {
    if (!workGuide.showConsistencyGuide) return;
    if (!consistencyGuideLiteralAddClicked) return;
    setConsistencyGuideUnifyAddClicked(true);
  }, [
    workGuide.showConsistencyGuide,
    consistencyGuideLiteralAddClicked,
  ]);

  useEffect(() => {
    if (!workGuide.showConsistencyGuide) return;
    if (!consistencyGuideLiteralAddClicked || !consistencyGuideUnifyAddClicked) {
      return;
    }
    workGuide.dismiss(WORK_GUIDE_KEYS.CONSISTENCY_INTRO);
  }, [
    workGuide.showConsistencyGuide,
    consistencyGuideLiteralAddClicked,
    consistencyGuideUnifyAddClicked,
    workGuide.dismiss,
  ]);

  const handleConsistencyUnifyPinGuideClick = useCallback(
    (tailWord) => {
      if (!workGuide.showConsistencyUnifyPinGuide) return;
      if (tailWord !== GUEST_BROWSE_UNIFY_PIN_TAIL) return;
      workGuide.dismiss(WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN);
    },
    [workGuide.showConsistencyUnifyPinGuide, workGuide.dismiss],
  );

  const goToPdfPage = (pageNum) => {
    if (!pdf.pdf) return;
    const page = clampPageNumber(pageNum, pdf.pdf.numPages);
    if (
      tocBodyCheckEnabled &&
      workTab === 'consistency' &&
      consistencyFocus === 'toc' &&
      tocCheck.checkDone
    ) {
      tocCheck.goToPage(page);
    } else {
      ruleCheck.goToPage(page);
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV || pdf.pdf) return undefined;
    const params = new URLSearchParams(window.location.search);
    const devPdf = params.get('devPdf');
    if (!devPdf) return undefined;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/${devPdf}`);
        if (!res.ok || cancelled) return;
        const buf = await res.arrayBuffer();
        const file = new File(
          [buf],
          devPdf.split('/').pop() ?? 'sample.pdf',
          { type: 'application/pdf' },
        );
        const doc = await pdf.loadPdfFromFile(file);
        if (cancelled) return;
        setThumbStripOpen(true);
        const devPage = Number.parseInt(params.get('devPage') ?? '', 10);
        if (Number.isFinite(devPage) && devPage > 0) {
          ruleCheck.goToPage(
            Math.min(doc.numPages, Math.max(1, devPage)),
          );
        }
      } catch {
        /* ignore dev sample load */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf.pdf, pdf.loadPdfFromFile, ruleCheck]);

  const toggleThumbStrip = () => {
    setThumbStripOpen((open) => {
      const next = !open;
      persistThumbStripOpenPreference(next);
      return next;
    });
  };

  const ruleCheckInstanceVisibilityProps = useMemo(
    () => ({
      groupVisibilityMode: ruleCheck.groupVisibilityMode,
      visibleInstanceCount: ruleCheck.visibleInstanceCount,
      isInstanceVisible: ruleCheck.isInstanceVisible,
      onToggleInstanceVisibility: ruleCheck.toggleInstanceVisibility,
      onSelectInstance: ruleCheck.selectInstance,
    }),
    [
      ruleCheck.groupVisibilityMode,
      ruleCheck.visibleInstanceCount,
      ruleCheck.isInstanceVisible,
      ruleCheck.toggleInstanceVisibility,
      ruleCheck.selectInstance,
    ],
  );

  const tocInstanceVisibilityProps = useMemo(
    () => ({
      groupVisibilityMode: tocCheck.groupVisibilityMode,
      visibleInstanceCount: tocCheck.visibleInstanceCount,
      isInstanceVisible: tocCheck.isInstanceVisible,
      onToggleInstanceVisibility: tocCheck.toggleInstanceVisibility,
      onSelectInstance: tocCheck.selectInstance,
    }),
    [
      tocCheck.groupVisibilityMode,
      tocCheck.visibleInstanceCount,
      tocCheck.isInstanceVisible,
      tocCheck.toggleInstanceVisibility,
      tocCheck.selectInstance,
    ],
  );

  const handleSpellingExport = useCallback(() => {
    if (!spellingExportEnabled) return;
    const filename = buildProofreadExportFilename(
      pdf.pdfFileName,
      '맞춤법_검수',
    );

    assertBetaDailyExportOrAlert(authUid, {
      authEmail,
      exportTab: 'spelling',
    })
      .then((allowed) => {
        if (!allowed) return;
        return exportSpellingResults({
          entries: spellingTabEntries,
          formatPageLabel: pageDisplay.formatLabel,
          isInstanceVisible: ruleCheck.isInstanceVisible,
          groupVisibilityMode: ruleCheck.groupVisibilityMode,
          visibleInstanceCount: ruleCheck.visibleInstanceCount,
          cautionCount: spellingGroupsWithFindings.cautionWithFindings,
          builtinCount: spellingGroupsWithFindings.builtinWithFindings,
          totalFindings: spellingTabTotalFindings,
          filename,
        });
      })
      .catch((err) => console.error('엑셀보내기 오류:', err));
  }, [
    spellingExportEnabled,
    authUid,
    authEmail,
    pdf.pdfFileName,
    spellingTabEntries,
    pageDisplay.formatLabel,
    ruleCheck.isInstanceVisible,
    ruleCheck.groupVisibilityMode,
    ruleCheck.visibleInstanceCount,
    spellingGroupsWithFindings,
    spellingTabTotalFindings,
  ]);

  const handleConsistencyExport = useCallback(() => {
    if (workGuide.showRuleSetSaveGuide) {
      workGuide.dismiss(WORK_GUIDE_KEYS.RULE_SET_SAVE);
    }
    if (guestBrowseBlocksResultExport()) return;
    if (!spellingExportEnabled) return;
    const filename = buildProofreadExportFilename(
      pdf.pdfFileName,
      '표기통일_검수',
    );

    assertBetaDailyExportOrAlert(authUid, {
      authEmail,
      exportTab: 'consistency',
    })
      .then((allowed) => {
        if (!allowed) return;
        return exportConsistencyResults({
          entries: consistencyTabEntries,
          formatPageLabel: pageDisplay.formatLabel,
          isInstanceVisible: ruleCheck.isInstanceVisible,
          groupVisibilityMode: ruleCheck.groupVisibilityMode,
          visibleInstanceCount: ruleCheck.visibleInstanceCount,
          literalCount: consistencyGroupsWithFindings.literalWithFindings,
          auxiliaryCount: consistencyGroupsWithFindings.auxiliaryWithFindings,
          totalFindings: consistencyTabTotalFindings,
          filename,
        });
      })
      .catch((err) => console.error('일관성 엑셀보내기 오류:', err));
  }, [
    workGuide.showRuleSetSaveGuide,
    workGuide.dismiss,
    spellingExportEnabled,
    authUid,
    authEmail,
    pdf.pdfFileName,
    consistencyTabEntries,
    pageDisplay.formatLabel,
    ruleCheck.isInstanceVisible,
    ruleCheck.groupVisibilityMode,
    ruleCheck.visibleInstanceCount,
    consistencyGroupsWithFindings,
    consistencyTabTotalFindings,
  ]);

  const spellingResultsPanel =
    workTab === 'spelling' && ruleCheck.spellingCheckDone ? (
      <CheckResultsPanel
        entries={spellingTabEntries}
        viewSource="spelling"
        currentPage={pdf.currentPage}
        activeGroup={ruleCheck.activeGroup}
        totalFindings={spellingTabTotalFindings}
        ruleCount={spellingTabEntries.length}
        cautionWithFindingsCount={spellingGroupsWithFindings.cautionWithFindings}
        builtinWithFindingsCount={spellingGroupsWithFindings.builtinWithFindings}
        cautionCriteriaSelected={spellingCriteriaSelection.cautionSelected}
        builtinCriteriaSelected={spellingCriteriaSelection.builtinSelected}
        spellingCheckDone={ruleCheck.spellingCheckDone}
        isGroupVisible={ruleCheck.isGroupVisible}
        onToggleVisibility={ruleCheck.toggleResultVisibility}
        {...ruleCheckInstanceVisibilityProps}
        isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
        selectedInstance={ruleCheck.spellingSelected}
        onSelectGroup={ruleCheck.selectGroup}
        onSelectPageInGroup={ruleCheck.selectPageInGroup}
        formatPageLabel={pageDisplay.formatLabel}
      />
    ) : null;

  const showPdfViewer = useMemo(
    () => shouldShowPdfViewer(Boolean(pdf.pdf)),
    [pdf.pdf],
  );

  const guestBrowsePreparingDemo =
    guestBrowseAllowsDemoPdfAutoLoad() && !showPdfViewer && !pdf.loadError;

  const centerRunLabel = useMemo(
    () => getCenterRunLabel(pdf.isProcessing, pdf.progress),
    [pdf.isProcessing, pdf.progress],
  );

  const spellingTabLayoutClassName = useMemo(
    () => getSpellingTabLayoutClassName(tabCheckDone),
    [tabCheckDone],
  );

  const spellingCalibrationEl =
    pdf.pdf || loanwordConverterEnabled ? (
      <div
        className="spelling-tab-layout__calibration"
        data-work-guide-step="3"
      >
        {pdf.pdf ? (
          <PrintedPageSetup
            currentSystemPage={pdf.currentPage}
            active={pageDisplay.active}
            currentPrintedLabel={pageDisplay.formatLabel(pdf.currentPage)}
            previewPrintedLabel={
              pageDisplay.active
                ? pageDisplay.formatPageText(pdf.currentPage)
                : pageDisplay.formatNaturalPreview(pdf.currentPage)
            }
            spreadInput={pageDisplay.spreadInput}
            onSpreadInputChange={pageDisplay.setSpreadInput}
            firstPageSingle={pageDisplay.firstPageSingle}
            onFirstPageSingleChange={pageDisplay.setFirstPageSingle}
            onCalibrateFromInput={pageDisplay.calibrateFromInput}
          />
        ) : null}
        {loanwordConverterEnabled ? <LoanwordConverter /> : null}
      </div>
    ) : null;

  const spellingRunRowEl = showSpellingRunRow ? (
    <div
      className="spelling-tab-layout__run-row"
      data-work-guide-step="2"
    >
      <div className="spelling-tab-layout__run-row-actions">
        <PanelSectionRunButton
          label="다시 검수"
          onClick={handleSpellingRecheckFromScratch}
          disabled={
            pdf.pageTexts.length === 0 ||
            !ruleCheck.spellingCheckDone ||
            pdf.isProcessing ||
            checkSessionBlocked
          }
          isProcessing={pdf.isProcessing}
        />
      </div>
      {spellingExportEnabled ? (
        <div className="spelling-tab-layout__run-row-actions--export">
          <button
            type="button"
            className="btn-add panel-section-run-btn btn-export-results"
            onClick={handleSpellingExport}
            disabled={!ruleCheck.spellingCheckDone}
          >
            검수 결과 다운로드
          </button>
        </div>
      ) : null}
      <div className="spelling-tab-layout__run-row-actions spelling-tab-layout__run-row-actions--end">
        <span
          className="spelling-tab-layout__criteria-run-wrap"
          data-work-guide-criteria-run
          title={criteriaRunDisabledReason || undefined}
        >
          {workGuide.showLeftCriteriaGuide ? (
            <TooltipGuide
              storageKey={workGuide.storageKey(WORK_GUIDE_KEYS.LEFT_CRITERIA)}
              placement="bottom"
              bubbleType="left"
              useFixedLayer
              offsetX={0}
              offsetY={0}
              alignToBubble={WORK_GUIDE_1_ALIGN}
              bubbleGuideStep="1"
              pinned={workGuide.pinAll}
              showConfirm={false}
              message={
                <>
                  교정냥 &apos;모모&apos;다냥, 반갑다냥!
                  <br />
                  먼저{' '}
                  <span className="tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--spelling">
                    맞춤법
                  </span>{' '}
                  기능부터 알려주겠다냥
                  <br />
                  <span className="tooltip-guide__gothic-label">편집자 검토 필요</span>와{' '}
                  <span className="tooltip-guide__gothic-label">맞춤법 규칙</span>이 있다냥
                  <br />
                  일단 검수를 시작해 보자냥
                </>
              }
              onDismiss={() =>
                workGuide.dismiss(WORK_GUIDE_KEYS.LEFT_CRITERIA)
              }
            >
              <span className="guide-auto-click-wrap">
                <GuideClickHand active={guestGuideHandActive} align="label-gap" />
                <PanelSectionRunButton
                  label="기준 검수"
                  className="panel-section-run-btn--primary"
                  onClick={handleCriteriaSpellingCheck}
                  disabled={criteriaRunBlocked}
                  isProcessing={criteriaRunChecking}
                />
              </span>
            </TooltipGuide>
          ) : (
            <PanelSectionRunButton
              label="기준 검수"
              className="panel-section-run-btn--primary"
              onClick={handleCriteriaSpellingCheck}
              disabled={criteriaRunBlocked}
              isProcessing={criteriaRunChecking}
            />
          )}
        </span>
        {workGuide.showFirstResultGuide &&
        (!guestBrowseAutoRunsCriteriaCheck() ||
          (guestNextGuideReady && !guestPdfTipOpened)) ? (
          <div className="work-guide-step-2">
            <TooltipGuide
              storageKey={workGuide.storageKey(WORK_GUIDE_KEYS.FIRST_RESULT)}
              placement="left"
              bubbleType="left"
              useFixedLayer
              alignToBubbleChain={WORK_GUIDE_2_ALIGN_CHAIN}
              bubbleGuideStep="2"
              offsetX={0}
              offsetY={0}
              pinned={workGuide.pinAll}
              showConfirm={false}
              message={
                <>
                  맞춤법 검수가 완료되었다냥
                  <br />
                  왼쪽에는{' '}
                  <span className="results-header-badge result-pillar--spelling-caution">
                    편집자 검토
                  </span>{' '}
                  <span className="results-header-badge result-pillar--spelling">
                    맞춤법
                  </span>
                  <br />
                  검사 결과가 나온다냥
                  <br />
                  오른쪽 원고에서 하이라이트를 클릭하면
                  <br />
                  해당하는 설명이 나온다냥
                </>
              }
              onDismiss={() =>
                workGuide.dismiss(WORK_GUIDE_KEYS.FIRST_RESULT)
              }
            >
              <span
                className="work-guide-anchor work-guide-anchor--guide-result"
                aria-hidden
              />
            </TooltipGuide>
            <GuideClickHand
              active={guestResultGuideActive}
              anchorSelector="[data-work-guide-pdf-highlight]"
              align="center"
            />
          </div>
        ) : null}
        <GuideClickHand
          active={
            guestBrowseAutoRunsCriteriaCheck() &&
            workGuide.showFirstResultGuide &&
            guestPdfTipOpened
          }
          anchorSelector='[data-work-guide="pdf-tip-confirm"]'
        />
      </div>
    </div>
  ) : null;

  const greetingInner = guestBrowseHidesGreetingText() ? null : (
    <>
      {greetingName && activeSavedRuleSetNameDisplay ? (
        <>
          <span className="pdf-work-pane__greeting-name">{greetingName}</span>
          님{' '}
          <span className="pdf-work-pane__greeting-criteria">
            {formatProjectDialogLabel(activeSavedRuleSetNameDisplay)}
          </span>{' '}
          프로젝트를 진행중입니다
        </>
      ) : greetingName ? (
        <>
          <span className="pdf-work-pane__greeting-name">{greetingName}</span>
          님 안녕하세요
        </>
      ) : (
        '안녕하세요'
      )}
    </>
  );

  const greetingClassName = `pdf-work-pane__greeting${
    greetingName && activeSavedRuleSetNameDisplay
      ? ' pdf-work-pane__greeting--active-project'
      : ''
  }`;

  const greetingAnchor = (
    <span className="work-guide-anchor work-guide-anchor--greeting">
      <p className={greetingClassName}>{greetingInner}</p>
    </span>
  );

  const greetingParagraph = workGuide.showRuleSetSaveGuide ? (
    <TooltipGuide
      storageKey={workGuide.storageKey(WORK_GUIDE_KEYS.RULE_SET_SAVE)}
      placement="bottom"
      bubbleType="left"
      useFixedLayer
      alignToBubble={WORK_GUIDE_EXPORT_ALIGN}
      bubbleGuideStep="6"
      offsetX={0}
      offsetY={0}
      pinned={workGuide.pinAll}
      showConfirm={false}
      message={
        <>
          회원은 검수 결과를 다운받을 수 있고
          <br />
          검수 항목을 프로젝트로 저장할 수 있다냥
        </>
      }
      onDismiss={() => workGuide.dismiss(WORK_GUIDE_KEYS.RULE_SET_SAVE)}
    >
      {greetingAnchor}
    </TooltipGuide>
  ) : workGuide.showConsistencyGuide ? (
    <TooltipGuide
      storageKey={workGuide.storageKey(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)}
      placement="bottom"
      bubbleType="left"
      useFixedLayer
      alignToBubble={WORK_GUIDE_GREETING_ALIGN}
      bubbleGuideStep="4"
      offsetX={0}
      offsetY={8}
      pinned={workGuide.pinAll}
      message={
        consistencyGuideLiteralAddClicked ? (
          <>
            <span className="tooltip-guide__gothic-label">통일형 만들기</span>
            에서는
            <br />
            여러 항목을 통일할 수 있다냥
            <br />
            +를 눌러 예시 항목을 추가해 보자냥!
          </>
        ) : (
          <>
            <span className="tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--consistency">
              표기 통일
            </span>{' '}
            기능이다냥
            <br />
            <span className="tooltip-guide__gothic-label">
              {LITERAL_FIND_FEATURE_LABEL}
            </span>
            에서는 최대 5개를
            <br />
            한 번에 검색할 수 있어 편리하다냥
            <br />
            +를 눌러 예시 항목을 추가해 보자냥!
          </>
        )
      }
      onDismiss={() =>
        workGuide.dismiss(WORK_GUIDE_KEYS.CONSISTENCY_INTRO)
      }
    >
      {greetingAnchor}
    </TooltipGuide>
  ) : (
    <p className={greetingClassName}>{greetingInner}</p>
  );

  return (
    <div className="layout-main">
      <div className="layout-main__workspace">
      <aside
        className={[
          'panel-left',
          `panel-left--${workTab}`,
          workGuide.workGuideOpen ? 'panel-left--work-guide' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={panelStyle}
      >
        <header className="panel-header panel-header--tabs">
          <div className="panel-header-toolbar">
            <button
              type="button"
              className="btn-ghost btn-ghost--compact panel-header-home"
              onClick={onOpenWelcome}
              title="대문화면"
              aria-label="대문화면"
            >
              <House size={18} />
            </button>
            {guestBrowseHidesProjectSaveUi() ? null : (
            <div className="panel-left__criteria-save">
              <div
                className="panel-left__criteria-picker"
                ref={criteriaPickerRef}
              >
                <label className="sr-only" htmlFor="panel-left-criteria-name">
                  프로젝트 이름
                </label>
                <div className="panel-left__criteria-picker-field">
                  <input
                    id="panel-left-criteria-name"
                    type="text"
                    className="panel-left__criteria-name"
                    value={criteriaNameInput}
                    onChange={(event) =>
                      setCriteriaNameInput(event.target.value)
                    }
                    onFocus={() => {
                      if (projectPickerRuleSets.length > 0) {
                        setCriteriaPickerOpen(true);
                      }
                    }}
                    placeholder="프로젝트 이름"
                    maxLength={60}
                    autoComplete="off"
                    disabled={criteriaSavePending}
                    role="combobox"
                    aria-expanded={criteriaPickerOpen}
                    aria-controls="panel-left-criteria-picker-list"
                    aria-autocomplete="list"
                  />
                  <button
                    type="button"
                    className="panel-left__criteria-picker-toggle"
                    aria-label="저장한 기준 목록 열기"
                    aria-expanded={criteriaPickerOpen}
                    aria-controls="panel-left-criteria-picker-list"
                    disabled={projectPickerRuleSets.length === 0}
                    onClick={() => setCriteriaPickerOpen((open) => !open)}
                  >
                    <ChevronDown size={16} aria-hidden />
                  </button>
                </div>
                {criteriaPickerOpen && projectPickerRuleSets.length > 0 ? (
                  <ul
                    id="panel-left-criteria-picker-list"
                    className="panel-left__criteria-picker-menu custom-scrollbar"
                    role="listbox"
                    aria-label="저장한 기준"
                  >
                    {projectPickerRuleSets.map((set) => {
                      const isActive = set.id === activeSetId;
                      const label = (set.name || '이름 없는 기준').trim();
                      const savedLabel = formatRuleSetSavedDate(set.savedAt);
                      return (
                        <li
                          key={set.id}
                          role="presentation"
                          className="panel-left__criteria-picker-item"
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            className={`panel-left__criteria-picker-option${isActive ? ' panel-left__criteria-picker-option--active' : ''}`}
                            onClick={() => selectSavedCriteria(set)}
                          >
                            <span className="panel-left__criteria-picker-option-name">
                              {label}
                            </span>
                            {savedLabel ? (
                              <span className="panel-left__criteria-picker-option-date">
                                {savedLabel}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            className="panel-left__criteria-picker-delete"
                            aria-label={`${label} 삭제`}
                            title="기준 삭제"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteCriteria(set.id);
                            }}
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              <div className="panel-left__criteria-actions">
                <button
                  type="button"
                  className="panel-left__save-rules"
                  onClick={() => void handleSaveCriteria()}
                  disabled={criteriaSavePending}
                  aria-busy={criteriaSavePending}
                  aria-label={criteriaSavePending ? '프로젝트 저장 중' : '기준 저장'}
                  title={criteriaSavePending ? '저장 중…' : '기준 저장'}
                >
                  {criteriaSavePending ? (
                    <Loader2
                      size={16}
                      aria-hidden
                      className="panel-left__save-rules-spinner"
                    />
                  ) : (
                    <Save size={16} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  className="panel-left__delete-rules"
                  onClick={() => handleDeleteCriteria(activeSetId)}
                  aria-label="기준 삭제"
                  title="기준 삭제"
                  disabled={!activeRuleSet?.savedAt}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </div>
            )}
          </div>
          <nav className="work-tabs" aria-label="검수 종류">
            <button
              type="button"
              className={`work-tab work-tab--spelling ${workTab === 'spelling' ? 'active' : ''}`}
              onClick={() => switchTab('spelling')}
            >
              맞춤법
            </button>
            <button
              type="button"
              className={`work-tab work-tab--consistency ${workTab === 'consistency' ? 'active' : ''}`}
              onClick={() => switchTab('consistency')}
            >
              표기 통일
            </button>
          </nav>
        </header>

        {workTab === 'spelling' && (
          <div
            className={spellingTabLayoutClassName}
          >
            {showSpellingResultsSlot ? (
              <div className="panel-left-work-scroll spelling-tab-scroll custom-scrollbar">
                {spellingRunRowEl}
                {spellingCalibrationEl}
                <div className="spelling-tab-scroll__results">
                  {spellingResultsPanel}
                </div>
              </div>
            ) : (
              <>
                {spellingRunRowEl}
                {spellingCalibrationEl}
                {!tabCheckDone ? (
                  <ResizableBuiltinSpelling
                    builtInEnabled={builtInEnabled}
                    onBuiltInToggle={onBuiltInToggle}
                    onBuiltInSetAll={onBuiltInSetAll}
                    cautionEnabled={cautionEnabled}
                    onCautionToggle={onCautionToggle}
                    onCautionSetAll={onCautionSetAll}
                    fillPanel
                  />
                ) : null}
              </>
            )}
          </div>
        )}

        {workTab === 'consistency' && (
          <div className="panel-left-work-scroll custom-scrollbar">
            {showConsistencyRunRow ? (
              <div
                className="consistency-tab-layout__run-row spelling-tab-layout__run-row"
                data-work-guide-step="2"
              >
                <div className="spelling-tab-layout__run-row-actions">
                  <PanelSectionRunButton
                    label="다시 검수"
                    onClick={handleConsistencyRecheckFromScratch}
                    disabled={
                      pdf.pageTexts.length === 0 ||
                      !consistencyWorkDone ||
                      pdf.isProcessing ||
                      checkSessionBlocked
                    }
                    isProcessing={pdf.isProcessing}
                  />
                </div>
                {spellingExportEnabled ? (
                <div className="spelling-tab-layout__run-row-actions--export">
                  <button
                    type="button"
                    className="btn-add panel-section-run-btn panel-section-run-btn--primary btn-export-results"
                    data-work-guide="consistency-export"
                    onClick={handleConsistencyExport}
                    disabled={!ruleCheck.consistencyCheckDone}
                  >
                    검수 결과 다운로드
                  </button>
                </div>
                ) : null}
                <div className="spelling-tab-layout__run-row-actions spelling-tab-layout__run-row-actions--end">
                  <span
                    className="spelling-tab-layout__criteria-run-wrap"
                    data-work-guide="consistency-criteria-run"
                  >
                    <PanelSectionRunButton
                      label="기준 검수"
                      className="panel-section-run-btn--primary"
                      onClick={handleRunConsistencyRulesCheck}
                      disabled={
                        pdf.pageTexts.length === 0 ||
                        pdf.isProcessing ||
                        checkSessionBlocked
                      }
                      isProcessing={pdf.isProcessing}
                    />
                  </span>
                </div>
              </div>
            ) : null}
            {pdf.pdf && consistencyWorkDone ? (
              <div className="spelling-tab-layout__calibration">
                <PrintedPageSetup
                  currentSystemPage={pdf.currentPage}
                  active={pageDisplay.active}
                  currentPrintedLabel={pageDisplay.formatLabel(pdf.currentPage)}
                  previewPrintedLabel={
                    pageDisplay.active
                      ? pageDisplay.formatPageText(pdf.currentPage)
                      : pageDisplay.formatNaturalPreview(pdf.currentPage)
                  }
                  spreadInput={pageDisplay.spreadInput}
                  onSpreadInputChange={pageDisplay.setSpreadInput}
                  firstPageSingle={pageDisplay.firstPageSingle}
                  onFirstPageSingleChange={pageDisplay.setFirstPageSingle}
                  onCalibrateFromInput={pageDisplay.calibrateFromInput}
                />
              </div>
            ) : null}
            {tocBodyCheckEnabled &&
            tocCheck.checkDone &&
            ruleCheck.consistencyCheckDone ? (
              <nav
                className="consistency-results-switch"
                aria-label="검사 결과 종류"
              >
                <button
                  type="button"
                  className={`consistency-results-switch__btn ${consistencyFocus === 'toc' ? 'active' : ''}`}
                  onClick={() => {
                    setConsistencyFocus('toc');
                    setLastConsistencyPane('toc');
                    tocCheck.syncSelection();
                  }}
                >
                  목차 · 본문 결과
                </button>
                <button
                  type="button"
                  className={`consistency-results-switch__btn ${consistencyFocus === 'rules' ? 'active' : ''}`}
                  onClick={() => {
                    setConsistencyFocus('rules');
                    setLastConsistencyPane('rules');
                    ruleCheck.syncSelectionForTab('consistency');
                  }}
                >
                  표기 통일 결과
                </button>
              </nav>
            ) : null}
            {showTocResultsPanel ? (
              <TocBodyResultsPanel
                entries={tocBodyTabEntries}
                currentPage={pdf.currentPage}
                isGroupVisible={tocCheck.isGroupVisible}
                onToggleVisibility={tocCheck.toggleGroupVisibility}
                {...tocInstanceVisibilityProps}
                isSameGroupAsSelected={tocCheck.isGroupSelected}
                selectedInstance={tocCheck.selected}
                onSelectGroup={(group) => {
                  setConsistencyFocus('toc');
                  setLastConsistencyPane('toc');
                  tocCheck.selectGroup(group);
                }}
                onSelectPageInGroup={(pageNum, instances) => {
                  setConsistencyFocus('toc');
                  setLastConsistencyPane('toc');
                  tocCheck.selectPageInGroup(pageNum, instances);
                }}
                onBackToSetup={clearConsistencyTabWork}
                formatPageLabel={pageDisplay.formatLabel}
              />
            ) : null}
            {showConsistencyResultsPanel ? (
              <CheckResultsPanel
                entries={consistencyTabEntries}
                viewSource="consistency"
                currentPage={pdf.currentPage}
                activeGroup={ruleCheck.activeGroup}
                totalFindings={consistencyTabTotalFindings}
                ruleCount={consistencyTabEntries.length}
                literalWithFindingsCount={
                  consistencyGroupsWithFindings.literalWithFindings
                }
                unifyWithFindingsCount={
                  consistencyGroupsWithFindings.unifyWithFindings
                }
                commonStringWithFindingsCount={
                  consistencyGroupsWithFindings.commonStringWithFindings
                }
                auxiliaryWithFindingsCount={
                  consistencyGroupsWithFindings.auxiliaryWithFindings
                }
                literalCriteriaSelected={
                  consistencyCriteriaSelection.literalSelected
                }
                unifyCriteriaSelected={
                  consistencyCriteriaSelection.unifySelected
                }
                commonStringCriteriaSelected={
                  consistencyCriteriaSelection.commonStringSelected
                }
                auxiliaryCriteriaSelected={
                  consistencyCriteriaSelection.auxiliarySelected
                }
                spellingCheckDone={ruleCheck.consistencyCheckDone}
                isGroupVisible={ruleCheck.isGroupVisible}
                onToggleVisibility={ruleCheck.toggleResultVisibility}
                {...ruleCheckInstanceVisibilityProps}
                isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
                selectedInstance={ruleCheck.consistencySelected}
                onSelectGroup={(group) => {
                  setConsistencyFocus('rules');
                  setLastConsistencyPane('rules');
                  ruleCheck.selectGroup(group, 'consistency');
                }}
                onSelectPageInGroup={(pageNum, instances) => {
                  setConsistencyFocus('rules');
                  setLastConsistencyPane('rules');
                  ruleCheck.selectPageInGroup(pageNum, instances, 'consistency');
                }}
                formatPageLabel={pageDisplay.formatLabel}
                customRules={customRules}
              />
            ) : null}
            {!consistencyWorkDone ? (
              <div className="consistency-rules-scroll custom-scrollbar">
                <ConsistencyPanel
                  auxiliaryVerbGuide={
                    workGuide.showAuxiliaryVerbGuide
                      ? {
                          storageKey: workGuide.storageKey(
                            WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO,
                          ),
                          alignToBubbleChain: WORK_GUIDE_5_ALIGN_CHAIN,
                          pinned: workGuide.pinAll,
                          onDismiss: () =>
                            workGuide.dismiss(
                              WORK_GUIDE_KEYS.AUXILIARY_VERB_INTRO,
                            ),
                        }
                      : null
                  }
                  consistencyUnifyPinGuide={
                    workGuide.showConsistencyUnifyPinGuide
                      ? {
                          storageKey: workGuide.storageKey(
                            WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN,
                          ),
                          alignToBubble: WORK_GUIDE_UNIFY_PIN_ALIGN,
                          pinned: workGuide.pinAll,
                          onDismiss: () =>
                            workGuide.dismiss(
                              WORK_GUIDE_KEYS.CONSISTENCY_UNIFY_PIN,
                            ),
                        }
                      : null
                  }
                  guidePinTailWord={
                    workGuide.showConsistencyUnifyPinGuide
                      ? GUEST_BROWSE_UNIFY_PIN_TAIL
                      : null
                  }
                  onGuidePinClick={handleConsistencyUnifyPinGuideClick}
                  onLiteralAddButtonClick={handleConsistencyLiteralAddGuideClick}
                  onUnifyAddButtonClick={handleConsistencyUnifyAddGuideClick}
                  customRules={customRules}
                  consistencyDecisions={consistencyDecisions}
                  decisionByUid={decisionByUid}
                  onCustomRulesChange={onCustomRulesChange}
                  globalExcludePhrases={globalExcludePhrases}
                  onGlobalExcludePhrasesChange={onGlobalExcludePhrasesChange}
                  builtInEnabled={builtInEnabled}
                  cautionEnabled={cautionEnabled}
                  tocBodyText={tocBodyText}
                  onTocBodyTextChange={onTocBodyTextChange}
                  tocBodyExcludePages={tocBodyExcludePages}
                  onTocBodyExcludePagesChange={onTocBodyExcludePagesChange}
                  printedPagesActive={pageDisplay.active}
                  currentSystemPage={pdf.currentPage}
                  currentPrintedLabel={pageDisplay.formatLabel(pdf.currentPage)}
                  previewPrintedLabel={
                    pageDisplay.active
                      ? pageDisplay.formatPageText(pdf.currentPage)
                      : pageDisplay.formatNaturalPreview(pdf.currentPage)
                  }
                  spreadInput={pageDisplay.spreadInput}
                  onSpreadInputChange={pageDisplay.setSpreadInput}
                  firstPageSingle={pageDisplay.firstPageSingle}
                  onFirstPageSingleChange={pageDisplay.setFirstPageSingle}
                  onCalibrateFromInput={pageDisplay.calibrateFromInput}
                  onRunTocCheck={
                    tocBodyCheckEnabled
                      ? async () => {
                          ruleCheck.clearConsistencyCheckState();
                          tocCheck.clearTocCheckState();
                          setConsistencyFocus('toc');
                          setLastConsistencyPane('toc');
                          await tocCheck.runCheck();
                        }
                      : undefined
                  }
                  hasPdf={pdf.pageTexts.length > 0}
                  isProcessing={pdf.isProcessing}
                  checkQuotaBlocked={checkSessionBlocked}
                />
              </div>
            ) : null}
          </div>
        )}

      </aside>

      <div
        ref={handleRef}
        className="layout-col-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={panelStyle.width}
        aria-valuemin={PANEL_LEFT_MIN_WIDTH}
        aria-valuemax={PANEL_LEFT_MAX_WIDTH}
        aria-label="좌우 패널 너비 조절"
        title="드래그하여 너비 조절"
        onPointerDown={startDrag}
      >
        <span className="layout-col-resize-grip" aria-hidden>
          ⋮
        </span>
      </div>

      <main className="panel-right">
        <div className="pdf-work-pane">
          <header className="pdf-work-pane__header">
            <div className="pdf-work-pane__topbar">
              {greetingParagraph}
              <GuideClickHand
                active={
                  workGuide.showConsistencyGuide &&
                  !consistencyGuideLiteralAddClicked
                }
                anchorSelector='[data-work-guide="literal-add"]'
              />
              <GuideClickHand
                active={
                  workGuide.showConsistencyGuide &&
                  consistencyGuideLiteralAddClicked &&
                  !consistencyGuideUnifyAddClicked
                }
                anchorSelector='[data-work-guide="unify-add"]'
              />
              <GuideClickHand
                active={workGuide.showConsistencyUnifyPinGuide}
                anchorSelector='[data-work-guide="unify-pin-silla"]'
                align="center"
              />
              <GuideClickHand
                active={workGuide.showAuxiliaryVerbGuide}
                anchorSelector='[data-work-guide="consistency-criteria-run"]'
              />
              <GuideClickHand
                active={workGuide.showRuleSetSaveGuide}
                anchorSelector='[data-work-guide="consistency-export"]'
              />
              {showPdfViewer ? (
                <div className="pdf-work-pane__zoom-axis">
                  <PdfZoomBar
                    zoomPercent={pdfZoom.zoomPercent}
                    canZoomIn={pdfZoom.canZoomIn}
                    canZoomOut={pdfZoom.canZoomOut}
                    onZoomIn={pdfZoom.zoomIn}
                    onZoomOut={pdfZoom.zoomOut}
                    onZoomPercentChange={pdfZoom.setZoomFromPercent}
                  />
                </div>
              ) : null}
              <div className="pdf-work-pane__topbar-actions">
                <span className="pdf-work-pane__aux-btn-wrap">
                  <button
                    type="button"
                    className="pdf-work-pane__aux-btn"
                    onClick={() => {
                      rewardNotice.dismiss();
                      onOpenMyPageWindow();
                    }}
                  >
                    <UserRound size={16} aria-hidden />
                    마이페이지
                  </button>
                  {rewardNotice.visible ? (
                    <span
                      className="pdf-work-pane__aux-notice"
                      aria-label="새 배지 확인"
                    />
                  ) : null}
                </span>
                <button
                  type="button"
                  className="pdf-work-pane__aux-btn"
                  onClick={() => void session.handleEndWork()}
                >
                  <FilePlus size={16} aria-hidden />
                  새 업로드
                </button>
                {workGuide.showWorkExitGuide ? (
                  <TooltipGuide
                    storageKey={workGuide.storageKey(WORK_GUIDE_KEYS.WORK_EXIT)}
                    placement="bottom"
                    bubbleType="left"
                    useFixedLayer
                    alignToBubble={WORK_GUIDE_7_ALIGN}
                    bubbleGuideStep="7"
                    offsetX={0}
                    offsetY={8}
                    pinned={workGuide.pinAll}
                    message={
                      <>
                        <span className="tooltip-guide__message-line">
                          모모는 늘 여기에 있다냥
                        </span>
                        <span className="tooltip-guide__message-line">
                          회원 가입 후 사용하다 질문이 생기면
                        </span>
                        <span className="tooltip-guide__message-line">
                          <span className="tooltip-guide__feedback-btn-look">
                            <MessageSquare
                              size={14}
                              aria-hidden
                              className="tooltip-guide__feedback-btn-look__icon"
                            />
                            피드백
                          </span>
                          으로 물어보라냥!
                        </span>
                      </>
                    }
                    onDismiss={() => {
                      workGuide.dismiss(WORK_GUIDE_KEYS.WORK_EXIT);
                      trackGuestBrowseCompleted();
                    }}
                  >
                    <span className="work-guide-anchor work-guide-anchor--logout">
                      <button
                        type="button"
                        className="pdf-work-pane__aux-btn"
                        onClick={() => {
                          void onLogout();
                        }}
                      >
                        <LogOut size={16} aria-hidden />
                        메인 화면으로
                      </button>
                    </span>
                  </TooltipGuide>
                ) : (
                  <button
                    type="button"
                    className="pdf-work-pane__aux-btn"
                    onClick={() => {
                      void onLogout();
                    }}
                  >
                    <LogOut size={16} aria-hidden />
                    메인 화면으로
                  </button>
                )}
                {feedbackThankYouOpen ? (
                  <TooltipGuide
                    storageKey={workGuide.storageKey(
                      WORK_GUIDE_KEYS.FEEDBACK_QUOTA_THANK,
                    )}
                    placement="bottom"
                    bubbleType="left"
                    useFixedLayer
                    offsetX={-100}
                    offsetY={8}
                    message={
                      <>
                        {FEEDBACK_SUBMIT_THANK_BUBBLE_LINES.map((line) => (
                          <span
                            key={line}
                            className="tooltip-guide__message-line tooltip-guide__message-line--stacked"
                          >
                            {line}
                          </span>
                        ))}
                      </>
                    }
                    onDismiss={() => {
                      onFeedbackThankYouDismiss();
                    }}
                  >
                    <button
                      type="button"
                      className="ruleset-panel__feedback"
                      onClick={() => {
                        trackFeedbackOpened();
                        openFeedbackFormForUser(authUid);
                      }}
                    >
                      <MessageSquare size={18} aria-hidden />
                      피드백
                    </button>
                  </TooltipGuide>
                ) : (
                  <button
                    type="button"
                    className="ruleset-panel__feedback"
                    onClick={() => {
                      trackFeedbackOpened();
                      openFeedbackFormForUser(authUid);
                    }}
                  >
                    <MessageSquare size={18} aria-hidden />
                    피드백
                  </button>
                )}
              </div>
            </div>
          </header>
          <div className="pdf-work-pane__content">
            {!showPdfViewer ? (
              guestBrowsePreparingDemo ? (
                <div
                  className="pdf-center-stage pdf-center-stage--guest-prep"
                  role="status"
                  aria-live="polite"
                >
                  <p className="pdf-center-stage__guest-prep-label">
                    샘플 원고 준비 중…
                  </p>
                </div>
              ) : (
            <PdfCenterStage
              fileRef={pdf.fileRef}
              onOpenPicker={session.openPdfWithPicker}
              onFileChange={session.handleFileChange}
              onLoadPdfFile={session.loadPdfFile}
              onReconnect={session.reconnectPdfFile}
              onClearSession={session.handleClearSession}
              onRunCheck={
                workTab === 'spelling'
                  ? ruleCheck.runSpellingCheck
                  : async () => {
                      tocCheck.clearTocCheckState();
                      ruleCheck.clearConsistencyCheckState();
                      setConsistencyFocus('rules');
                      setLastConsistencyPane('rules');
                      await ruleCheck.runConsistencyCheck();
                    }
              }
              showRunButton={workTab === 'spelling' || workTab === 'consistency'}
              isProcessing={pdf.isProcessing}
              progressLabel={pdf.progressLabel}
              progress={pdf.progress}
              pdf={pdf.pdf}
              pdfFileName={pdf.pdfFileName}
              isDemoSample={isOnboardingSamplePdfName(pdf.pdfFileName)}
              pdfByteLength={pdf.pdfByteLength ?? undefined}
              pageTextsLength={pdf.pageTexts.length}
              fileHandleActive={pdf.fileHandleActive}
              loadError={pdf.loadError}
              sessionHint={session.sessionHint}
              runLabel={centerRunLabel}
              showReady={Boolean(pdf.pdf)}
              checkQuotaBlocked={checkSessionBlocked}
              showUploadGuide={workGuide.showPreUploadGuide}
              uploadGuideStorageKey={workGuide.storageKey(
                WORK_GUIDE_KEYS.PRE_UPLOAD,
              )}
              uploadGuidePinned={workGuide.pinAll}
              onUploadGuideDismiss={() =>
                workGuide.dismiss(WORK_GUIDE_KEYS.PRE_UPLOAD)
              }
            />
              )
            ) : (
            <>
              <PdfViewer
                key={`pdf-${pdf.pdf.numPages}`}
                pdf={pdf.pdf}
                pageNum={pdf.currentPage}
                pageData={pdf.currentPageData}
                highlights={highlights.pageHighlights}
                showPageMeta={false}
                zoomFactor={pdfZoom.zoomFactor}
                onZoomFactorChange={pdfZoom.setZoomFactor}
                guideHighlightActive={guestResultGuideActive}
                onHighlightTipOpen={handleGuestHighlightTipOpen}
                onHighlightTipConfirm={handleGuestHighlightTipConfirm}
                onHighlightTipDismiss={handleGuestHighlightTipDismiss}
                tipConfirmGuideAttr={
                  guestBrowseAutoRunsCriteriaCheck() &&
                  workGuide.showFirstResultGuide
                    ? 'pdf-tip-confirm'
                    : undefined
                }
              />
              <PdfPreviewBar
                currentPage={pdf.currentPage}
                numPages={pdf.pdf.numPages}
                onGoToPage={goToPdfPage}
                pdf={pdf.pdf}
                formatPageLabel={pageDisplay.formatLabel}
                thumbStripOpen={
                  guestBrowseHidesThumbStrip() ? false : thumbStripOpen
                }
                onToggleThumbStrip={
                  guestBrowseHidesThumbStrip() ? undefined : toggleThumbStrip
                }
                printedPagesEnabled={pageDisplay.enabled}
                printedPagesActive={pageDisplay.active}
                formatPageText={pageDisplay.formatPageText}
                toSystemPageFromInput={pageDisplay.toSystemPageFromInput}
                pageStatus={pdfPageStatus}
              />
            </>
          )}
          </div>
        </div>
      </main>
      </div>

      <CriteriaSaveModal
        open={criteriaSaveModalOpen}
        projectName={criteriaSaveModalName}
        onClose={() => setCriteriaSaveModalOpen(false)}
      />
    </div>
  );
}
