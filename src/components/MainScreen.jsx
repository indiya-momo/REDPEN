import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MessageSquare } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import AppVersionBadge from './AppVersionBadge.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import FeedbackModal from './FeedbackModal.jsx';
import PdfPreviewBar from './PdfPreviewBar.jsx';
import PdfZoomBar from './PdfZoomBar.jsx';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import PdfCenterStage from './PdfCenterStage.jsx';
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
 *   ruleSets: { id: string, name: string }[],
 *   activeSetId: string,
 *   onSelectRuleSet: (id: string) => void,
 *   onCreateRuleSet: () => void,
 *   onDuplicateRuleSet: () => void,
 *   onDeleteRuleSet: () => void,
 *   ruleSetSavedAt?: string,
 *   builtInEnabled: Record<string, boolean>,
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases: string[],
 *   onRuleSetNameChange: (name: string) => void,
 *   onBuiltInToggle: (find: string) => void,
 *   onBuiltInSetAll: (enabled: boolean) => void,
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 *   onCautionSetAll: (enabled: boolean) => void,
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   onSaveRules: () => void,
 *   onOpenWelcome: () => void,
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
  onRuleSetNameChange,
  onBuiltInToggle,
  onBuiltInSetAll,
  cautionEnabled,
  onCautionToggle,
  onCautionSetAll,
  onCustomRulesChange,
  onGlobalExcludePhrasesChange,
  onSaveRules,
  onOpenWelcome,
  initialWorkTab = 'spelling',
}) {
  const [workTab, setWorkTab] = useState(initialWorkTab);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [thumbStripOpen, setThumbStripOpen] = useState(readThumbStripOpenPreference);
  const afterCheckRef = useRef(async () => false);
  const { panelStyle, handleRef, startDrag } = useResizablePanelWidth();

  const pdf = usePdfDocument();
  const pdfZoom = usePdfZoom(pdf.pdf);

  const pageDisplay = usePrintedPageDisplay({
    pdfFileName: pdf.pdfFileName,
    numPages: pdf.pdf?.numPages ?? 0,
    currentPage: pdf.currentPage,
  });
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
  const session = useWorkSession(pdf, ruleCheck);
  afterCheckRef.current = session.persistSession;

  const highlights = useHighlights({
    currentPage: pdf.currentPage,
    currentPageData: pdf.currentPageData,
    spellingResults: ruleCheck.spellingResults,
    consistencyResults: ruleCheck.consistencyResults,
    resultVisibility: ruleCheck.resultVisibility,
    highlightTab: workTab,
    activeSource: ruleCheck.activeSource,
    selectedInstance: ruleCheck.selectedInstance,
  });

  useEffect(() => {
    setWorkTab(initialWorkTab);
  }, [initialWorkTab]);

  const tabEntries = useMemo(
    () =>
      buildTabEntries(
        workTab,
        ruleCheck.spellingResults,
        ruleCheck.consistencyResults,
      ),
    [workTab, ruleCheck.spellingResults, ruleCheck.consistencyResults],
  );

  const tabTotalFindings = useMemo(
    () => countTabTotalFindings(tabEntries),
    [tabEntries],
  );

  const visibleOnCurrentPage = ruleCheck.countVisibleOnPage(
    pdf.currentPage,
    workTab,
  );

  const tabCheckDone = useMemo(
    () =>
      isTabCheckDone(
        workTab,
        ruleCheck.spellingCheckDone,
        ruleCheck.consistencyCheckDone,
      ),
    [
      workTab,
      ruleCheck.spellingCheckDone,
      ruleCheck.consistencyCheckDone,
    ],
  );

  function switchTab(tab) {
    setWorkTab(tab);
    ruleCheck.syncSelectionForTab(tab);
  }

  const goToPdfPage = (pageNum) => {
    if (!pdf.pdf) return;
    ruleCheck.goToPage(clampPageNumber(pageNum, pdf.pdf.numPages));
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

  const combinedResultsPanel = tabCheckDone ? (
    <CheckResultsPanel
      entries={tabEntries}
      viewSource={workTab}
      currentPage={pdf.currentPage}
      pdf={pdf.pdf}
      activeGroup={ruleCheck.activeGroup}
      activeSource={ruleCheck.activeSource}
      visibleOnCurrentPage={visibleOnCurrentPage}
      totalFindings={tabTotalFindings}
      ruleCount={tabEntries.length}
      spellingFindings={ruleCheck.spellingFindings}
      builtinFindings={ruleCheck.builtinFindings}
      spacingFindings={ruleCheck.spacingFindings}
      spellingCheckDone={ruleCheck.spellingCheckDone}
      isGroupVisible={ruleCheck.isGroupVisible}
      onToggleVisibility={ruleCheck.toggleResultVisibility}
      isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
      onSelectGroup={ruleCheck.selectGroup}
      onSelectPageInGroup={ruleCheck.selectPageInGroup}
      onAdditionalCheck={
        workTab === 'consistency' ? ruleCheck.backToConsistencySetup : undefined
      }
      printedPageOffset={pageDisplay.offset}
      printedPagesActive={pageDisplay.active}
      onCalibrateFromInput={pageDisplay.calibrateFromInput}
      onClearPrintedPageOffset={pageDisplay.clearCalibration}
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
      formatPageLabel={pageDisplay.formatLabel}
    />
  ) : null;

  const showPdfViewer = useMemo(
    () => shouldShowPdfViewer(Boolean(pdf.pdf), tabCheckDone),
    [pdf.pdf, tabCheckDone],
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
              <BookOpen size={18} />
            </button>
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
              일관성 확인
            </button>
          </nav>
        </header>
        {isPreUpload ? (
          <p className="panel-left__preupload-hint">
            PDF 업로드 후 기준을 설정할 수 있습니다
          </p>
        ) : null}

        {workTab === 'spelling' && (
          <div
            className={spellingTabLayoutClassName}
          >
            {tabCheckDone && (
              <div className="spelling-tab-scroll custom-scrollbar">
                {combinedResultsPanel}
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
            {combinedResultsPanel}
            {!ruleCheck.consistencyCheckDone && (
              <div className="consistency-rules-scroll custom-scrollbar">
                <ConsistencyPanel
                  customRules={customRules}
                  onCustomRulesChange={onCustomRulesChange}
                  globalExcludePhrases={globalExcludePhrases}
                  onGlobalExcludePhrasesChange={onGlobalExcludePhrasesChange}
                  builtInEnabled={builtInEnabled}
                  cautionEnabled={cautionEnabled}
                />
              </div>
            )}
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
          {!isPreUpload ? (
            <header className="pdf-work-pane__header">
              <div className="pdf-work-pane__topbar">
                <p className="pdf-work-pane__notice" role="status">
                  사용자의 기준을 저장하는 기능을 준비 중입니다
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
                    className="pdf-work-pane__end-work"
                    onClick={() => {
                      session.handleEndWork();
                    }}
                  >
                    작업 종료
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
                  : ruleCheck.runConsistencyCheck
              }
              isProcessing={pdf.isProcessing}
              progressLabel={pdf.progressLabel}
              progress={pdf.progress}
              pdf={pdf.pdf}
              pdfFileName={pdf.pdfFileName}
              pdfByteLength={pdf.pdfByteLength ?? undefined}
              pageTextsLength={pdf.pageTexts.length}
              fileHandleActive={pdf.fileHandleActive}
              loadError={pdf.loadError}
              loadAdvisory={pdf.loadAdvisory}
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
      </main>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
