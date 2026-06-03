import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FilePlus,
  House,
  LogOut,
  MessageSquare,
  Save,
  UserRound,
} from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import AppVersionBadge from './AppVersionBadge.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import PanelSectionRunButton from './PanelSectionRunButton.jsx';
import FeedbackModal from './FeedbackModal.jsx';
import PdfPreviewBar from './PdfPreviewBar.jsx';
import PdfZoomBar from './PdfZoomBar.jsx';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import PrintedPageSetup from './PrintedPageSetup.jsx';
import PdfCenterStage from './PdfCenterStage.jsx';
import TocBodyResultsPanel from '../toc-body/components/TocBodyResultsPanel.jsx';
import { useTocBodyCheck } from '../toc-body/hooks/useTocBodyCheck.js';
import { useTocBodyHighlights } from '../toc-body/hooks/useTocBodyHighlights.js';
import { buildTocBodyTabEntries } from '../toc-body/utils/toc-body-result-entries.js';
import { isTocBodyCheckEnabled } from '../lib/featureFlags.js';
import { usePdfDocument } from '../hooks/usePdfDocument.js';
import { usePdfZoom } from '../hooks/usePdfZoom.js';
import { useRuleCheck } from '../hooks/useRuleCheck.js';
import { useWorkSession } from '../hooks/useWorkSession.js';
import { useHighlights } from '../hooks/useHighlights.js';
import {
  PANEL_LEFT_MAX_WIDTH,
  PANEL_LEFT_MIN_WIDTH,
  useResizablePanelWidth,
} from '../hooks/useResizablePanelWidth.js';
import { usePrintedPageDisplay } from '../hooks/usePrintedPageDisplay.js';
import { trackFeedbackOpened } from '../lib/analytics.js';
import {
  getCurrentUserSession,
  subscribeAuthSession,
} from '../lib/firebaseAuth.js';
import {
  getUserProfile,
  isOnboardingComplete,
} from '../lib/userProfileStorage.js';
import { formatRuleSetSavedDate } from '../lib/ruleSetsStorage.js';
import WelcomeProfileOnboarding from '../welcome/pc/WelcomeProfileOnboarding.jsx';
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
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   onSaveRules: () => void,
 *   onSaveCriteriaPreset: (name: string) => boolean,
 *   onOpenWelcome: () => void,
 *   onLogout: () => void | Promise<void>,
 *   onOpenMyPageWindow: () => void,
 *   onOpenGuideWindow: () => void,
 *   initialWorkTab?: 'spelling' | 'consistency',
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
  onOpenWelcome,
  onLogout,
  onOpenMyPageWindow,
  onOpenGuideWindow,
  initialWorkTab = 'spelling',
}) {
  void onOpenGuideWindow;
  const [workTab, setWorkTab] = useState(initialWorkTab);
  /** @type {['toc' | 'rules', import('react').Dispatch<import('react').SetStateAction<'toc' | 'rules'>>]} */
  const [consistencyFocus, setConsistencyFocus] = useState('rules');
  /** 목차·표기 결과가 둘 다 있을 때 어느 패널을 보여줄지 (겹쳐 쌓지 않음) */
  const [lastConsistencyPane, setLastConsistencyPane] = useState(
    /** @type {'toc' | 'rules'} */ ('rules'),
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [thumbStripOpen, setThumbStripOpen] = useState(readThumbStripOpenPreference);
  const [authSession, setAuthSession] = useState(() => getCurrentUserSession());
  const [profileOnboardingRev, setProfileOnboardingRev] = useState(0);
  const [criteriaNameInput, setCriteriaNameInput] = useState('');
  const [criteriaPickerOpen, setCriteriaPickerOpen] = useState(false);
  const criteriaPickerRef = useRef(null);
  const afterCheckRef = useRef(async () => false);
  const { panelStyle, handleRef, startDrag } = useResizablePanelWidth();

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

  useEffect(() => {
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

  function handleSaveCriteria() {
    onSaveCriteriaPreset(criteriaNameInput);
    setCriteriaPickerOpen(false);
  }

  function selectSavedCriteria(set) {
    onSelectRuleSet(set.id);
    setCriteriaNameInput((set.name || '').trim());
    setCriteriaPickerOpen(false);
  }

  const authUid = authSession?.uid ?? '';
  void profileOnboardingRev;
  const showProfileOnboarding =
    Boolean(authUid) && !isOnboardingComplete(authUid);

  const greetingName = useMemo(() => {
    void profileOnboardingRev;
    const profile = authUid ? getUserProfile(authUid) : null;
    const nickname = profile?.nickname?.trim();
    if (nickname) return nickname;
    const name = authSession?.displayName?.trim();
    if (name) return name;
    return null;
  }, [authUid, authSession?.displayName, profileOnboardingRev]);

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
  });
  const tocBodyCheckEnabled = isTocBodyCheckEnabled();
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

  const ruleHighlights = useHighlights({
    currentPage: pdf.currentPage,
    currentPageData: pdf.currentPageData,
    spellingResults: ruleCheck.spellingResults,
    consistencyResults: ruleCheck.consistencyResults,
    resultVisibility: ruleCheck.resultVisibility,
    highlightTab: workTab === 'spelling' ? 'spelling' : 'consistency',
    activeSource: ruleCheck.activeSource,
    selectedInstance: ruleCheck.selectedInstance,
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
      ),
    [ruleCheck.spellingResults, ruleCheck.consistencyResults],
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

  const consistencyTabTotalFindings = useMemo(
    () => countTabTotalFindings(consistencyTabEntries),
    [consistencyTabEntries],
  );

  const tocBodyTabEntries = useMemo(
    () => buildTocBodyTabEntries(tocCheck.results),
    [tocCheck.results],
  );

  const consistencyWorkDone =
    (tocBodyCheckEnabled && tocCheck.checkDone) ||
    ruleCheck.consistencyCheckDone;

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

  const printedPagePanelProps = {
    printedPageOffset: pageDisplay.offset,
    printedPagesActive: pageDisplay.active,
    onCalibrateFromInput: pageDisplay.calibrateFromInput,
    onClearPrintedPageOffset: pageDisplay.clearCalibration,
    currentPrintedLabel: pageDisplay.formatLabel(pdf.currentPage),
    previewPrintedLabel: pageDisplay.active
      ? pageDisplay.formatPageText(pdf.currentPage)
      : pageDisplay.formatNaturalPreview(pdf.currentPage),
    spreadInput: pageDisplay.spreadInput,
    onSpreadInputChange: pageDisplay.setSpreadInput,
    firstPageSingle: pageDisplay.firstPageSingle,
    onFirstPageSingleChange: pageDisplay.setFirstPageSingle,
    formatPageLabel: pageDisplay.formatLabel,
  };

  function switchTab(tab) {
    if (tab === 'spelling') {
      clearSpellingTabWork();
      setWorkTab('spelling');
      ruleCheck.syncSelectionForTab('spelling');
      return;
    }
    clearConsistencyTabWork();
    setWorkTab('consistency');
    ruleCheck.syncSelectionForTab('consistency');
  }

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

  const spellingResultsPanel =
    workTab === 'spelling' && ruleCheck.spellingCheckDone ? (
      <CheckResultsPanel
        entries={spellingTabEntries}
        viewSource="spelling"
        currentPage={pdf.currentPage}
        pdf={pdf.pdf}
        activeGroup={ruleCheck.activeGroup}
        activeSource={ruleCheck.activeSource}
        visibleOnCurrentPage={visibleOnCurrentPage}
        totalFindings={spellingTabTotalFindings}
        ruleCount={spellingTabEntries.length}
        spellingFindings={ruleCheck.spellingFindings}
        builtinFindings={ruleCheck.builtinFindings}
        spacingFindings={ruleCheck.spacingFindings}
        spellingCheckDone={ruleCheck.spellingCheckDone}
        isGroupVisible={ruleCheck.isGroupVisible}
        onToggleVisibility={ruleCheck.toggleResultVisibility}
        isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
        onSelectGroup={ruleCheck.selectGroup}
        onSelectPageInGroup={ruleCheck.selectPageInGroup}
        {...printedPagePanelProps}
      />
    ) : null;

  const showPdfViewer = useMemo(
    () => shouldShowPdfViewer(Boolean(pdf.pdf)),
    [pdf.pdf],
  );
  const isPreUpload = !pdf.pdf;

  const centerRunLabel = useMemo(
    () => getCenterRunLabel(pdf.isProcessing, pdf.progress),
    [pdf.isProcessing, pdf.progress],
  );

  const spellingTabLayoutClassName = useMemo(
    () => getSpellingTabLayoutClassName(tabCheckDone),
    [tabCheckDone],
  );

  return (
    <div className="layout-main">
      <aside
        className={`panel-left panel-left--${workTab}${isPreUpload ? ' panel-left--preupload' : ''}`}
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
            <div className="panel-left__criteria-save">
              <div
                className="panel-left__criteria-picker"
                ref={criteriaPickerRef}
              >
                <label className="sr-only" htmlFor="panel-left-criteria-name">
                  기준 이름
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
                      if (savedRuleSets.length > 0) setCriteriaPickerOpen(true);
                    }}
                    placeholder="기준 이름 입력·선택"
                    maxLength={60}
                    autoComplete="off"
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
                    disabled={savedRuleSets.length === 0}
                    onClick={() => setCriteriaPickerOpen((open) => !open)}
                  >
                    <ChevronDown size={16} aria-hidden />
                  </button>
                </div>
                {criteriaPickerOpen && savedRuleSets.length > 0 ? (
                  <ul
                    id="panel-left-criteria-picker-list"
                    className="panel-left__criteria-picker-menu custom-scrollbar"
                    role="listbox"
                    aria-label="저장한 기준"
                  >
                    {savedRuleSets.map((set) => {
                      const isActive = set.id === activeSetId;
                      const label = (set.name || '이름 없는 기준').trim();
                      const savedLabel = formatRuleSetSavedDate(set.savedAt);
                      return (
                        <li key={set.id} role="presentation">
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
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                className="panel-left__save-rules"
                onClick={handleSaveCriteria}
              >
                <Save size={16} aria-hidden />
                기준 저장
              </button>
            </div>
          </div>
          <nav className="work-tabs" aria-label="검수 종류">
            <button
              type="button"
              className={`work-tab work-tab--spelling ${workTab === 'spelling' ? 'active' : ''}`}
              onClick={() => switchTab('spelling')}
            >
              맞춤법 확인
            </button>
            <button
              type="button"
              className={`work-tab work-tab--consistency ${workTab === 'consistency' ? 'active' : ''}`}
              onClick={() => switchTab('consistency')}
            >
              일관성 · 목차 확인
            </button>
          </nav>
        </header>
        {isPreUpload ? (
          <p className="panel-left__preupload-hint">
            가운데에서 PDF를 업로드하면 맞춤법·일관성·목차 검사에 함께 사용됩니다
          </p>
        ) : null}

        {workTab === 'spelling' && (
          <div
            className={spellingTabLayoutClassName}
          >
            {pdf.pdf ? (
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
                  onClear={pageDisplay.clearCalibration}
                />
              </div>
            ) : null}
            {pdf.pdf && !tabCheckDone ? (
              <div className="spelling-tab-layout__run-row">
                <PanelSectionRunButton
                  label="기준 검수"
                  onClick={ruleCheck.runSpellingCheck}
                  disabled={pdf.pageTexts.length === 0}
                  isProcessing={pdf.isProcessing}
                />
              </div>
            ) : null}
            {tabCheckDone && (
              <div className="spelling-tab-scroll custom-scrollbar">
                {spellingResultsPanel}
              </div>
            )}

            <ResizableBuiltinSpelling
              builtInEnabled={builtInEnabled}
              onBuiltInToggle={onBuiltInToggle}
              onBuiltInSetAll={onBuiltInSetAll}
              cautionEnabled={cautionEnabled}
              onCautionToggle={onCautionToggle}
              onCautionSetAll={onCautionSetAll}
              fillPanel={!tabCheckDone}
            />
          </div>
        )}

        {workTab === 'consistency' && (
          <div className="panel-left-work-scroll custom-scrollbar">
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
                  표기 일관성 결과
                </button>
              </nav>
            ) : null}
            {showTocResultsPanel ? (
              <TocBodyResultsPanel
                entries={tocBodyTabEntries}
                currentPage={pdf.currentPage}
                pdf={pdf.pdf}
                activeGroup={tocCheck.activeGroup}
                visibleOnCurrentPage={visibleOnCurrentPage}
                isGroupVisible={tocCheck.isGroupVisible}
                onToggleVisibility={tocCheck.toggleGroupVisibility}
                isSameGroupAsSelected={tocCheck.isGroupSelected}
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
                {...printedPagePanelProps}
              />
            ) : null}
            {showConsistencyResultsPanel ? (
              <CheckResultsPanel
                entries={consistencyTabEntries}
                viewSource="consistency"
                currentPage={pdf.currentPage}
                pdf={pdf.pdf}
                activeGroup={ruleCheck.activeGroup}
                activeSource={ruleCheck.activeSource}
                visibleOnCurrentPage={visibleOnCurrentPage}
                totalFindings={consistencyTabTotalFindings}
                ruleCount={consistencyTabEntries.length}
                spellingFindings={ruleCheck.consistencyFindings}
                spellingCheckDone={ruleCheck.consistencyCheckDone}
                isGroupVisible={ruleCheck.isGroupVisible}
                onToggleVisibility={ruleCheck.toggleResultVisibility}
                isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
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
                onAdditionalCheck={clearConsistencyTabWork}
                {...printedPagePanelProps}
              />
            ) : null}
            {!consistencyWorkDone ? (
              <div className="consistency-rules-scroll custom-scrollbar">
                <ConsistencyPanel
                  customRules={customRules}
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
                  onClearPrintedPageOffset={pageDisplay.clearCalibration}
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
                  onRunRulesCheck={async () => {
                    setConsistencyFocus('rules');
                    setLastConsistencyPane('rules');
                    await ruleCheck.runConsistencyCheck();
                  }}
                  hasPdf={pdf.pageTexts.length > 0}
                  isProcessing={pdf.isProcessing}
                />
              </div>
            ) : null}
          </div>
        )}

        <AppVersionBadge />
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
              <p className="pdf-work-pane__greeting">
                {greetingName && activeSavedRuleSetNameDisplay ? (
                  <>
                    <span className="pdf-work-pane__greeting-name">
                      {greetingName}
                    </span>
                    님{' '}
                    <span className="pdf-work-pane__greeting-criteria">
                      [{activeSavedRuleSetNameDisplay}]
                    </span>{' '}
                    기준을 적용하고 있습니다
                  </>
                ) : greetingName ? (
                  <>
                    <span className="pdf-work-pane__greeting-name">
                      {greetingName}
                    </span>
                    님 안녕하세요
                  </>
                ) : (
                  '안녕하세요'
                )}
              </p>
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
                <button
                  type="button"
                  className="pdf-work-pane__aux-btn"
                  onClick={onOpenMyPageWindow}
                >
                  <UserRound size={16} aria-hidden />
                  마이페이지
                </button>
                <button
                  type="button"
                  className="pdf-work-pane__aux-btn"
                  onClick={() => void session.handleEndWork()}
                >
                  <FilePlus size={16} aria-hidden />
                  새 작업
                </button>
                <button
                  type="button"
                  className="pdf-work-pane__aux-btn"
                  onClick={() => {
                    void onLogout();
                  }}
                >
                  <LogOut size={16} aria-hidden />
                  로그아웃
                </button>
                <button
                  type="button"
                  className="ruleset-panel__feedback"
                  onClick={() => {
                    trackFeedbackOpened();
                    setFeedbackOpen(true);
                  }}
                >
                  <MessageSquare size={18} aria-hidden />
                  피드백 보내기
                </button>
              </div>
            </div>
          </header>
          <div className="pdf-work-pane__content">
            {showProfileOnboarding ? (
              <WelcomeProfileOnboarding
                uid={authUid}
                defaultNickname={authSession?.displayName ?? ''}
                onComplete={() => setProfileOnboardingRev((n) => n + 1)}
              />
            ) : null}
            {!showPdfViewer ? (
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
              pdfByteLength={pdf.pdfByteLength ?? undefined}
              pageTextsLength={pdf.pageTexts.length}
              fileHandleActive={pdf.fileHandleActive}
              loadError={pdf.loadError}
              sessionHint={session.sessionHint}
              runLabel={centerRunLabel}
              showReady={Boolean(pdf.pdf)}
            />
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
              />
              <PdfPreviewBar
                currentPage={pdf.currentPage}
                numPages={pdf.pdf.numPages}
                onGoToPage={goToPdfPage}
                pdf={pdf.pdf}
                formatPageLabel={pageDisplay.formatLabel}
                thumbStripOpen={thumbStripOpen}
                onToggleThumbStrip={toggleThumbStrip}
                printedPagesEnabled={pageDisplay.enabled}
                printedPagesActive={pageDisplay.active}
                formatPageText={pageDisplay.formatPageText}
                toSystemPageFromInput={pageDisplay.toSystemPageFromInput}
              />
            </>
          )}
          </div>
        </div>
      </main>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
