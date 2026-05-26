import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import AppVersionBadge from './AppVersionBadge.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import RuleSetPanel from './RuleSetPanel.jsx';
import FeedbackModal from './FeedbackModal.jsx';
import PdfPreviewBar from './PdfPreviewBar.jsx';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import PdfCenterStage from './PdfCenterStage.jsx';
import { usePdfDocument } from '../hooks/usePdfDocument.js';
import { useRuleCheck } from '../hooks/useRuleCheck.js';
import { useWorkSession } from '../hooks/useWorkSession.js';
import { useHighlights } from '../hooks/useHighlights.js';
import { useResizablePanelWidth } from '../hooks/useResizablePanelWidth.js';
import { usePrintedPageDisplay } from '../hooks/usePrintedPageDisplay.js';
import {
  countBuiltInActiveRules,
  countConsistencyActiveRules,
  countSpacingReviewActiveRules,
} from '../lib/activeRuleCount.js';

/**
 * @param {{
 *   ruleSets: { id: string, name: string }[],
 *   activeSetId: string,
 *   onSelectRuleSet: (id: string) => void,
 *   onCreateRuleSet: () => void,
 *   onDuplicateRuleSet: () => void,
 *   onDeleteRuleSet: () => void,
 *   ruleSetName: string,
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
  ruleSetName,
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
  const [thumbStripOpen, setThumbStripOpen] = useState(() => {
    try {
      return localStorage.getItem('pdf-proofread-thumb-strip-open') === '1';
    } catch {
      return false;
    }
  });
  const afterCheckRef = useRef(async () => false);
  const { panelStyle, handleRef, startDrag } = useResizablePanelWidth();

  const pdf = usePdfDocument();
  const builtInRuleCount = useMemo(
    () => countBuiltInActiveRules({ builtInEnabled }),
    [builtInEnabled],
  );
  const spacingRuleCount = useMemo(
    () => countSpacingReviewActiveRules({ cautionEnabled }),
    [cautionEnabled],
  );
  const consistencyRuleCount = useMemo(
    () => countConsistencyActiveRules(customRules),
    [customRules],
  );

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

  const tabEntries = useMemo(() => {
    /** @type {{ group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency' }[]} */
    const entries = [];
    if (workTab === 'spelling') {
      for (const group of ruleCheck.spellingResults) {
        entries.push({ group, source: 'spelling' });
      }
    } else {
      for (const group of ruleCheck.consistencyResults) {
        entries.push({ group, source: 'consistency' });
      }
    }
    return entries;
  }, [workTab, ruleCheck.spellingResults, ruleCheck.consistencyResults]);

  const tabTotalFindings = useMemo(
    () =>
      tabEntries.reduce((n, { group }) => n + group.instances.length, 0),
    [tabEntries],
  );

  const visibleOnCurrentPage = ruleCheck.countVisibleOnPage(
    pdf.currentPage,
    workTab,
  );
  const activeRuleOnPageCount = ruleCheck.getActiveOnPage(pdf.currentPage);

  const tabCheckDone =
    workTab === 'spelling'
      ? ruleCheck.spellingCheckDone
      : ruleCheck.consistencyCheckDone;

  function switchTab(tab) {
    setWorkTab(tab);
    ruleCheck.syncSelectionForTab(tab);
  }

  const goToPdfPage = (pageNum) => {
    if (!pdf.pdf) return;
    const target = Math.min(pdf.pdf.numPages, Math.max(1, pageNum));
    ruleCheck.goToPage(target);
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
      try {
        localStorage.setItem('pdf-proofread-thumb-strip-open', next ? '1' : '0');
      } catch {
        /* ignore */
      }
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
      activeRuleOnPageCount={activeRuleOnPageCount}
      visibleOnCurrentPage={visibleOnCurrentPage}
      totalFindings={tabTotalFindings}
      ruleCount={tabEntries.length}
      spellingFindings={ruleCheck.spellingFindings}
      builtinFindings={ruleCheck.builtinFindings}
      spacingFindings={ruleCheck.spacingFindings}
      consistencyFindings={ruleCheck.consistencyFindings}
      spellingCheckDone={ruleCheck.spellingCheckDone}
      consistencyCheckDone={ruleCheck.consistencyCheckDone}
      isGroupVisible={ruleCheck.isGroupVisible}
      onToggleVisibility={ruleCheck.toggleResultVisibility}
      isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
      onSelectGroup={ruleCheck.selectGroup}
      onSelectPageInGroup={ruleCheck.selectPageInGroup}
      ruleSetName={ruleSetName}
      onAdditionalCheck={
        workTab === 'consistency' ? ruleCheck.backToConsistencySetup : undefined
      }
      printedPagesEnabled={pageDisplay.enabled}
      onPrintedPagesEnabledChange={pageDisplay.setEnabled}
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

  const showPdfViewer = Boolean(pdf.pdf) && tabCheckDone;

  const centerRunLabel =
    pdf.isProcessing && pdf.progress?.phase === 'check'
      ? '검사 중…'
      : workTab === 'spelling'
        ? '검사 실행 (맞춤법·띄어쓰기)'
        : '검사 실행 (일관성)';

  const centerRuleHint =
    workTab === 'spelling'
      ? `맞춤법 확인 ${builtInRuleCount} · 편집자 검토 ${spacingRuleCount} · 합계 ${ruleCheck.spellingActiveRules.length}개 규칙`
      : `일관성 ${ruleCheck.consistencyActiveRules.length}개 규칙 검사`;

  return (
    <div className="layout-main">
      <aside
        className={`panel-left panel-left--${workTab}`}
        style={panelStyle}
      >
        <header className="panel-header panel-header--tabs">
          <div className="panel-header-tab-row">
            <button
              type="button"
              className="btn-ghost btn-ghost--compact panel-header-home"
              onClick={onOpenWelcome}
              title="대문화면"
              aria-label="대문화면"
            >
              <BookOpen size={18} />
            </button>
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
          </div>
        </header>

        {workTab === 'spelling' && (
          <div
            className={`spelling-tab-layout ${tabCheckDone ? 'spelling-tab-layout--with-results' : 'spelling-tab-layout--rules-only'}`}
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
        aria-valuemin={280}
        aria-valuemax={720}
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
          <RuleSetPanel
            ruleSets={ruleSets}
            activeSetId={activeSetId}
            ruleSetName={ruleSetName}
            ruleSetSavedAt={ruleSetSavedAt}
            onSelectSet={onSelectRuleSet}
            onRuleSetNameChange={onRuleSetNameChange}
            onCreateSet={onCreateRuleSet}
            onDuplicateSet={onDuplicateRuleSet}
            onDeleteSet={onDeleteRuleSet}
            onSave={onSaveRules}
            onOpenFeedback={() => setFeedbackOpen(true)}
            builtInRuleCount={builtInRuleCount}
            spacingRuleCount={spacingRuleCount}
            consistencyRuleCount={consistencyRuleCount}
          />
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
              sessionHint={session.sessionHint}
              runLabel={centerRunLabel}
              ruleHint={centerRuleHint}
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
              />
              <PdfPreviewBar
                currentPage={pdf.currentPage}
                numPages={pdf.pdf.numPages}
                onGoToPage={goToPdfPage}
                pdf={pdf.pdf}
                formatPageLabel={pageDisplay.formatLabel}
                findingsOnPage={visibleOnCurrentPage}
                thumbStripOpen={thumbStripOpen}
                onToggleThumbStrip={toggleThumbStrip}
                printedPagesEnabled={pageDisplay.enabled}
                printedPagesActive={pageDisplay.active}
                printedPagesCalibrated={pageDisplay.active}
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
